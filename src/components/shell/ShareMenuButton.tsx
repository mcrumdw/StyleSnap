import { Share2 } from "lucide-react";
import { useState } from "react";
import { getAgentExportBlockers } from "../../state/agentExportBlockers";
import { useSession } from "../../state/SessionProvider";
import { Button } from "../Button";
import { ModalPortal } from "../ModalPortal";
import { useDialog } from "../useDialog";
import { ShareExportModal, type ShareExportKind } from "./ShareExportModal";

/** Mobile header — share export picker. */
export function ShareMenuButton() {
  const { pool } = useSession();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exportKind, setExportKind] = useState<ShareExportKind | null>(null);
  const dialogRef = useDialog(() => setPickerOpen(false));
  const noteBlockers = getAgentExportBlockers(pool.systemNotes);

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
        className="shrink-0 px-2"
        aria-label="Share"
        onClick={() => setPickerOpen(true)}
      >
        <Share2 className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      </Button>
      {pickerOpen && (
        <ModalPortal>
          <div
            className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
            onClick={() => setPickerOpen(false)}
          >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Share"
            className="flex w-full max-w-sm flex-col gap-2 rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:px-5 sm:pb-5 sm:pt-8"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="px-1 font-mono text-badge font-medium text-text-muted">Share</p>
            <Button type="button" size="sm" variant="secondary" className="w-full justify-start" onClick={() => openExport("design-md")}>
              Share with agent
              {!noteBlockers.complete && (
                <span className="ml-auto font-mono text-badge font-normal text-warning-text">
                  {noteBlockers.filled}/{noteBlockers.total} notes
                </span>
              )}
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
        </ModalPortal>
      )}
      {exportKind && <ShareExportModal kind={exportKind} onClose={() => setExportKind(null)} />}
    </>
  );
}
