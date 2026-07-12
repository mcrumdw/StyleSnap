import { useMemo, useState } from "react";
import { generateCleanedJson, type ExportInput } from "../engine/export";
import { downloadFile, projectSlug } from "../routes/exportActions";
import { Button } from "./Button";
import { Toast } from "./Toast";

interface ExportSectionProps {
  projectName: string;
  designMd: string;
  exportInput: ExportInput;
  gapCount: number;
  onCopyDesignMd?: () => void;
  /** FR-19b — wrap copy/download behind the completeness gate. */
  withCompleteSystem?: (action: () => void) => void;
}

function download(filename: string, content: string, mime: string) {
  downloadFile(filename, content, mime);
}

type ExportTab = "design" | "json";

/** Phase 10 step 4 — inline export home (drawer content without overlay). */
export function ExportSection({
  projectName,
  designMd,
  exportInput,
  gapCount,
  onCopyDesignMd,
  withCompleteSystem,
}: ExportSectionProps) {
  const [tab, setTab] = useState<ExportTab>("design");
  const [toast, setToast] = useState<string | null>(null);

  const cleanedJson = useMemo(() => {
    if (tab !== "json") return "";
    return JSON.stringify(generateCleanedJson(exportInput), null, 2);
  }, [exportInput, tab]);

  const copy = async (content: string, label: string) => {
    const run = async () => {
      try {
        await navigator.clipboard.writeText(content);
        setToast(`${label} copied — paste it into your AI coding tool.`);
        if (label === "design.md") onCopyDesignMd?.();
      } catch {
        setToast("Couldn't reach the clipboard — use Download instead.");
      }
    };
    if (withCompleteSystem) withCompleteSystem(() => void run());
    else void run();
  };

  const slug = projectSlug(projectName);
  const content = tab === "design" ? designMd : cleanedJson;

  const downloadExport = () => {
    const run = () =>
      download(
        tab === "design" ? "design.md" : `${slug || "stylesnap"}-tokens.json`,
        content,
        tab === "design" ? "text/markdown" : "application/json",
      );
    if (withCompleteSystem) withCompleteSystem(run);
    else run();
  };

  return (
    <section className="flex w-full flex-col gap-4 rounded-md border-2 border-border-default bg-surface-card p-6 shadow-card">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-card-title font-bold">Export</h3>
        <p className="text-caption text-text-muted">
          No account — <strong>the JSON export is your save file</strong>.
          {gapCount > 0 && ` ${gapCount} open gap${gapCount === 1 ? "" : "s"} flagged in both exports.`}
        </p>
      </div>

      <nav className="flex gap-2 border-b-2 border-border-default">
        {(
          [
            ["design", "design.md"],
            ["json", "Cleaned JSON"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`-mb-0.5 rounded-t-sm border-2 border-b-0 px-3 py-1.5 font-heading text-caption font-bold ${
              tab === id
                ? "border-border-default bg-surface-card text-text-primary"
                : "border-transparent text-text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="flex gap-2">
        <Button
          size="sm"
          onClick={() => void copy(content, tab === "design" ? "design.md" : "Cleaned JSON")}
        >
          Copy
        </Button>
        <Button size="sm" variant="secondary" onClick={downloadExport}>
          Download
        </Button>
      </div>

      <pre className="max-h-96 overflow-auto rounded-sm border-2 border-border-default bg-surface-page p-4 font-mono text-caption text-text-primary">
        {content}
      </pre>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </section>
  );
}
