import type { ReactNode } from "react";

interface EmptyStateProps {
  heading: string;
  message: string;
  action?: ReactNode;
}

// DESIGN.md §5/§6 — oversized heading, one line of text-muted, single CTA.
export function EmptyState({ heading, message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h2 className="font-heading text-page-title font-bold text-text-primary">
        {heading}
      </h2>
      <p className="text-base text-text-muted">{message}</p>
      {action}
    </div>
  );
}
