import { useMemo } from "react";
import { generateCleanedJson } from "../../engine/export";
import { downloadCleanedJson, downloadDesignMd } from "../../routes/exportActions";
import { agentExportBlockerMessage, getAgentExportBlockers } from "../../state/agentExportBlockers";
import { useSession } from "../../state/SessionProvider";
import { Button } from "../Button";
import { ModalPortal } from "../ModalPortal";
import { useDialog } from "../useDialog";

export type ShareExportKind = "design-md" | "figma";

interface ShareExportModalProps {
  kind: ShareExportKind;
  onClose: () => void;
}

/** Copy or download one export format — opened from the left-rail share buttons. */
export function ShareExportModal({ kind, onClose }: ShareExportModalProps) {
  const { vm, pool, withAgentExportReady, setToast } = useSession();
  const dialogRef = useDialog(onClose);
  const noteBlockers = getAgentExportBlockers(pool.systemNotes);

  const cleanedJson = useMemo(
    () => JSON.stringify(generateCleanedJson(vm.exportInput), null, 2),
    [vm.exportInput],
  );

  const isDesign = kind === "design-md";
  const title = isDesign ? "Share with agent" : "Share with Figma";
  const description = isDesign
    ? "Copy or download design.md — paste it into your AI coding agent or docs."
    : "Cleaned token JSON for the Figma plugin or Tokens Studio — slash-nested roles, provenance included.";
  const content = isDesign ? vm.designMd : cleanedJson;
  const copyLabel = isDesign ? "design.md" : "token JSON";

  const runExport = (action: () => void | Promise<void>) => {
    if (isDesign) withAgentExportReady(() => void action());
    else void action();
  };

  const copy = () => {
    runExport(async () => {
      try {
        await navigator.clipboard.writeText(content);
        setToast(`${copyLabel} copied — paste it where you need it.`);
        onClose();
      } catch {
        setToast("Couldn't reach the clipboard — use Download instead.");
      }
    });
  };

  const download = () => {
    runExport(() => {
      if (isDesign) downloadDesignMd(vm.projectName, vm.designMd);
      else downloadCleanedJson(vm.projectName, vm.exportInput);
      onClose();
    });
  };

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
        aria-label={title}
        className="flex w-full max-w-md flex-col gap-4 rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col gap-1">
          <h2 className="font-heading text-card-title font-bold">{title}</h2>
          <p className="text-caption text-text-muted">{description}</p>
          {isDesign && !vm.agentExportReady && (
            <p className="font-mono text-badge text-warning-text">
              {agentExportBlockerMessage(noteBlockers)} Finish them on the Description page or use
              Pick for me when you copy.
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={() => void copy()}>
            Copy
          </Button>
          <Button type="button" size="sm" variant="secondary" onClick={download}>
            Download
          </Button>
          <Button type="button" size="sm" variant="ghost" className="sm:ml-auto" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
