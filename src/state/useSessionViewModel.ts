import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import { computeChecklist } from "../engine/completeness";
import { applyMerges } from "../engine/dedup";
import { effectiveAccentIds } from "../engine/accents";
import { deriveSystem, type Anchors, type AccentSuggestion } from "../engine/derive-system";
import { styleProfileFromFamily } from "../engine/style-profile";
import {
  generateDesignMd,
  mergeCaptureFoundations,
  NOTE_FIELDS,
  type DerivedProvenance,
  type ExportInput,
} from "../engine/export";
import {
  defaultProjectName,
  isSystemCreated,
  isManualToken,
  allPoolTokens,
  excludedPoolTokens,
  poolTokenCount,
  resolveAssignments,
  type TokenPool,
} from "./pool";
import { poolEntries } from "./workspace";
import { radiusInsight, spacingInsight, typeInsight } from "../engine/insights";

/** How a value got into the draft — drives the subtle origin chips (§2.25). */
export type FillOrigin = "snap" | "seeded" | "derived" | "default" | "edited";

export interface FillInfo {
  origin: FillOrigin;
  method: string;
  derivedFrom: string;
}

export interface DraftFill {
  role: string;
  token: StyleSnapToken;
  origin: FillOrigin;
  derivedFrom: string;
  method: string;
}

/** Filled-row tokens — pool.derivedEdits always override draft fills.
 *  Assigned roles (e.g. after Save as primitive) are included when missing from
 *  fills — otherwise the color-family strip falls back to re-deriving from the
 *  primary anchor and looks stale (§2.37 vs strip). */
export function buildRoleDisplayTokens(
  draftFills: DraftFill[],
  derivedEdits?: TokenPool["derivedEdits"],
  assignments?: Readonly<Record<string, string>>,
  tokensById?: ReadonlyMap<string, StyleSnapToken>,
): Map<string, StyleSnapToken> {
  const map = new Map<string, StyleSnapToken>();
  for (const fill of draftFills) {
    map.set(fill.role, fill.token);
  }
  for (const [role, entry] of Object.entries(derivedEdits ?? {})) {
    map.set(role, entry.token);
  }
  if (assignments && tokensById) {
    for (const [role, id] of Object.entries(assignments)) {
      if (map.has(role)) continue;
      const token = tokensById.get(id);
      if (token) map.set(role, token);
    }
  }
  return map;
}

