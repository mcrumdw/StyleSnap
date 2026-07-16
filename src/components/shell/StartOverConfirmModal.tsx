import { Button } from "../Button";
import { useDialog } from "../useDialog";
import { START_OVER_WARNING } from "./session-actions";

interface StartOverConfirmModalProps {
  onConfirm: () => void;
  onClose: () => void;
}

/** Confirm before clearing the session — warning styling, not a native alert. */
export function StartOverConfirmModal({ onConfirm, onClose }: StartOverConfirmModalProps) {
  const dialogRef = useDialog(onClose);

  return (
    <div
      className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Start over"
        className="flex w-full max-w-sm flex-col gap-4 rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-card-title font-bold">Start over?</h2>
        <p className="rounded-sm border-2 border-warning bg-surface-card p-3 text-caption text-warning-text">
          {START_OVER_WARNING}
        </p>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            Yes, start over
          </Button>
          <Button type="button" variant="secondary" size="sm" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
