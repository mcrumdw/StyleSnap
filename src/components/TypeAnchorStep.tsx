import { useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { Anchors, AnchorOverrides } from "../engine/derive-system";
import { Button } from "./Button";

interface TypeAnchorStepProps {
  anchors: Anchors;
  tokens: StyleSnapToken[];
  onSetAnchor: (patch: Partial<AnchorOverrides>) => void;
}

/**
 * Typography page — body text style anchor. The type scale steps up and down
 * from this pick; swapping cascades derivation (never over user edits, C.8).
 */
export function TypeAnchorStep({ anchors, tokens, onSetAnchor }: TypeAnchorStepProps) {
  const [open, setOpen] = useState(false);
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const body = anchors.bodyTypographyId ? byId.get(anchors.bodyTypographyId) : undefined;

  const typeCandidates = tokens.filter(
    (t) => t.type === "typography" && !t.id.startsWith("derived_"),
  );

  return (
    <section className="flex w-full flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {body && body.type === "typography" ? (
            <span className="flex flex-col">
              <span className="font-heading text-card-title font-medium">Text style</span>
              <span className="font-mono text-caption text-text-muted">
                {body.value.fontFamily} · {body.value.fontSize}px / {body.value.fontWeight}
              </span>
            </span>
          ) : (
            <span className="text-caption text-text-muted">No typography captured yet.</span>
          )}
        </div>
        <Button size="sm" variant="secondary" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          {open ? "Done" : "Swap"}
        </Button>
      </div>
      <p className="text-caption text-text-muted">
        Your text style — the whole type scale steps up and down from it.
      </p>
      {open && (
        <div className="flex flex-wrap gap-2">
          {typeCandidates.map((t) => {
            if (t.type !== "typography") return null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSetAnchor({ bodyTypographyId: t.id });
                  setOpen(false);
                }}
                aria-pressed={t.id === anchors.bodyTypographyId}
                className={`rounded-sm border-2 px-2 py-1 font-mono text-badge ${
                  t.id === anchors.bodyTypographyId ? "border-brand-primary" : "border-border-default"
                }`}
              >
                {t.value.fontFamily} {t.value.fontSize}px/{t.value.fontWeight} · ×{t.occurrences}
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