/** Shared session state derived from the pool — one source for the whole page. */
export function useSessionViewModel(pool: TokenPool) {
  const projectName = pool.projectName ?? defaultProjectName(pool);
  const created = isSystemCreated(pool);
  const total = poolTokenCount(pool);
  const entries = useMemo(() => poolEntries(pool), [pool]);

  // Merges are automatic (applied at import) — the merged view IS the draft input.
  const view = useMemo(() => {
    const tokens = applyMerges(entries, pool.merges).map((e) => e.token);
    const assignments = resolveAssignments(pool.assignments, pool.merges);
    return { tokens, assignments };
  }, [entries, pool.merges, pool.assignments]);

  const rawById = useMemo(() => new Map(allPoolTokens(pool).map((t) => [t.id, t])), [pool]);

  const excludedTokens = useMemo(() => excludedPoolTokens(pool), [pool]);

  // ── Derivation (10a): the auto-completed draft, edits overlaid (C.8) ──
  const draft = useMemo(
    () =>
      deriveSystem({
        tokens: view.tokens,
        rawById,
        assignments: new Map(Object.entries(view.assignments)),
        overrides: pool.anchorOverrides,
        typeRatio: pool.typeRatio,
        accentHarmony: pool.accentChoice?.harmony,
        styleProfile: pool.styleFamily
          ? {
              radiusScale: styleProfileFromFamily(pool.styleFamily).radiusScale,
              shadowStyle: styleProfileFromFamily(pool.styleFamily).shadowStyle,
            }
          : undefined,
      }),
    [view, rawById, pool.anchorOverrides, pool.typeRatio, pool.accentChoice?.harmony, pool.styleFamily],
  );

  const draftFills = useMemo((): DraftFill[] => {
    const userAssignments = resolveAssignments(pool.assignments, pool.merges);
    const fills: DraftFill[] = draft.fills.map((fill) => {
      const edit = pool.derivedEdits?.[fill.role];
      if (edit) {
        return { ...fill, token: edit.token, origin: "edited" as const };
      }
      const synthetic = fill.token.id.startsWith("derived_");
      if (synthetic) {
        const origin =
          fill.derivedFrom === "convention" ? ("default" as const) : ("derived" as const);
        return { ...fill, origin };
      }
      // Manual Add-token: never "from capture" (§2.64). User-assigned → snap
      // (no chip); if derivation somehow linked one, still treat as snap.
      if (isManualToken(fill.token)) {
        return { ...fill, origin: "snap" as const };
      }
      // Captured token: user-assigned → snap (no chip); auto-placed → seeded.
      const userPlaced = userAssignments[fill.role] === fill.token.id;
      return { ...fill, origin: userPlaced ? ("snap" as const) : ("seeded" as const) };
    });
    const rolesWithFill = new Set(fills.map((f) => f.role));
    // Edits on roles that derivation skipped (pool.assignments blocks the fill).
    for (const [role, edit] of Object.entries(pool.derivedEdits ?? {})) {
      if (rolesWithFill.has(role)) continue;
      fills.push({
        role,
        token: edit.token,
        origin: "edited",
        derivedFrom: edit.token.id,
        method: "user edit",
      });
    }
    return fills;
  }, [draft, pool.derivedEdits, pool.assignments, pool.merges]);

  /** Filled-row display tokens — derivedEdits always win over derivation (DECISIONS §2.8).
   *  Also merges user assignments so Save-as-primitive edits reach the color-family strip. */
  const roleDisplayTokens = useMemo(() => {
    const byId = new Map<string, StyleSnapToken>();
    for (const t of view.tokens) byId.set(t.id, t);
    for (const t of pool.manual) byId.set(t.id, t);
    for (const fill of draftFills) byId.set(fill.token.id, fill.token);
    for (const entry of Object.values(pool.derivedEdits ?? {})) {
      byId.set(entry.token.id, entry.token);
    }
    return buildRoleDisplayTokens(
      draftFills,
      pool.derivedEdits,
      view.assignments,
      byId,
    );
  }, [draftFills, pool.derivedEdits, pool.manual, view.tokens, view.assignments]);

  const anchors: Anchors = draft.anchors;
  const accent: AccentSuggestion | null = pool.accentChoice?.dismissed ? null : draft.accent;

  // ── Effective view: captured assignments + draft fills ──
  const effective = useMemo(() => {
    const assignments = new Map(Object.entries(view.assignments));
    const derived = new Map<string, DerivedProvenance>();
    const tokenById = new Map(view.tokens.map((t) => [t.id, t]));

    for (const fill of draftFills) {
      assignments.set(fill.role, fill.token.id);
      tokenById.set(fill.token.id, fill.token);
      if (fill.token.id.startsWith("derived_")) {
        derived.set(fill.token.id, {
          derivedFrom: fill.derivedFrom,
          method: fill.method,
          edited: fill.origin === "edited",
        });
      }
    }
    // Belt-and-suspenders: edits on captured ids must replace the merged view token.
    for (const entry of Object.values(pool.derivedEdits ?? {})) {
      tokenById.set(entry.token.id, entry.token);
    }

    const tokens: StyleSnapToken[] = [];
    const seen = new Set<string>();
    for (const token of view.tokens) {
      tokens.push(tokenById.get(token.id) ?? token);
      seen.add(token.id);
    }
    for (const fill of draftFills) {
      if (!seen.has(fill.token.id)) {
        tokens.push(tokenById.get(fill.token.id)!);
        seen.add(fill.token.id);
      }
    }

    return { assignments, derived, tokens };
  }, [view, draftFills, pool.derivedEdits]);

  const exportInput = useMemo((): ExportInput => {
    const raw = allPoolTokens(pool);
    const names = new Map<string, string>();
    for (const [id, decision] of Object.entries(pool.decisions)) {
      if (decision.name !== undefined) names.set(id, decision.name);
    }
    return {
      projectName,
      generatedAt: pool.systemCreatedAt ?? new Date().toISOString(),
      captures: pool.imports.map((imp) => imp.meta),
      rawTokenCount: raw.length,
      mergeCount: pool.merges.length,
      tokens: effective.tokens,
      rawById,
      assignments: effective.assignments,
      names,
      notes: pool.systemNotes ?? {},
      noteSources: pool.noteSources,
      derived: effective.derived,
      accentIds: effectiveAccentIds(
        pool.accentIds,
        view.tokens,
        view.assignments,
        draft.anchors.primaryColorId,
        draft.anchors.secondaryColorId,
      ),
      accentsExplicit: pool.accentIds !== undefined,
      spacingInsight: spacingInsight(view.tokens, view.assignments),
      radiusInsight: radiusInsight(view.tokens, view.assignments),
      typeInsight: typeInsight(view.tokens, draft.anchors.bodyTypographyId, pool.typeRatio),
    };
  }, [pool, projectName, effective, rawById, view.tokens, view.assignments, draft.anchors]);

  const resolvedAssignments = useMemo(
    () => Object.fromEntries(effective.assignments),
    [effective.assignments],
  );

  const checklist = useMemo(
    () =>
      computeChecklist(
        exportInput.tokens,
        exportInput.assignments,
        mergeCaptureFoundations(exportInput.captures),
      ),
    [exportInput],
  );

  const designMd = useMemo(() => generateDesignMd(exportInput), [exportInput]);

  const gapCount = useMemo(
    () => checklist.items.filter((i) => i.status === "gap").length,
    [checklist],
  );

  const systemTokens = useMemo(
    () =>
      exportInput.tokens.map((token) => {
        const name = pool.decisions[token.id]?.name;
        return name !== undefined ? { ...token, name } : token;
      }),
    [exportInput, pool.decisions],
  );

  // What the app did on its own — confessed in the header.
  const summary = useMemo(() => {
    const anchorsPicked = [
      anchors.primaryColorId,
      anchors.secondaryColorId,
      anchors.bodyTypographyId,
      anchors.baseSpacing,
    ].filter((a) => a !== undefined).length;
    return { anchorsPicked, derivedCount: draft.derivedCount };
  }, [anchors, draft.derivedCount]);

  const accentIds = useMemo(
    () =>
      effectiveAccentIds(
        pool.accentIds,
        view.tokens,
        view.assignments,
        anchors.primaryColorId,
        anchors.secondaryColorId,
      ),
    [pool.accentIds, view.tokens, view.assignments, anchors.primaryColorId, anchors.secondaryColorId],
  );

  const insights = useMemo(
    () => ({
      spacing: spacingInsight(view.tokens, view.assignments),
      radius: radiusInsight(view.tokens, view.assignments),
      type: typeInsight(view.tokens, anchors.bodyTypographyId, pool.typeRatio),
    }),
    [view.tokens, view.assignments, anchors.bodyTypographyId, pool.typeRatio],
  );

  // FR-19b — design.md gate: every system-note field filled (user or template).
  // Cleaned JSON / Figma export is never blocked — see DECISIONS §2.21.
  const notesComplete = useMemo(
    () => NOTE_FIELDS.every((f) => (pool.systemNotes?.[f.key] ?? "").trim().length > 0),
    [pool.systemNotes],
  );
  const agentExportReady = notesComplete;

  return {
    projectName,
    created,
    total,
    entries,
    exportInput,
    resolvedAssignments,
    checklist,
    designMd,
    gapCount,
    systemTokens,
    draftFills,
    roleDisplayTokens,
    anchors,
    accent,
    accentIds,
    summary,
    notesComplete,
    agentExportReady,
    excludedTokens,
    insights,
    workingTokens: view.tokens,
  };
}
