import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import { computeChecklist } from "../engine/completeness";
import { applyMerges, detectClusters, type DedupCluster, type MergeRecord } from "../engine/dedup";
import { deriveSystem, type Anchors, type AccentSuggestion } from "../engine/derive-system";
import { generateDesignMd, type DerivedProvenance, type ExportInput } from "../engine/export";
import type { PipelineStep } from "./pipeline";
import { clampStep } from "./pipeline";
import {
  defaultProjectName,
  isSystemCreated,
  poolTokenCount,
  poolTokens,
  resolveAssignments,
  type TokenPool,
} from "./pool";
import { poolEntries } from "./workspace";

/** How a value got into the draft — drives the three visual states (10b). */
export type FillOrigin = "captured" | "derived" | "edited";

export interface DraftFill {
  role: string;
  token: StyleSnapToken;
  origin: FillOrigin;
  derivedFrom: string;
  method: string;
}

/** Shared session state derived from the pool — one source for Home, StepBar, and steps. */
export function useSessionViewModel(pool: TokenPool) {
  const projectName = pool.projectName ?? defaultProjectName(pool);
  const created = isSystemCreated(pool);
  const total = poolTokenCount(pool);
  const entries = useMemo(() => poolEntries(pool), [pool]);

  // ── The dedup pipeline: confirmed merges → open cluster proposals ──
  const mergedEntries = useMemo(() => applyMerges(entries, pool.merges), [entries, pool.merges]);

  const mergeQueue = useMemo((): DedupCluster[] => {
    const rejected = new Set(pool.rejectedClusters ?? []);
    return detectClusters(
      mergedEntries.map((e) => e.token),
      "default",
    ).filter((c) => c.members.length > 1 && !rejected.has(c.id));
  }, [mergedEntries, pool.rejectedClusters]);

  // ── Cluster-canonical view (10b): open proposals collapse to canonicals so
  // the draft exists before review and refines live as merges are decided. ──
  const canonical = useMemo(() => {
    const proposed: MergeRecord[] = mergeQueue.map((c) => ({
      survivorId: c.canonical.id,
      mergedIds: c.members.map((m) => m.token.id).filter((id) => id !== c.canonical.id),
      mergedAt: "proposed",
    }));
    const merges = [...pool.merges, ...proposed];
    const tokens = applyMerges(entries, merges).map((e) => e.token);
    const assignments = resolveAssignments(pool.assignments, merges);
    return { tokens, assignments };
  }, [entries, pool.merges, pool.assignments, mergeQueue]);

  const rawById = useMemo(
    () => new Map(poolTokens(pool).map((t) => [t.id, t])),
    [pool],
  );

  // ── Derivation (10a): the auto-completed draft, edits overlaid (C.8) ──
  const draft = useMemo(
    () =>
      deriveSystem({
        tokens: canonical.tokens,
        rawById,
        assignments: new Map(Object.entries(canonical.assignments)),
        overrides: pool.anchorOverrides,
        typeRatio: pool.typeRatio,
      }),
    [canonical, rawById, pool.anchorOverrides, pool.typeRatio],
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
    const assignments = new Map(Object.entries(canonical.assignments));
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
      } else if (fill.origin === "captured" && fill.method.startsWith("anchor")) {
        derived.set(fill.token.id, {
          derivedFrom: fill.derivedFrom,
          method: fill.method,
          edited: false,
        });
      }
    }
    return { assignments, derived, tokens: [...canonical.tokens, ...syntheticTokens] };
  }, [canonical, draftFills]);

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
      unreviewedMerges: mergeQueue.length,
    };
  }, [pool, projectName, effective, rawById, mergeQueue.length]);

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

  // The confession strip (10b): what the app did, in three counts.
  const summary = useMemo(() => {
    const anchorsPicked = [
      anchors.primaryColorId,
      anchors.bodyTypographyId,
      anchors.baseSpacing,
    ].filter((a) => a !== undefined).length;
    return {
      proposedMerges: mergeQueue.length,
      anchorsPicked,
      derivedCount: draft.derivedCount,
    };
  }, [anchors, mergeQueue.length, draft.derivedCount]);

  const step: PipelineStep = clampStep(pool.currentStep ?? 3);

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
    openClusterCount: mergeQueue.length,
    mergeQueue,
    draftFills,
    anchors,
    accent,
    summary,
    step,
  };
}
