import { useRef, useState, type DragEvent } from "react";
import { parseStyleSnapExport } from "../contract/schema";
import type { StyleSnapExport } from "../contract/types";
import { sanitizeNotes, type SystemNotes } from "../engine/export";
import { importLabel } from "../state/pool";
import { Button } from "./Button";

interface ImportZoneProps {
  onImport: (data: StyleSnapExport, notes?: SystemNotes) => void;
  /** Landing uses create-system wording; session modal adds another capture. */
  variant?: "create" | "add";
}

interface ImportError {
  message: string;
  details: string[];
}

/**
 * FR-1/FR-2/FR-4 front door: paste zone (primary), file upload (secondary),
 * drag-drop. Parses with `parseStyleSnapExport` — the friendly error banner
 * and the version-mismatch warning render right here, next to the fix.
 */
export function ImportZone({ onImport, variant = "add" }: ImportZoneProps) {
  const [text, setText] = useState("");
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<ImportError | null>(null);
  const [versionWarning, setVersionWarning] = useState<string | null>(null);
  const [lastImport, setLastImport] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function importText(raw: string) {
    const result = parseStyleSnapExport(raw);
    if (!result.ok) {
      setError({ message: result.error, details: result.details });
      setVersionWarning(null);
      setLastImport(null);
      return;
    }
    // Phase 9b round-trip: cleaned JSON carries System notes in an extra
    // `notes` key the envelope ignores — lift it separately, defensively.
    let notes: SystemNotes | undefined;
    try {
      notes = sanitizeNotes((JSON.parse(raw) as { notes?: unknown }).notes);
    } catch {
      notes = undefined; // unreachable after a successful parse; belt & braces
    }
    onImport(result.data, notes);
    setLastImport(
      variant === "create"
        ? `System created — ${result.data.tokens.length} token${result.data.tokens.length === 1 ? "" : "s"} from ${importLabel(result.data.meta)}.`
        : `Imported ${result.data.tokens.length} token${result.data.tokens.length === 1 ? "" : "s"} from ${importLabel(result.data.meta)}.`,
    );
    setVersionWarning(result.versionWarning ?? null);
    setError(null);
    setText("");
  }

  async function importFile(file: File) {
    importText(await file.text());
  }

  function handleDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) {
      void importFile(file);
      return;
    }
    const dropped = event.dataTransfer.getData("text");
    if (dropped) importText(dropped);
  }

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4">
      {/* Drag affordance per DESIGN.md §5: dashed border-default at rest,
          border + tint flip to brand-primary on drag-over. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`flex flex-col items-center justify-start gap-4 rounded-md border-2 border-dashed p-6 transition ${
          dragging ? "border-brand-primary bg-brand-primary/10" : "border-border-default bg-surface-card"
        }`}
      >
        <label className="flex flex-col gap-2">
          <span className="font-heading text-card-title font-medium">
            {variant === "create" ? "Paste capture JSON" : "Paste a capture"}
          </span>
          <span className="text-caption text-text-muted">
            {variant === "create"
              ? "From the browser extension or Figma plugin — or drop a .json file in this box."
              : "Copy the JSON from the extension or the Figma plugin, paste it here — or drop the file anywhere in this box."}
          </span>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            spellCheck={false}
            placeholder='{"meta": …, "tokens": […]}'
            className="w-full resize-y rounded-sm border-2 border-border-default bg-surface-card p-3 font-mono text-caption text-text-primary placeholder:text-text-muted"
          />
        </label>

        <div className="flex items-center gap-4">
          <Button onClick={() => importText(text)} disabled={text.trim().length === 0}>
            {variant === "create" ? "Create system from JSON" : "Import tokens"}
          </Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}>
            {variant === "create" ? "Create system from file" : "Upload a file"}
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void importFile(file);
              e.target.value = ""; // allow re-selecting the same file
            }}
          />
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-md border-2 border-error bg-surface-card p-4">
          <p className="font-medium text-error">{error.message}</p>
          {error.details.length > 0 && (
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 font-mono text-caption text-text-primary">
              {error.details.map((detail) => (
                <li key={detail}>{detail}</li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-caption text-text-muted">
            Fix the JSON above and import again — nothing was added.
          </p>
        </div>
      )}

      {versionWarning && (
        <div role="status" className="rounded-md border-2 border-warning bg-surface-card p-4">
          <p className="text-caption font-medium text-warning-text">{versionWarning}</p>
        </div>
      )}

      {lastImport && !error && (
        <p role="status" className="text-caption font-medium text-success-text">
          {lastImport}
        </p>
      )}
    </section>
  );
}
