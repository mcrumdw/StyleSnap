import { useState } from "react";
import { getAgentExportBlockers } from "../../state/agentExportBlockers";
import { useSession } from "../../state/SessionProvider";
import { Button } from "../Button";
import { ShareExportModal, type ShareExportKind } from "./ShareExportModal";

const shareBtn =
  "w-fit max-w-full self-start justify-start px-2 font-heading text-caption font-bold";

/** Left-rail share entry points — secondary buttons, visually distinct from session links. */
export function ShareNavSection({ className = "" }: { className?: string }) {
  const { pool } = useSession();
  const [open, setOpen] = useState<ShareExportKind | null>(null);
  const noteBlockers = getAgentExportBlockers(pool.systemNotes);

  return (
    <>
      <div className={`flex flex-col gap-2 ${className}`}>
        <span className="px-1 font-mono text-badge font-medium text-text-muted">Share</span>
        <nav aria-label="Share exports" className="flex flex-col gap-2">
          <Button type="button" size="sm" variant="secondary" className={shareBtn} onClick={() => setOpen("design-md")}>
            Share with agent
            {!noteBlockers.complete && (
              <span className="ml-1 font-mono text-badge font-normal text-warning-text">
                {noteBlockers.filled}/{noteBlockers.total}
              </span>
            )}
          </Button>
          <Button type="button" size="sm" variant="secondary" className={shareBtn} onClick={() => setOpen("figma")}>
            Share with Figma
          </Button>
        </nav>
      </div>
      {open && <ShareExportModal kind={open} onClose={() => setOpen(null)} />}
    </>
  );
}
