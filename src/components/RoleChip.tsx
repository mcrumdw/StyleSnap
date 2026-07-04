interface RoleChipProps {
  role: string;
  confirmed?: boolean;
}

// DESIGN.md §5.1 — dashed border + "?" suffix until the user confirms the
// role; solid border once confirmed.
export function RoleChip({ role, confirmed = false }: RoleChipProps) {
  return (
    <span
      className={`inline-flex items-center rounded-sm border-2 border-brand-primary bg-surface-page px-2 py-1 font-mono text-caption text-brand-primary ${
        confirmed ? "border-solid" : "border-dashed"
      }`}
    >
      {role}
      {!confirmed && "?"}
    </span>
  );
}
