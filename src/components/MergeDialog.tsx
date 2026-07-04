import { useEffect, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { DedupCluster } from "../engine/dedup";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { TokenPreview } from "./TokenPreview";

interface MergeDialogProps {
  cluster: DedupCluster;
  onMerge: (survivorId: string, mergedIds: string[]) => void;
  onClose: () => void;
}

function distanceCaption(token: StyleSnapToken, distance: number, level: "duplicate" | "similar"): string {
  if (level === "duplicate") return "exact duplicate";
  switch (token.type) {
    case "color":
      return `ΔE ${distance.toFixed(3)}`;
    case "spacing":
    case "border-radius":
    case "border-width":
      return `Δ ${distance}px`;
    default:
      return "similar";
  }
}

/**
 * DESIGN.md §5.1 merge dialog: the cluster listed with the canonical
 * candidate first, per-token distances in mono caption. The user picks the
 * survivor (canonical preselected) — "Merge into this" or "Keep separate".
 */
export function MergeDialog({ cluster, onMerge, onClose }: MergeDialogProps) {
  const [survivorId, setSurvivorId] = useState(cluster.canonical.id);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const rows = [
    { token: cluster.canonical, caption: "canonical — most used", level: null },
    ...cluster.members.map((m) => ({
      token: m.token,
      caption: distanceCaption(m.token, m.distance, m.level),
      level: m.level,
    })),
  ];
  const allIds = rows.map((r) => r.token.id);

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center bg-text-primary/50 p-6"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Merge duplicates"
        className="max-h-full w-full max-w-xl overflow-y-auto rounded-lg border-2 border-border-default bg-surface-card p-6 shadow-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-heading text-card-title font-medium">
          {rows.length} values that look like one
        </h2>
        <p className="mt-1 text-caption text-text-muted">
          Pick the survivor — it inherits every occurrence and context. Reversible until Create
          System.
        </p>

        <div className="mt-4 flex flex-col gap-3">
          {rows.map(({ token, caption, level }) => {
            const selected = token.id === survivorId;
            return (
              <button
                key={token.id}
                type="button"
                onClick={() => setSurvivorId(token.id)}
                aria-pressed={selected}
                className={`flex items-center justify-between gap-4 rounded-md border-2 bg-surface-card p-3 text-left ${
                  selected ? "border-brand-primary" : "border-border-default"
                }`}
              >
                <TokenPreview token={token} />
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {level && <Badge variant={level === "duplicate" ? "dup" : "sim"} />}
                  <span className="font-mono text-caption text-text-muted">{caption}</span>
                  <span className="text-caption text-text-muted">
                    ×{token.occurrences} · {token.source}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="mt-6 flex items-center gap-4">
          <Button onClick={() => onMerge(survivorId, allIds.filter((id) => id !== survivorId))}>
            Merge into this
          </Button>
          <Button variant="secondary" onClick={onClose}>
            Keep separate
          </Button>
        </div>
      </div>
    </div>
  );
}
