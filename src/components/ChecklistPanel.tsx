import type { TokenType } from "../contract/types";
import type { Checklist, ChecklistItem } from "../engine/completeness";
import { Button } from "./Button";

interface ChecklistPanelProps {
  checklist: Checklist;
  onAddToken: (preset: { tokenType: TokenType; role?: string }) => void;
}

const SEVERITY_STYLES: Record<ChecklistItem["severity"], string> = {
  required: "border-error",
  recommended: "border-warning",
  info: "border-border-default",
};

function GapRow({ item, onAddToken }: { item: ChecklistItem; onAddToken: ChecklistPanelProps["onAddToken"] }) {
  return (
    <li
      className={`flex items-center justify-between gap-4 rounded-md border-2 bg-surface-card p-3 ${SEVERITY_STYLES[item.severity]}`}
    >
      <div className="flex flex-col gap-1">
        <span className="font-mono text-caption font-medium text-text-primary">{item.label}</span>
        <span className="text-caption text-text-muted">{item.description}</span>
      </div>
      {item.action && (
        <Button size="sm" variant="secondary" onClick={() => onAddToken(item.action!)}>
          Add token
        </Button>
      )}
    </li>
  );
}

/** PRD §7.6 FR-18 — live completeness checklist; every unmet item actionable. */
export function ChecklistPanel({ checklist, onAddToken }: ChecklistPanelProps) {
  const gaps = checklist.items.filter((i) => i.status === "gap");
  const met = checklist.items.filter((i) => i.status === "met");
  const requiredGaps = gaps.filter((i) => i.severity === "required");
  const otherGaps = gaps.filter((i) => i.severity !== "required");

  return (
    <section className="flex w-full flex-col gap-4 rounded-md border-2 border-border-default bg-surface-card p-6 shadow-card">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-heading text-card-title font-medium">System completeness</h2>
        <span className="font-mono text-caption text-text-muted">
          {checklist.requiredMet}/{checklist.requiredTotal} required
        </span>
      </div>

      <div className="h-2 w-full overflow-hidden rounded-sm bg-state-disabled-bg">
        <div
          className="h-full bg-success"
          style={{ width: `${(checklist.requiredMet / checklist.requiredTotal) * 100}%` }}
        />
      </div>

      <p className="text-caption text-text-muted">
        {checklist.complete
          ? "Core system complete — the remaining items below are optional."
          : "Almost there — a few roles still need a home."}
      </p>

      {requiredGaps.length > 0 && (
        <ul className="flex flex-col gap-2">
          {requiredGaps.map((item) => (
            <GapRow key={item.id} item={item} onAddToken={onAddToken} />
          ))}
        </ul>
      )}
      {otherGaps.length > 0 && (
        <ul className="flex flex-col gap-2">
          {otherGaps.map((item) => (
            <GapRow key={item.id} item={item} onAddToken={onAddToken} />
          ))}
        </ul>
      )}

      {met.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {met.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-sm border-2 border-success bg-surface-card px-2 py-1 font-mono text-badge text-success-text"
            >
              ✓ {item.label}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
