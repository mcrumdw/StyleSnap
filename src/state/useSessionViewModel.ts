import { useMemo } from "react";
import { computeChecklist } from "../engine/completeness";
import { applyMerges } from "../engine/dedup";
import { generateDesignMd, type ExportInput } from "../engine/export";
import {
  defaultProjectName,
  isSystemCreated,
  poolTokenCount,
  poolTokens,
  resolveAssignments,
  type TokenPool,
} from "./pool";
import { poolEntries } from "./workspace";

/** Shared session state derived from the pool — one source for Home, SessionBar, Edit, System. */
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
  };
}
