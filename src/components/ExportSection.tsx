import { useMemo, useState } from "react";
import { generateCleanedJson, type ExportInput } from "../engine/export";
import { Button } from "./Button";
import { Toast } from "./Toast";

interface ExportSectionProps {
  projectName: string;
  designMd: string;
  exportInput: ExportInput;
  gapCount: number;
  onCopyDesignMd?: () => void;
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

/** Phase 10 step 4 — inline export home (drawer content without overlay). */
export function ExportSection({
  projectName,
  designMd,
  exportInput,
  gapCount,
  onCopyDesignMd,
}: ExportSectionProps) {
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
      if (label === "design.md") onCopyDesignMd?.();
    } catch {
      setToast("Couldn't reach the clipboard — use Download instead.");
    }
  };

  const slug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const content = tab === "design" ? designMd : cleanedJson;

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

      <pre className="max-h-96 overflow-auto rounded-sm border-2 border-border-default bg-surface-page p-4 font-mono text-caption text-text-primary">
        {content}
      </pre>

      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </section>
  );
}
