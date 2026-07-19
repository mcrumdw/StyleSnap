import { useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import { Button } from "./Button";
import { ModalPortal } from "./ModalPortal";
import { useDialog } from "./useDialog";

interface MergeSurvivorDialogProps {
  members: Array<StyleSnapToken & { type: "color" }>;
  currentSurvivorId: string;
  onPick: (survivorId: string) => void;
  onClose: () => void;
}

/**
 * Re-pick which hex in an existing merge cluster is the system survivor.
 * Same member set — only which value the primitives / derivation use.
 */
export function MergeSurvivorDialog({
  members,
  currentSurvivorId,
  onPick,
  onClose,
}: MergeSurvivorDialogProps) {
  const [survivorId, setSurvivorId] = useState(currentSurvivorId);
  const dialogRef = useDialog(onClose);

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
          aria-label="Choose merged color"
          className="max-h-[min(90dvh,100%)] w-full max-w-md overflow-y-auto rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <h2 className="font-heading text-card-title font-medium">
            Choose the merged color
          </h2>
          <p className="mt-1 text-caption text-text-muted">
            These colors were merged into one. Pick which hex the system keeps.
            From snap still shows every capture.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            {members.map((token) => {
              const selected = token.id === survivorId;
              const translucent = token.opacity < 1;
              return (
                <button
                  key={token.id}
                  type="button"
                  onClick={() => setSurvivorId(token.id)}
                  aria-pressed={selected}
                  className={`flex items-center gap-3 rounded-md border-2 bg-surface-page p-3 text-left ${
                    selected ? "border-brand-primary" : "border-border-default"
                  }`}
                >
                  <span
                    className="size-10 shrink-0 rounded-sm border-2 border-border-default"
                    style={{ backgroundColor: token.value, opacity: token.opacity }}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block font-mono text-caption text-text-primary">
                      {token.value}
                      {translucent ? ` @ ${Math.round(token.opacity * 100)}%` : ""}
                      {token.id === currentSurvivorId ? " · current" : ""}
                    </span>
                    <span className="block truncate font-mono text-badge text-text-muted">
                      ×{token.occurrences}
                      {token.context?.element ? ` · <${token.context.element}>` : ""}
                      {token.source ? ` · ${token.source}` : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Button
              className="w-full sm:w-auto"
              onClick={() => {
                onPick(survivorId);
                onClose();
              }}
              disabled={survivorId === currentSurvivorId}
            >
              Use this color
            </Button>
            <Button className="w-full sm:w-auto" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
