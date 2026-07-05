import { useMemo } from "react";
import { computeChecklist } from "../engine/completeness";
import { applyMerges, detectClusters } from "../engine/dedup";
import { generateDesignMd, type ExportInput } from "../engine/export";
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

/** Shared session state derived from the pool — one source for Home, StepBar, and steps. */
export function useSessionViewModel(pool: TokenPool) {
  const projectName = pool.projectName ?? defaultProjectName(pool);
  const created = isSystemCreated(pool);
  const total = poolTokenCount(pool);
  const entries = useMemo(() => poolEntries(pool), [pool]);

  const exportInput = useMemo((): ExportInput => {
    const raw = poolTokens(pool);
    const view = applyMerges(raw.map((token) => ({ token })), pool.merges).map((e) => e.token);
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
      tokens: view,
      rawById: new Map(raw.map((t) => [t.id, t])),
      assignments: new Map(Object.entries(resolveAssignments(pool.assignments, pool.merges))),
      names,
    };
  }, [pool, projectName]);

  const resolvedAssignments = useMemo(
    () => resolveAssignments(pool.assignments, pool.merges),
    [pool.assignments, pool.merges],
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

  const openClusterCount = useMemo(() => {
    const view = applyMerges(entries, pool.merges);
    const clusters = detectClusters(
      view.map((e) => e.token),
      "default",
    );
    return clusters.filter((c) => c.members.length > 1).length;
  }, [entries, pool.merges]);

  const step: PipelineStep = clampStep(pool.currentStep ?? 1);

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
    openClusterCount,
    step,
  };
}
