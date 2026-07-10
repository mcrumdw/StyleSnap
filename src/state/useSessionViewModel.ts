import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import { computeChecklist } from "../engine/completeness";
import { applyMerges } from "../engine/dedup";
import { deriveSystem, type Anchors, type AccentSuggestion } from "../engine/derive-system";
import { generateDesignMd, type DerivedProvenance, type ExportInput } from "../engine/export";
import {
  defaultProjectName,
  isSystemCreated,
  poolTokenCount,
  poolTokens,
  resolveAssignments,
  type TokenPool,
} from "./pool";
import { poolEntries } from "./workspace";

/** How a value got into the draft — drives the visual states. */
export type FillOrigin = "captured" | "derived" | "edited";

export interface DraftFill {
  role: string;
  token: StyleSnapToken;
  origin: FillOrigin;
  derivedFrom: string;
  method: string;
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

  const rawById = useMemo(() => new Map(poolTokens(pool).map((t) => [t.id, t])), [pool]);

  // ── Derivation (10a): the auto-completed draft, edits overlaid (C.8) ──
  const draft = useMemo(
    () =>
      deriveSystem({
        tokens: view.tokens,
        rawById,
        assignments: new Map(Object.entries(view.assignments)),
        overrides: pool.anchorOverrides,
        typeRatio: pool.typeRatio,
      }),
    [view, rawById, pool.anchorOverrides, pool.typeRatio],
  );

  const draftFills = useMemo((): DraftFill[] => {
    return draft.fills.map((fill) => {
      const synthetic = fill.token.id.startsWith("derived_");
      const edit = synthetic ? pool.derivedEdits?.[fill.role] : undefined;
      if (edit) {
        return { ...fill, token: edit.token, origin: "edited" as const };
      }
      return { ...fill, origin: synthetic ? ("derived" as const) : ("captured" as const) };
    });
  }, [draft, pool.derivedEdits]);

  const anchors: Anchors = draft.anchors;
  const accent: AccentSuggestion | null = pool.accentChoice?.dismissed ? null : draft.accent;

  // ── Effective view: captured assignments + draft fills ──
  const effective = useMemo(() => {
    const assignments = new Map(Object.entries(view.assignments));
    const derived = new Map<string, DerivedProvenance>();
    const syntheticTokens: StyleSnapToken[] = [];
    for (const fill of draftFills) {
      assignments.set(fill.role, fill.token.id);
      if (fill.token.id.startsWith("derived_")) {
        syntheticTokens.push(fill.token);
        derived.set(fill.token.id, {
          derivedFrom: fill.derivedFrom,
          method: fill.method,
          edited: fill.origin === "edited",
        });
      }
    }
    return { assignments, derived, tokens: [...view.tokens, ...syntheticTokens] };
  }, [view, draftFills]);

  const exportInput = useMemo((): ExportInput => {
    const raw = poolTokens(pool);
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
      derived: effective.derived,
    };
  }, [pool, projectName, effective, rawById]);

  const resolvedAssignments = useMemo(
    () => Object.fromEntries(effective.assignments),
    [effective.assignments],
  );

  const checklist = useMemo(
    () => computeChecklist(exportInput.tokens, exportInput.assignments),
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
      anchors.bodyTypographyId,
      anchors.baseSpacing,
    ].filter((a) => a !== undefined).length;
    return { anchorsPicked, derivedCount: draft.derivedCount };
  }, [anchors, draft.derivedCount]);

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
    anchors,
    accent,
    summary,
  };
}
