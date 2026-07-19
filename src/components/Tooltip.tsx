import type { ReactNode } from "react";

interface TooltipProps {
  /** Plain-language explanation shown on hover / focus. */
  content: string;
  children: ReactNode;
  className?: string;
}

/**
 * Lightweight title-based tooltip. Keeps copy out of the layout; use for
 * layer/role/origin hints (DESIGN.md — no invented chrome).
 */
export function Tooltip({ content, children, className = "" }: TooltipProps) {
  return (
    <span className={`inline-flex items-center ${className}`} title={content}>
      {children}
    </span>
  );
}

/** Small “(i)” affordance that carries a tooltip. */
export function InfoHint({ content, label = "More info" }: { content: string; label?: string }) {
  return (
    <Tooltip content={content}>
      <span
        role="img"
        aria-label={label}
        className="inline-flex h-4 w-4 cursor-help items-center justify-center rounded-full border-2 border-border-default font-mono text-badge leading-none text-text-muted"
      >
        i
      </span>
    </Tooltip>
  );
}
