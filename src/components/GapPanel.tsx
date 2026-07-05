import { useState } from "react";
import type { TokenType } from "../contract/types";
import type { Checklist, ChecklistItem } from "../engine/completeness";
import { Button } from "./Button";

interface GapPanelProps {
  checklist: Checklist;
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
  onAddToken: GapPanelProps["onAddToken"];
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

/** Phase 10 step 3 — gaps inline (drawer content without overlay). */
export function GapPanel({ checklist, onAssignRole, onAddToken }: GapPanelProps) {
  const [showOptional, setShowOptional] = useState(false);
  const [showMet, setShowMet] = useState(false);

  const gaps = checklist.items.filter((i) => i.status === "gap");
  const met = checklist.items.filter((i) => i.status === "met");
  const requiredGaps = gaps.filter((i) => i.severity === "required");
  const optionalGaps = gaps.filter((i) => i.severity !== "required");

  return (
    <section className="flex w-full flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-section-header font-bold">What's still missing</h2>
        <p className="text-caption text-text-muted">
          Captures can't include everything a full system needs — breakpoints, motion, feedback
          colors. Fill what you can; the rest is flagged in export, never guessed.
        </p>
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
        <div className="flex flex-col gap-2">
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

      {gaps.length === 0 && (
        <p className="rounded-md border-2 border-success bg-surface-card p-4 text-caption text-success-text">
          Core system complete — optional gaps may remain below.
        </p>
      )}

      {met.length > 0 && (
        <div className="flex flex-col gap-2">
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
    </section>
  );
}
