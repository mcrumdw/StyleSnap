import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
  /** Plain-language explanation shown on hover / focus. */
  content: string;
  children: ReactNode;
  className?: string;
}

interface TipPos {
  top: number;
  left: number;
}

/**
 * Instant hover/focus teaching tip (not the browser `title` delay).
 * Portals to `document.body` so sticky / overflow parents don't clip it.
 */
export function Tooltip({ content, children, className = "" }: TooltipProps) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<TipPos | null>(null);
  const wrapRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) {
      setPos(null);
      return;
    }
    const rect = wrapRef.current.getBoundingClientRect();
    const tipWidth = 256; // w-64
    const left = Math.min(
      Math.max(8, rect.left + rect.width / 2 - tipWidth / 2),
      window.innerWidth - tipWidth - 8,
    );
    setPos({ top: rect.bottom + 8, left });
  }, [open]);

  return (
    <span
      ref={wrapRef}
      className={`relative inline-flex items-center ${className}`}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      {children}
      {open &&
        pos &&
        createPortal(
          <span
            id={tipId}
            role="tooltip"
            style={{ top: pos.top, left: pos.left }}
            className="pointer-events-none fixed z-dropdown w-64 rounded-md border-2 border-border-default bg-surface-card p-3 text-left font-body text-caption font-medium text-text-primary shadow-card"
          >
            {content}
          </span>,
          document.body,
        )}
    </span>
  );
}

/** Teaching affordance — prominent “?” tip, shows instantly on hover/focus. */
export function InfoHint({
  content,
  label = "How this works",
}: {
  content: string;
  label?: string;
}) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        aria-label={label}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-border-default bg-brand-pop font-mono text-badge font-bold leading-none text-text-primary shadow-card hover:border-brand-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        ?
      </button>
    </Tooltip>
  );
}
