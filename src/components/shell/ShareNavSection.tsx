import { useState } from "react";
import { Button } from "../Button";
import { ShareExportModal, type ShareExportKind } from "./ShareExportModal";

const shareBtn =
  "w-full justify-start rounded-sm border-2 border-transparent px-3 py-2 font-heading text-caption font-bold text-text-muted hover:border-border-default hover:text-text-primary";

/** Left-rail share entry points — each opens a copy/download modal. */
export function ShareNavSection({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState<ShareExportKind | null>(null);

  return (
    <>
      <nav aria-label="Share exports" className={`flex flex-col gap-1 ${className}`}>
        <Button type="button" size="sm" variant="ghost" className={shareBtn} onClick={() => setOpen("design-md")}>
          Share with agent
        </Button>
        <Button type="button" size="sm" variant="ghost" className={shareBtn} onClick={() => setOpen("figma")}>
          Share with Figma
        </Button>
      </nav>
      {open && <ShareExportModal kind={open} onClose={() => setOpen(null)} />}
    </>
  );
}
