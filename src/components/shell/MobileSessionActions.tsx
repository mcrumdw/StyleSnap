import { FilePlus, RotateCcw } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StyleSnapExport } from "../../contract/types";
import type { SystemNotes } from "../../engine/export";
import { Button } from "../Button";
import { useSession } from "../../state/SessionProvider";
import { ImportCaptureModal } from "./ImportCaptureModal";
import { StartOverConfirmModal } from "./StartOverConfirmModal";

const iconBtn = "shrink-0 px-2";

const startOverBtn = `${iconBtn} border-warning text-warning-text shadow-card hover:border-warning hover:bg-surface-page`;

/** Mobile header — merge another capture into the current draft. */
export function AddCaptureMenuButton() {
  const { addImport, pool } = useSession();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleImport = (data: StyleSnapExport, notes?: SystemNotes) => {
    const showWelcome = !pool.adjectives?.length;
    addImport(data, notes);
    if (showWelcome) navigate("/describe", { state: { fromImport: true } });
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={iconBtn}
        aria-label="Add new capture"
        onClick={() => setOpen(true)}
      >
        <FilePlus className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      </Button>
      {open && <ImportCaptureModal onImport={handleImport} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Mobile header — clear session and return to import. */
export function StartOverMenuButton() {
  const { startOver } = useSession();
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className={startOverBtn}
        aria-label="Start over"
        onClick={() => setConfirmOpen(true)}
      >
        <RotateCcw className="size-5 shrink-0" strokeWidth={2} aria-hidden />
      </Button>
      {confirmOpen && (
        <StartOverConfirmModal onConfirm={startOver} onClose={() => setConfirmOpen(false)} />
      )}
    </>
  );
}
