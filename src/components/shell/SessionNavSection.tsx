import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StyleSnapExport } from "../../contract/types";
import type { SystemNotes } from "../../engine/export";
import { Button } from "../Button";
import { useSession } from "../../state/SessionProvider";
import { ImportCaptureModal } from "./ImportCaptureModal";
import { StartOverConfirmModal } from "./StartOverConfirmModal";

const sessionBtn =
  "w-fit max-w-full self-start justify-start rounded-sm border-2 border-transparent px-2 py-1 font-heading text-caption font-bold text-text-muted hover:border-border-default hover:text-text-primary";

/** Left-rail — merge another capture into the current draft. */
export function SessionNavSection({ className = "" }: { className?: string }) {
  const { addImport, pool } = useSession();
  const navigate = useNavigate();
  const [importOpen, setImportOpen] = useState(false);

  const handleImport = (data: StyleSnapExport, notes?: SystemNotes) => {
    const showWelcome = !pool.adjectives?.length;
    addImport(data, notes);
    if (showWelcome) navigate("/describe", { state: { fromImport: true } });
  };

  return (
    <>
      <nav aria-label="Session management" className={`flex flex-col gap-1 ${className}`}>
        <Button type="button" size="sm" variant="ghost" className={sessionBtn} onClick={() => setImportOpen(true)}>
          Add new capture
        </Button>
      </nav>
      {importOpen && (
        <ImportCaptureModal onImport={handleImport} onClose={() => setImportOpen(false)} />
      )}
    </>
  );
}

/** Left-rail — destructive reset, pinned below share actions. */
export function StartOverRailButton({ className = "" }: { className?: string }) {
  const { startOver } = useSession();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <nav aria-label="Reset session" className={`border-t-2 border-border-default pt-4 ${className}`}>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className={`${sessionBtn} text-warning-text hover:border-warning hover:text-warning-text`}
          onClick={() => setConfirmOpen(true)}
        >
          Start over
        </Button>
      </nav>
      {confirmOpen && (
        <StartOverConfirmModal onConfirm={startOver} onClose={() => setConfirmOpen(false)} />
      )}
    </>
  );
}
