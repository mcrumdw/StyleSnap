import { Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "../Button";
import { useDialog } from "../useDialog";
import { ShareExportModal, type ShareExportKind } from "./ShareExportModal";

/** Compact Share control — picker then copy/download modal. */
export function ShareMenuButton() {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportKind, setExportKind] = useState<ShareExportKind | null>(null);
  const dialogRef = useDialog(() => setPickerOpen(false));

  const openExport = (kind: ShareExportKind) => {
    setPickerOpen(false);
    setExportKind(kind);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        aria-label="share Snap"
        onClick={() => setPickerOpen(true)}
      >
        <Share2 className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      </Button>
      {pickerOpen && (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
          onClick={() => setPickerOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Choose share destination"
            className="flex w-full max-w-sm flex-col gap-2 rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:px-5 sm:pb-5 sm:pt-8"
            onClick={(e) => e.stopPropagation()}
          >
            <Button type="button" size="sm" className="w-full justify-start" onClick={() => openExport("design-md")}>
              Share with agent
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              className="w-full justify-start"
              onClick={() => openExport("figma")}
            >
              Share with Figma
            </Button>
            <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => setPickerOpen(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      {exportKind && <ShareExportModal kind={exportKind} onClose={() => setExportKind(null)} />}
    </>
  );
}
