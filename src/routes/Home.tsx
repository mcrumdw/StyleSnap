import { useMemo, useState } from "react";
import { Button } from "../components/Button";
import { CreateSystemDialog } from "../components/CreateSystemDialog";
import { EmptyState } from "../components/EmptyState";
import { ExportPanel } from "../components/ExportPanel";
import { ImportZone } from "../components/ImportZone";
import { SystemView } from "../components/SystemView";
import { Workspace } from "../components/Workspace";
import { computeChecklist } from "../engine/completeness";
import { applyMerges } from "../engine/dedup";
import { generateCleanedJson, generateDesignMd, type ExportInput } from "../engine/export";
import {
  defaultProjectName,
  importLabel,
  isSystemCreated,
  poolTokenCount,
  poolTokens,
  resolveAssignments,
} from "../state/pool";
import { usePool } from "../state/usePool";
import { poolEntries } from "../state/workspace";

type Tab = "workspace" | "system";

export function Home() {
  const {
    pool,
    addImport,
    mergeCluster,
    unmerge,
    setName,
    assign,
    unassign,
    addManual,
    updateManual,
    removeManual,
    setProjectName,
    createSystem,
    startOver,
  } = usePool();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [tab, setTab] = useState<Tab>("workspace");

  const entries = useMemo(() => poolEntries(pool), [pool]);
  const total = poolTokenCount(pool);
  const hasTokens = pool.imports.length > 0;
  const created = isSystemCreated(pool);
  const projectName = pool.projectName ?? defaultProjectName(pool);

  // Everything the export engine needs (FR-23/24/25), derived from the pool.
  // generatedAt is pinned at Create System so re-exports are byte-identical;
  // before that it only feeds the preview.
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

  const checklist = useMemo(
    () => computeChecklist(exportInput.tokens, exportInput.assignments),
    [exportInput],
  );
  const designMd = useMemo(() => generateDesignMd(exportInput), [exportInput]);
  const cleanedJson = useMemo(
    () => JSON.stringify(generateCleanedJson(exportInput), null, 2),
    [exportInput],
  );
  const gapCount = useMemo(
    () => checklist.items.filter((i) => i.status === "gap").length,
    [checklist],
  );

  // The system view shows the reviewed tokens with user names overlaid.
  const systemTokens = useMemo(
    () =>
      exportInput.tokens.map((token) => {
        const name = pool.decisions[token.id]?.name;
        return name !== undefined ? { ...token, name } : token;
      }),
    [exportInput, pool.decisions],
  );
  const resolvedAssignments = useMemo(
    () => resolveAssignments(pool.assignments, pool.merges),
    [pool.assignments, pool.merges],
  );

  return (
    <main id="main" className="mx-auto flex max-w-container flex-col items-center gap-12 px-6 py-12">
      {!hasTokens ? (
        <>
          <EmptyState heading="Nothing snapped yet" message="Drop a capture to begin." />
          <ImportZone onImport={addImport} />
        </>
      ) : (
        <>
          <header className="flex w-full flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <h1 className="font-heading text-page-title font-bold">Token workspace</h1>
              <p className="text-base text-text-muted">
                {total} token{total === 1 ? "" : "s"} from{" "}
                {pool.imports.map((imp) => importLabel(imp.meta)).join(" + ")}. Auto-saved — a
                refresh won't lose anything.
              </p>
            </div>
            <div className="flex items-end gap-4">
              <label className="flex flex-col gap-1">
                <span className="text-caption font-medium text-text-muted">Project name</span>
                <input
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  aria-label="Project name"
                  className="h-btn-sm rounded-sm border-2 border-border-default bg-surface-card px-3 text-base text-text-primary"
                />
              </label>
              {!created && (
                <Button onClick={() => setShowCreateDialog(true)}>Create System</Button>
              )}
            </div>
          </header>

          {created && (
            <ExportPanel
              projectName={projectName}
              designMd={designMd}
              cleanedJson={cleanedJson}
              gapCount={gapCount}
            />
          )}

          {/* Phase 8 — workspace ↔ system view tabs. */}
          <nav
            role="tablist"
            aria-label="Views"
            className="flex w-full gap-2 border-b-2 border-border-default"
          >
            {(
              [
                ["workspace", "Workspace"],
                ["system", "System"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-0.5 rounded-t-sm border-2 border-b-0 px-4 py-2 font-heading text-card-title font-bold ${
                  tab === id
                    ? "border-border-default bg-surface-card text-text-primary"
                    : "border-transparent text-text-muted hover:text-text-primary"
                }`}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "workspace" ? (
            <Workspace
              entries={entries}
              merges={pool.merges}
              decisions={pool.decisions}
              assignments={pool.assignments}
              onMergeCluster={mergeCluster}
              onUnmerge={unmerge}
              onSetName={setName}
              onAssign={assign}
              onUnassign={unassign}
              onAddManual={addManual}
              onUpdateManual={updateManual}
              onRemoveManual={removeManual}
              locked={created}
            />
          ) : (
            <SystemView
              tokens={systemTokens}
              assignments={resolvedAssignments}
              onGoToChecklist={() => setTab("workspace")}
            />
          )}

          <section className="flex w-full flex-col gap-4 border-t-2 border-border-default pt-12">
            <h2 className="font-heading text-section-header font-bold">
              Import another capture
            </h2>
            <ImportZone onImport={addImport} />
            <div>
              <Button
                variant="destructive"
                onClick={() => {
                  if (window.confirm("Start over? This clears every imported token.")) {
                    startOver();
                  }
                }}
              >
                Start over
              </Button>
            </div>
          </section>

          {showCreateDialog && (
            <CreateSystemDialog
              projectName={projectName}
              reviewedCount={exportInput.tokens.length}
              rawCount={exportInput.rawTokenCount}
              mergeCount={exportInput.mergeCount}
              checklist={checklist}
              designMdPreview={designMd}
              onConfirm={() => {
                createSystem();
                setShowCreateDialog(false);
              }}
              onClose={() => setShowCreateDialog(false)}
            />
          )}
        </>
      )}
    </main>
  );
}
