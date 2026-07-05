import { useState } from "react";
import { Button } from "./Button";
import { Toast } from "./Toast";

interface ExportPanelProps {
  projectName: string;
  designMd: string;
  cleanedJson: string;
  gapCount: number;
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

/** PRD §7.8 — the two exports (FR-24/25), copy-to-clipboard + file download. */
export function ExportPanel({ projectName, designMd, cleanedJson, gapCount }: ExportPanelProps) {
  const [toast, setToast] = useState<string | null>(null);

  const copy = async (content: string, label: string) => {
    try {
      await navigator.clipboard.writeText(content);
      setToast(`${label} copied — paste it into your AI coding tool.`);
    } catch {
      setToast("Couldn't reach the clipboard — use Download instead.");
    }
  };

  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  return (
    <section className="flex w-full flex-col gap-6 rounded-md border-2 border-border-default bg-surface-card p-6 shadow-card">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-section-header font-bold">
          Your system's ready. Ship it.
        </h2>
        <p className="text-base text-text-muted">
          Remember: there's no account — <strong>the JSON export is your save file</strong>.
          {gapCount > 0 && ` ${gapCount} open gap${gapCount === 1 ? " is" : "s are"} flagged in both exports.`}
        </p>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-4">
          <h3 className="font-heading text-card-title font-medium">design.md</h3>
          <span className="text-caption text-text-muted">the AI-ready source of truth</span>
          <div className="ml-auto flex gap-2">
            <Button size="sm" onClick={() => copy(designMd, "design.md")}>
              Copy
            </Button>
            <Button size="sm" variant="secondary" onClick={() => download("design.md", designMd, "text/markdown")}>
              Download
            </Button>
          </div>
        </div>
        <pre className="max-h-96 overflow-auto rounded-sm border-2 border-border-default bg-surface-page p-4 font-mono text-caption text-text-primary">
          {designMd}
        </pre>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <h3 className="font-heading text-card-title font-medium">Cleaned JSON</h3>
        <span className="text-caption text-text-muted">
          merges applied, every token named — your save file
        </span>
        <div className="ml-auto flex gap-2">
          <Button size="sm" onClick={() => copy(cleanedJson, "Cleaned JSON")}>
            Copy
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => download(`${slug || "stylesnap"}-tokens.json`, cleanedJson, "application/json")}
          >
            Download
          </Button>
        </div>
      </div>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </section>
  );
}
