import { useMemo } from "react";
import { Button } from "../components/Button";
import { EmptyState } from "../components/EmptyState";
import { ImportZone } from "../components/ImportZone";
import { Workspace } from "../components/Workspace";
import { importLabel, poolTokenCount } from "../state/pool";
import { usePool } from "../state/usePool";
import { poolEntries } from "../state/workspace";

export function Home() {
  const {
    pool,
    addImport,
    mergeCluster,
    unmerge,
    decide,
    addManual,
    updateManual,
    removeManual,
    startOver,
  } = usePool();
  const entries = useMemo(() => poolEntries(pool), [pool]);
  const total = poolTokenCount(pool);
  const hasTokens = pool.imports.length > 0;

  return (
    <main className="mx-auto flex max-w-container flex-col items-center gap-12 px-6 py-12">
      {!hasTokens ? (
        <>
          <EmptyState heading="Nothing snapped yet" message="Drop a capture to begin." />
          <ImportZone onImport={addImport} />
        </>
      ) : (
        <>
          <header className="flex w-full flex-col gap-2">
            <h1 className="font-heading text-page-title font-bold">Token workspace</h1>
            <p className="text-base text-text-muted">
              {total} token{total === 1 ? "" : "s"} from{" "}
              {pool.imports.map((imp) => importLabel(imp.meta)).join(" + ")}. Auto-saved — a
              refresh won't lose anything.
            </p>
          </header>

          <Workspace
            entries={entries}
            merges={pool.merges}
            decisions={pool.decisions}
            onMergeCluster={mergeCluster}
            onUnmerge={unmerge}
            onDecide={decide}
            onAddManual={addManual}
            onUpdateManual={updateManual}
            onRemoveManual={removeManual}
          />

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
        </>
      )}
    </main>
  );
}
