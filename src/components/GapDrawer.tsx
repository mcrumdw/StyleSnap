import { useState } from "react";
import type { TokenType } from "../contract/types";
import type { Checklist, ChecklistItem } from "../engine/completeness";
import { Button } from "./Button";

interface GapDrawerProps {
  checklist: Checklist;
  onClose: () => void;
  onAssignRole: (role: string) => void;
  onAddToken: (preset: { tokenType: TokenType; role?: string }) => void;
}

const SEVERITY_STYLES: Record<ChecklistItem["severity"], string> = {
  required: "border-error",
  recommended: "border-warning",
  info: "border-border-default",
};

function GapRow({
  item,
  onAssignRole,
  onAddToken,
}: {
  item: ChecklistItem;
  onAssignRole: (role: string) => void;
  onAddToken: GapDrawerProps["onAddToken"];
}) {
  const role = item.action?.role ?? (item.id.startsWith("unassigned-") ? undefined : item.id);
  return (
    <li
      className={`flex items-center justify-between gap-4 rounded-md border-2 bg-surface-card p-3 ${SEVERITY_STYLES[item.severity]}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-caption font-medium text-text-primary">{item.label}</span>
        <span className="text-caption text-text-muted">{item.description}</span>
      </div>
      <div className="flex shrink-0 gap-2">
        {role && !item.id.startsWith("unassigned-") && (
          <Button size="sm" variant="secondary" onClick={() => onAssignRole(role)}>
            Assign role
          </Button>
        )}
        {item.action && (
          <Button size="sm" variant="secondary" onClick={() => onAddToken(item.action!)}>
            Add token
          </Button>
        )}
      </div>
    </li>
  );
}

/** FR-18 gaps — slide-over drawer; gaps only (met items hidden by default). */
export function GapDrawer({ checklist, onClose, onAssignRole, onAddToken }: GapDrawerProps) {
  const [showOptional, setShowOptional] = useState(false);
  const [showMet, setShowMet] = useState(false);

  const gaps = checklist.items.filter((i) => i.status === "gap");
  const met = checklist.items.filter((i) => i.status === "met");
  const requiredGaps = gaps.filter((i) => i.severity === "required");
  const optionalGaps = gaps.filter((i) => i.severity !== "required");

  return (
    <div className="fixed inset-0 z-dropdown flex justify-end" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="System gaps"
        className="flex h-full w-full max-w-md flex-col gap-4 overflow-hidden border-l-2 border-border-default bg-surface-card p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-heading text-card-title font-medium">System completeness</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm border-2 border-border-default px-2 py-1 font-mono text-caption text-text-muted hover:bg-state-disabled-bg"
          >
            Close
          </button>
        </div>

        <div className="flex items-center justify-between gap-4">
          <span className="font-mono text-caption text-text-muted">
            {checklist.requiredMet}/{checklist.requiredTotal} required
          </span>
          <div className="h-2 flex-1 overflow-hidden rounded-sm bg-state-disabled-bg">
            <div
              className="h-full bg-success"
              style={{ width: `${(checklist.requiredMet / checklist.requiredTotal) * 100}%` }}
            />
          </div>
        </div>

        <p className="text-caption text-text-muted">
          {checklist.complete
            ? "Core system complete — optional gaps below."
            : "Almost there — a few roles still need a home."}
        </p>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {requiredGaps.length > 0 && (
            <ul className="flex flex-col gap-2">
              {requiredGaps.map((item) => (
                <GapRow
                  key={item.id}
                  item={item}
                  onAssignRole={onAssignRole}
                  onAddToken={onAddToken}
                />
              ))}
            </ul>
          )}

          {optionalGaps.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowOptional((o) => !o)}
                className="text-left font-mono text-caption text-text-muted underline decoration-dotted"
              >
                {showOptional ? "Hide" : "Show"} optional ({optionalGaps.length})
              </button>
              {showOptional && (
                <ul className="flex flex-col gap-2">
                  {optionalGaps.map((item) => (
                    <GapRow
                      key={item.id}
                      item={item}
                      onAssignRole={onAssignRole}
                      onAddToken={onAddToken}
                    />
                  ))}
                </ul>
              )}
            </div>
          )}

          {met.length > 0 && (
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setShowMet((m) => !m)}
                className="text-left font-mono text-caption text-text-muted underline decoration-dotted"
              >
                {showMet ? "Hide" : "View"} completed ({met.length})
              </button>
              {showMet && (
                <div className="flex flex-wrap gap-2">
                  {met.map((item) => (
                    <span
                      key={item.id}
                      className="inline-flex items-center rounded-sm border-2 border-success bg-surface-page px-2 py-1 font-mono text-badge text-success-text"
                    >
                      ✓ {item.label}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
