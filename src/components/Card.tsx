import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  selected?: boolean;
}

export function Card({ selected = false, className = "", ...props }: CardProps) {
  return (
    <div
      className={`rounded-md border-2 bg-surface-card p-6 shadow-card ${
        selected ? "border-brand-primary" : "border-border-default"
      } ${className}`}
      {...props}
    />
  );
}
