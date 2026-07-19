import { useMemo } from "react";
import type { StyleSnapMeta, StyleSnapToken, TokenType } from "../contract/types";
import { importLabel } from "../state/pool";
import { TOKEN_TYPE_LABELS } from "../state/workspace";
import { Button } from "./Button";
import { ModalPortal } from "./ModalPortal";
import { useDialog } from "./useDialog";

const TYPE_ORDER: TokenType[] = [
  "color",
  "gradient",
  "typography",
  "spacing",
  "border-radius",
  "border-width",
  "shadow",
];

interface PostCaptureWelcomeModalProps {
  /** Tokens from the just-imported capture (or full pool if that is all there is). */
  tokens: StyleSnapToken[];
  /** Meta from the latest import — drives the source label. */
  meta: StyleSnapMeta | undefined;
  onSetVibe: () => void;
  onSkipToColors: () => void;
  onClose: () => void;
}

function countByType(tokens: StyleSnapToken[]): Array<{ type: TokenType; count: number }> {
  const counts = new Map<TokenType, number>();
  for (const t of tokens) {
    counts.set(t.type, (counts.get(t.type) ?? 0) + 1);
  }
  return TYPE_ORDER.filter((type) => (counts.get(type) ?? 0) > 0).map((type) => ({
    type,
    count: counts.get(type)!,
  }));
}

/**
 * Post-import orientation (§2.32) — scannable “what happened / what next”
 * without duplicating the adjective picker or system notes.
 */
export function PostCaptureWelcomeModal({
  tokens,
  meta,
  onSetVibe,
  onSkipToColors,
  onClose,
}: PostCaptureWelcomeModalProps) {
  const dialogRef = useDialog(onClose);
  const summary = useMemo(() => countByType(tokens), [tokens]);
  const source = meta ? importLabel(meta) : "Your capture";

  return (
    <ModalPortal>
      <div
        className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
        onClick={onClose}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-capture-welcome-title"
          className="flex max-h-[min(90dvh,100%)] w-full max-w-lg flex-col gap-5 overflow-y-auto rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex flex-col gap-2">
            <p className="font-mono text-badge font-medium uppercase tracking-wide text-brand-primary">
              Snap landed
            </p>
            <h2
              id="post-capture-welcome-title"
              className="font-heading text-card-title font-bold text-text-primary"
            >
              Your snap is in
            </h2>
            <p className="text-caption text-text-muted">
              From <span className="font-medium text-text-primary">{source}</span>
              {tokens.length > 0 ? (
                <>
                  {" "}
                  — {tokens.length} token{tokens.length === 1 ? "" : "s"} ready to review.
                </>
              ) : null}
            </p>
          </div>

          {summary.length > 0 && (
            <ul className="flex flex-wrap gap-2" aria-label="Tokens by type">
              {summary.map(({ type, count }) => (
                <li
                  key={type}
                  className="rounded-sm border-2 border-border-default bg-surface-page px-2 py-1 font-mono text-badge text-text-primary"
                >
                  {TOKEN_TYPE_LABELS[type]} · {count}
                </li>
              ))}
            </ul>
          )}

          <ol className="flex flex-col gap-3">
            <li className="flex gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-sm border-2 border-border-default bg-brand-pop font-mono text-badge font-medium text-text-primary"
                aria-hidden
              >
                1
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-caption font-bold text-text-primary">
                  Review the snap
                </span>
                <span className="text-caption text-text-muted">
                  On each category page, From snap shows what came in — exclude noise, keep the rest.
                </span>
              </div>
            </li>
            <li className="flex gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-sm border-2 border-border-default bg-brand-pop font-mono text-badge font-medium text-text-primary"
                aria-hidden
              >
                2
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-caption font-bold text-text-primary">
                  Set the vibe
                </span>
                <span className="text-caption text-text-muted">
                  We don’t invent colors for what you already snapped. Picks only shape empty slots —
                  type scale, secondary harmony, radius, and shadows.
                </span>
              </div>
            </li>
            <li className="flex gap-3">
              <span
                className="flex size-7 shrink-0 items-center justify-center rounded-sm border-2 border-border-default bg-brand-pop font-mono text-badge font-medium text-text-primary"
                aria-hidden
              >
                3
              </span>
              <div className="flex flex-col gap-0.5">
                <span className="font-heading text-caption font-bold text-text-primary">
                  Name roles & export
                </span>
                <span className="text-caption text-text-muted">
                  Point semantic roles at primitives, then ship design.md. System notes help your AI
                  agent; Figma export works without them.
                </span>
              </div>
            </li>
          </ol>

          <p className="rounded-sm border-2 border-dashed border-border-default bg-surface-page p-3 text-caption text-text-muted">
            Captured values stay yours. Style bias only fills derived gaps — never overwrites what
            you snapped.
          </p>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                onSetVibe();
                onClose();
              }}
            >
              Set the vibe
            </Button>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                onSkipToColors();
                onClose();
              }}
            >
              Skip to colors
            </Button>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
