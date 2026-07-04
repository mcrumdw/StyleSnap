import type { Checklist } from "../engine/completeness";
import { Button } from "./Button";
import { useDialog } from "./useDialog";

interface CreateSystemDialogProps {
  projectName: string;
  reviewedCount: number;
  rawCount: number;
  mergeCount: number;
  checklist: Checklist;
  /** The design.md that will be generated — shown as the preview. */
  designMdPreview: string;
  onConfirm: () => void;
  onClose: () => void;
}

/** PRD §7.8 FR-23 — the Create System gate: preview → finalize → merges lock. */
export function CreateSystemDialog({
  projectName,
  reviewedCount,
  rawCount,
  mergeCount,
  checklist,
  designMdPreview,
  onConfirm,
  onClose,
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
        className="flex max-h-full w-full max-w-2xl flex-col gap-4 overflow-hidden rounded-lg border-2 border-border-default bg-surface-card p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-section-header font-bold">
          Create "{projectName}"?
        </h2>
        <p className="text-base text-text-muted">
          {rawCount} raw tokens → {reviewedCount} reviewed ({mergeCount} merge
          {mergeCount === 1 ? "" : "s"}). This finalizes the system:{" "}
          <strong>merges lock</strong> and the exports below become available.
        </p>

        {requiredOpen > 0 ? (
          <p className="rounded-sm border-2 border-warning bg-surface-card p-3 text-caption text-warning-text">
            {requiredOpen} required role{requiredOpen === 1 ? " is" : "s are"} still
            unassigned. You can create anyway — they'll be flagged in §Gaps of every
            export so nothing gets guessed downstream.
          </p>
        ) : (
          <p className="rounded-sm border-2 border-success bg-surface-card p-3 text-caption text-success-text">
            All {checklist.requiredTotal} required checklist items are met.
          </p>
        )}

        <pre className="min-h-0 flex-1 overflow-auto rounded-sm border-2 border-border-default bg-surface-page p-4 font-mono text-caption text-text-primary">
          {designMdPreview}
        </pre>

        <div className="flex items-center gap-4">
          <Button onClick={onConfirm}>Create System</Button>
          <Button variant="secondary" onClick={onClose}>
            Keep reviewing
          </Button>
        </div>
      </div>
    </div>
  );
}
