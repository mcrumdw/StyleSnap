interface RoleChipProps {
  role: string;
  confirmed?: boolean;
  /** Confirmed chips are removable individually (Phase 8 — multi-role). */
  onRemove?: () => void;
}

// DESIGN.md §5.1 — dashed border + "?" suffix until the user confirms the
// role; solid border once confirmed.
export function RoleChip({ role, confirmed = false, onRemove }: RoleChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-sm border-2 border-brand-primary bg-surface-page px-2 py-1 font-mono text-caption text-brand-primary ${
        confirmed ? "border-solid" : "border-dashed"
      }`}
    >
      {role}
      {!confirmed && "?"}
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          aria-label={`Remove role ${role}`}
          className="ml-1 rounded-sm px-0.5 leading-none text-brand-primary hover:bg-state-disabled-bg"
        >
          ×
        </button>
      )}
    </span>
  );
}
