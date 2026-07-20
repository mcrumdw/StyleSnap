import { useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Instant hover/focus tip for toolbar controls (matches webtool InfoHint). */
export function InfoHint({
  content,
  label = "How this works",
}: {
  content: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) {
      setPos(null);
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    const tipWidth = 220;
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - tipWidth / 2),
      window.innerWidth - tipWidth - 8,
    );
    setPos({ top: rect.bottom + 6, left });
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className="info-hint-wrap"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <button type="button" className="info-hint" aria-label={label} aria-describedby={open ? tipId : undefined}>
        ?
      </button>
      {open &&
        pos &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            className="info-hint-tip"
            style={{ top: pos.top, left: pos.left }}
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}
