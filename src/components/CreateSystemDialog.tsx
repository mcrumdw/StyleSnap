import type { Checklist } from "../engine/completeness";
import { Button } from "./Button";
import { useDialog } from "./useDialog";

interface CreateSystemDialogProps {
  projectName: string;
  reviewedCount: number;
  rawCount: number;
  mergeCount: number;
  checklist: Checklist;
  onConfirm: () => void;
  onClose: () => void;
  onPreviewExport?: () => void;
}

/** FR-23 — lightweight Create System gate: stats + gap warning, no full markdown scroll. */
export function CreateSystemDialog({
  projectName,
  reviewedCount,
  rawCount,
  mergeCount,
  checklist,
  onConfirm,
  onClose,
  onPreviewExport,
}: CreateSystemDialogProps) {
  const dialogRef = useDialog(onClose);
  const requiredOpen = checklist.requiredTotal - checklist.requiredMet;

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-text-primary/50 p-6"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Create System"
        className="flex w-full max-w-md flex-col gap-4 rounded-lg border-2 border-border-default bg-surface-card p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-section-header font-bold">
          Create "{projectName}"?
        </h2>
        <p className="text-base text-text-muted">
          {rawCount} raw tokens → {reviewedCount} reviewed ({mergeCount} merge
          {mergeCount === 1 ? "" : "s"}). This finalizes the system:{" "}
          <strong>merges lock</strong> and exports become available from the bar above.
        </p>

        {requiredOpen > 0 ? (
          <p className="rounded-sm border-2 border-warning bg-surface-card p-3 text-caption text-warning-text">
            {requiredOpen} required role{requiredOpen === 1 ? "" : "s are"} still unassigned. You can
            create anyway — they'll be flagged in §Gaps of every export.
          </p>
        ) : (
          <p className="rounded-sm border-2 border-success bg-surface-card p-3 text-caption text-success-text">
            All {checklist.requiredTotal} required checklist items are met.
          </p>
        )}

        {onPreviewExport && (
          <button
            type="button"
            onClick={onPreviewExport}
            className="text-left font-mono text-caption text-brand-primary underline decoration-dotted"
          >
            Preview design.md before creating
          </button>
        )}

        <div className="flex items-center gap-4">
          <Button onClick={onConfirm}>
            {checklist.complete ? "Create & ship" : "Create System"}
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Keep reviewing
          </Button>
        </div>
      </div>
    </div>
  );
}
