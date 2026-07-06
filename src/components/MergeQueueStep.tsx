import { useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { DedupCluster } from "../engine/dedup";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { TokenPreview } from "./TokenPreview";

interface MergeQueueStepProps {
  queue: DedupCluster[];
  onAccept: (survivorId: string, mergedIds: string[]) => void;
  onReject: (clusterId: string) => void;
  onCelebrate?: (message: string) => void;
  /** The old grid + filters, rendered behind "Show everything". */
  everything: React.ReactNode;
}

function distanceCaption(
  token: StyleSnapToken,
  distance: number,
  level: "duplicate" | "similar",
): string {
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
 * Phase 10b — proposed merges as a QUEUE ("1 of 4", accept/keep separate/
 * skip), not a badge hunt in a grid. Rejections persist; skips are session-
 * local. The old grid lives behind "Show everything".
 */
export function MergeQueueStep({
  queue,
  onAccept,
  onReject,
  onCelebrate,
  everything,
}: MergeQueueStepProps) {
  const [skipped, setSkipped] = useState<string[]>([]);
  const [survivorId, setSurvivorId] = useState<string | null>(null);
  const [showEverything, setShowEverything] = useState(false);

  const pending = queue.filter((c) => !skipped.includes(c.id));
  const cluster = pending[0];
  const position = queue.length - pending.length + 1;
  const survivor = cluster ? (survivorId ?? cluster.canonical.id) : null;

  const advance = () => setSurvivorId(null);

  return (
    <section className="flex w-full flex-col gap-6">
      {cluster && survivor ? (
        <div className="flex max-w-xl flex-col gap-4 rounded-md border-2 border-border-default bg-surface-card p-6 shadow-card">
          <div className="flex items-center justify-between">
            <h2 className="font-heading text-card-title font-medium">
              {cluster.members.length + 1} values that look like one
            </h2>
            <span className="font-mono text-caption text-text-muted">
              {position} of {queue.length}
            </span>
          </div>
          <p className="text-caption text-text-muted">
            Pick the survivor — it inherits every occurrence. Reversible until Create System.
          </p>

          <div className="flex flex-col gap-3">
            {[
              { token: cluster.canonical, caption: "our pick — most used", level: null },
              ...cluster.members
                .filter((m) => m.token.id !== cluster.canonical.id)
                .map((m) => ({
                  token: m.token,
                  caption: distanceCaption(m.token, m.distance, m.level),
                  level: m.level as "duplicate" | "similar" | null,
                })),
            ].map(({ token, caption, level }) => (
              <button
                key={token.id}
                type="button"
                onClick={() => setSurvivorId(token.id)}
                aria-pressed={token.id === survivor}
                className={`flex items-center justify-between gap-4 rounded-md border-2 bg-surface-card p-3 text-left ${
                  token.id === survivor ? "border-brand-primary" : "border-border-default"
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
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              onClick={() => {
                const memberIds = [
                  cluster.canonical.id,
                  ...cluster.members.map((m) => m.token.id),
                ];
                const mergedIds = [...new Set(memberIds)].filter((id) => id !== survivor);
                onAccept(survivor, mergedIds);
                onCelebrate?.(
                  `Nice — ${mergedIds.length + 1} values just became 1.` +
                    (pending.length > 1 ? ` ${pending.length - 1} to go.` : " All merges reviewed."),
                );
                advance();
              }}
            >
              Merge them
            </Button>
            <Button
              variant="secondary"
              onClick={() => {
                onReject(cluster.id);
                advance();
              }}
            >
              Keep separate
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setSkipped((s) => [...s, cluster.id]);
                advance();
              }}
            >
              Skip for now
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex max-w-xl flex-col gap-2 rounded-md border-2 border-border-default bg-surface-card p-6 shadow-card">
          <h2 className="font-heading text-card-title font-medium">
            {queue.length === 0 ? "No merges waiting" : "Queue done for now"}
          </h2>
          <p className="text-caption text-text-muted">
            {queue.length === 0
              ? "Everything that looked like a duplicate has been reviewed."
              : `${skipped.length} skipped — they'll come back next session.`}
          </p>
        </div>
      )}

      <label className="flex items-center gap-2 text-caption text-text-muted">
        <input
          type="checkbox"
          checked={showEverything}
          onChange={(e) => setShowEverything(e.target.checked)}
        />
        Show everything (the full captured grid, filters, manual tokens)
      </label>
      {showEverything && everything}
    </section>
  );
}
