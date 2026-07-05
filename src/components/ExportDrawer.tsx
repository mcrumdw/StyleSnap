import { useMemo, useState } from "react";
import { generateCleanedJson, type ExportInput } from "../engine/export";
import { Button } from "./Button";
import { Toast } from "./Toast";

interface ExportDrawerProps {
  projectName: string;
  designMd: string;
  exportInput: ExportInput;
  gapCount: number;
  onClose: () => void;
}

function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type ExportTab = "design" | "json";

/** Post-create exports — design.md + JSON in a drawer; JSON computed lazily on open. */
export function ExportDrawer({
  projectName,
  designMd,
  exportInput,
  gapCount,
  onClose,
}: ExportDrawerProps) {
  const [tab, setTab] = useState<ExportTab>("design");
  const [toast, setToast] = useState<string | null>(null);

  const cleanedJson = useMemo(() => {
    if (tab !== "json") return "";
    return JSON.stringify(generateCleanedJson(exportInput), null, 2);
  }, [exportInput, tab]);

  const copy = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToast(`${label} copied — paste it into your AI coding tool.`);
    } catch {
      setToast("Couldn't reach the clipboard — use Download instead.");
    }
  };

  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const content = tab === "design" ? designMd : cleanedJson;

  return (
    <div className="fixed inset-0 z-dropdown flex justify-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Export"
        className="flex h-full w-full max-w-2xl flex-col gap-4 overflow-hidden border-l-2 border-border-default bg-surface-card p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-section-header font-bold">Your system's ready. Ship it.</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border-2 border-border-default px-2 py-1 font-mono text-caption text-text-muted hover:bg-state-disabled-bg"
          >
            Close
          </button>
        </div>

        <p className="text-caption text-text-muted">
          No account — <strong>the JSON export is your save file</strong>.
          {gapCount > 0 && ` ${gapCount} open gap${gapCount === 1 ? "" : "s"} flagged in both exports.`}
        </p>

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
            onClick={() => copy(content, tab === "design" ? "design.md" : "Cleaned JSON")}
          >
            Copy
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() =>
              download(
                tab === "design" ? "design.md" : `${slug || "stylesnap"}-tokens.json`,
                content,
                tab === "design" ? "text/markdown" : "application/json",
              )
            }
          >
            Download
          </Button>
        </div>

        <pre className="min-h-0 flex-1 overflow-auto rounded-sm border-2 border-border-default bg-surface-page p-4 font-mono text-caption text-text-primary">
          {content}
        </pre>

        {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
      </div>
    </div>
  );
}
