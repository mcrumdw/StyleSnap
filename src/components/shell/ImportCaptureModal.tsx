import type { StyleSnapExport } from "../../contract/types";
import type { SystemNotes } from "../../engine/export";
import { ImportZone } from "../ImportZone";
import { ModalPortal } from "../ModalPortal";
import { useDialog } from "../useDialog";

interface ImportCaptureModalProps {
  onImport: (data: StyleSnapExport, notes?: SystemNotes) => void;
  onClose: () => void;
}

/** Paste / upload another capture without leaving the current session page. */
export function ImportCaptureModal({ onImport, onClose }: ImportCaptureModalProps) {
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
          aria-label="Add new capture"
          className="flex max-h-[min(90dvh,100%)] w-full max-w-2xl flex-col gap-4 overflow-y-auto rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-card-title font-bold">Add new capture</h2>
            <p className="text-caption text-text-muted">
              Tokens merge into your current draft — roles and edits you already made stay put.
            </p>
          </div>
          <ImportZone
            onImport={(data, notes) => {
              onImport(data, notes);
              onClose();
            }}
          />
        </div>
      </div>
    </ModalPortal>
  );
}
