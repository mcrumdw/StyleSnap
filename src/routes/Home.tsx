import { Button } from "../components/Button";
import { Card } from "../components/Card";
import { EmptyState } from "../components/EmptyState";
import { ImportZone } from "../components/ImportZone";
import { importLabel, poolTokenCount } from "../state/pool";
import { usePool } from "../state/usePool";

export function Home() {
  const { pool, addImport, startOver } = usePool();
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
            <h1 className="font-heading text-page-title font-bold">Token pool</h1>
            <p className="text-base text-text-muted">
              {total} token{total === 1 ? "" : "s"} from {pool.imports.length} capture
              {pool.imports.length === 1 ? "" : "s"}. Auto-saved — a refresh won't lose anything.
            </p>
          </header>

          <div className="grid w-full grid-cols-2 gap-6">
            {pool.imports.map((imp) => (
              <Card key={imp.importId} className="flex flex-col gap-2">
                <h2 className="font-heading text-card-title font-medium">
                  {importLabel(imp.meta)}
                </h2>
                <p className="font-mono text-caption text-text-muted">
                  {imp.tokens.length} tokens · schema v{imp.meta.version} · imported{" "}
                  {new Date(imp.importedAt).toLocaleString()}
                </p>
              </Card>
            ))}
          </div>

          <section className="flex w-full flex-col gap-4">
            <h2 className="font-heading text-section-header font-bold">Import another capture</h2>
            <ImportZone onImport={addImport} />
          </section>

          <div className="flex w-full">
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
        </>
      )}
    </main>
  );
}
