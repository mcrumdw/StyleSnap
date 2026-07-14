import { useState } from "react";
import type { TokenType } from "../contract/types";
import type { Checklist, ChecklistItem } from "../engine/completeness";
import { Button } from "./Button";

interface GapPanelProps {
  checklist: Checklist;
  onAssignRole: (role: string) => void;
  onAddToken: (preset: { tokenType: TokenType; role?: string }) => void;
  onOpenNotes?: () => void;
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
  onOpenNotes,
}: {
  item: ChecklistItem;
  onAssignRole: (role: string) => void;
  onAddToken: GapPanelProps["onAddToken"];
  onOpenNotes?: () => void;
}) {
  const role = item.action?.role ?? (item.id.startsWith("unassigned-") ? undefined : item.id);
  const isNotesGap = item.id === "manual-foundations";

  return (
    <li
      className={`flex flex-col gap-3 rounded-md border-2 bg-surface-card p-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 ${SEVERITY_STYLES[item.severity]}`}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <span className="font-mono text-caption font-medium text-text-primary">{item.label}</span>
        <span className="text-caption text-text-muted">{item.description}</span>
      </div>
      <div className="flex flex-wrap gap-2 sm:shrink-0">
        {role && !item.id.startsWith("unassigned-") && (
          <Button size="sm" variant="secondary" onClick={() => onAssignRole(role)}>
            Assign role
          </Button>
        )}
        {item.action && !isNotesGap && (
          <Button size="sm" variant="secondary" onClick={() => onAddToken(item.action!)}>
            Add token
          </Button>
        )}
        {isNotesGap && onOpenNotes && (
          <Button size="sm" variant="secondary" onClick={onOpenNotes}>
            Add notes
          </Button>
        )}
      </div>
    </li>
  );
}

/** Remaining gaps inline — only what the draft couldn't fill (notes, optional roles). */
export function GapPanel({ checklist, onAssignRole, onAddToken, onOpenNotes }: GapPanelProps) {
  const [showOptional, setShowOptional] = useState(false);

  const gaps = checklist.items.filter(
    (i) => i.status === "gap" && i.id !== "manual-foundations",
  );
  const requiredGaps = gaps.filter((i) => i.severity === "required");
  const optionalGaps = gaps.filter((i) => i.severity !== "required");

  if (gaps.length === 0) return null;

  return (
    <section id="gaps-section" className="flex w-full flex-col gap-4 rounded-md border-2 border-border-default bg-surface-page p-6">
      <div className="flex flex-col gap-1">
        <h2 className="font-heading text-card-title font-bold">Still needs your input</h2>
        <p className="text-caption text-text-muted">
          Everything else was filled automatically. Only true blockers appear here — describe your
          system on the Describe page before export.
        </p>
      </div>

      {requiredGaps.length > 0 && (
        <ul className="flex flex-col gap-2">
          {requiredGaps.map((item) => (
            <GapRow
              key={item.id}
              item={item}
              onAssignRole={onAssignRole}
              onAddToken={onAddToken}
              onOpenNotes={onOpenNotes}
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
                  onOpenNotes={onOpenNotes}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
