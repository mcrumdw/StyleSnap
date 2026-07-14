type BadgeVariant = "dup" | "sim" | "merged";

// DESIGN.md §5.1 — all badges use text-primary text on their fill color.
const variants: Record<BadgeVariant, { bg: string; label: string }> = {
  dup: { bg: "bg-brand-accent", label: "DUP" },
  sim: { bg: "bg-brand-pop", label: "~SIM" },
  merged: { bg: "bg-success", label: "MERGED" },
};

export function Badge({ variant }: { variant: BadgeVariant }) {
  const { bg, label } = variants[variant];
  return (
    <span
      className={`inline-flex items-center rounded-sm border-2 border-border-default px-2 py-1 font-mono text-badge font-medium text-text-primary ${bg}`}
    >
      {label}
    </span>
  );
}
