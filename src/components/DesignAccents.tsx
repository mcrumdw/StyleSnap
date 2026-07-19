import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import { Button } from "./Button";

interface DesignAccentsProps {
  tokens: StyleSnapToken[];
  accentIds: string[];
  /** True when the list was user-edited (not pure auto-seed). */
  explicit: boolean;
  onRemove: (tokenId: string) => void;
  onResetAuto: () => void;
}

/**
 * "Design accents — use sparingly": captured colors that aren't primary,
 * secondary, or role-assigned. Auto-seeded; chip "auto" until the user touches
 * the list (§2.25).
 */
export function DesignAccents({
  tokens,
  accentIds,
  explicit,
  onRemove,
  onResetAuto,
}: DesignAccentsProps) {
  const byId = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);
  const accents = accentIds
    .map((id) => byId.get(id))
    .filter((t): t is StyleSnapToken & { type: "color" } => t?.type === "color");

  if (accents.length === 0 && !explicit) return null;

  return (
    <section className="flex w-full flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-card-title font-medium">
            Design accents — use sparingly
          </h3>
          <p className="text-caption text-text-muted">
            Colors from your snap that aren&apos;t primary, secondary, or a role. Keep them for
            highlights — not every surface.
            {!explicit && (
              <>
                {" "}
                <span className="font-mono text-badge text-text-muted">auto</span> seeded from the
                capture.
              </>
            )}
          </p>
        </div>
        {explicit && (
          <Button size="sm" variant="ghost" onClick={onResetAuto}>
            Reset to auto
          </Button>
        )}
      </div>

      {accents.length === 0 ? (
        <p className="text-caption text-text-muted">No accents — add one from the colors above.</p>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {accents.map((token) => (
            <li
              key={token.id}
              className="flex items-center gap-2 rounded-md border-2 border-border-default bg-surface-page px-2 py-1.5"
            >
              <span
                className="size-6 rounded-sm border-2 border-border-default"
                style={{ backgroundColor: token.value }}
                aria-hidden
              />
              <span className="font-mono text-badge text-text-primary">{token.value}</span>
              {!explicit && (
                <span className="font-mono text-badge text-text-muted" title="Auto-seeded from capture">
                  auto
                </span>
              )}
              <button
                type="button"
                aria-label={`Remove accent ${token.value}`}
                onClick={() => onRemove(token.id)}
                className="rounded-sm border-2 border-border-default px-1 font-mono text-caption leading-none text-text-muted hover:border-brand-primary hover:text-brand-primary"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
