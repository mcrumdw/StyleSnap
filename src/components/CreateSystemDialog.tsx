import type { Checklist } from "../engine/completeness";
import { Button } from "./Button";
import { ModalPortal } from "./ModalPortal";
import { useDialog } from "./useDialog";

interface CreateSystemDialogProps {
  projectName: string;
  reviewedCount: number;
  rawCount: number;
  mergeCount: number;
  checklist: Checklist;
  /** Phase 10 guardrail stats — automated values, confessed here. */
  derivedCount?: number;
  totalValues?: number;
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
  derivedCount = 0,
  totalValues = 0,
  onConfirm,
  onClose,
  onPreviewExport,
}: CreateSystemDialogProps) {
  const dialogRef = useDialog(onClose);
  const requiredOpen = checklist.requiredTotal - checklist.requiredMet;

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label="Create System"
          className="flex max-h-[min(90dvh,100%)] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
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

          {derivedCount > 0 && (
            <p className="rounded-sm border-2 border-border-default bg-surface-page p-3 text-caption text-text-primary">
              {derivedCount} of {totalValues} values were filled in automatically — all marked in
              the export&apos;s provenance.
            </p>
          )}

          {requiredOpen > 0 ? (
            <p className="rounded-sm border-2 border-warning bg-surface-card p-3 text-caption text-warning-text">
              {requiredOpen} required role{requiredOpen === 1 ? "" : "s are"} still unassigned. You can
              create anyway — they&apos;ll be flagged in §Gaps of every export.
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

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-4">
            <Button className="w-full sm:w-auto" onClick={onConfirm}>
              {checklist.complete ? "Create & ship" : "Create System"}
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={onClose}>
              Keep reviewing
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
