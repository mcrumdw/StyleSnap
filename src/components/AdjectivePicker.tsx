import { useEffect, useMemo, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { Anchors } from "../engine/derive-system";
import {
  ADJECTIVE_HINTS,
  ADJECTIVES,
  MAX_ADJECTIVES,
  assembleDescription,
  autoAdjectives,
  isAdjective,
  type Adjective,
  type AssembledDescription,
} from "../engine/templates";
import { Button } from "./Button";

interface AdjectivePickerProps {
  /** For "Pick for me" — the effective tokens + anchors. */
  tokens: StyleSnapToken[];
  anchors: Anchors;
  /** Previously chosen adjectives (persisted in the pool). */
  initial?: string[];
  /** Apply matched snippets (fills empty note fields). */
  onApply: (assembled: AssembledDescription, adjectives: Adjective[], options?: { refresh?: boolean }) => void;
  applyLabel?: string;
  /** When true, adjective changes live-update snippet-filled note fields. */
  livePreview?: boolean;
}

/**
 * FR-19b — describe the feel in up to five words; per-field snippets fill
 * whatever note fields are still empty. "Pick for me" derives adjectives from
 * the captured system itself — deterministic, no AI (V2).
 */
export function AdjectivePicker({
  tokens,
  anchors,
  initial = [],
  onApply,
  applyLabel = "Use this starter",
  livePreview = false,
}: AdjectivePickerProps) {
  const [picked, setPicked] = useState<Adjective[]>(initial.filter(isAdjective).slice(0, MAX_ADJECTIVES));

  const assembled = useMemo(
    () => (picked.length > 0 ? assembleDescription(picked) : null),
    [picked],
  );

  useEffect(() => {
    if (!livePreview || picked.length === 0 || !assembled) return;
    onApply(assembled, picked, { refresh: true });
  }, [livePreview, picked, assembled, onApply]);

  const toggle = (adjective: Adjective) => {
    setPicked((current) =>
      current.includes(adjective)
        ? current.filter((a) => a !== adjective)
        : current.length >= MAX_ADJECTIVES
          ? current
          : [...current, adjective],
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="text-caption font-medium text-text-primary">
          How should it feel? Pick up to five.
        </p>
        <p className="text-caption text-text-muted">
          {livePreview
            ? "Notes and style bias update as you pick — your own words are never replaced."
            : "We'll match snippets per field and tune derived tokens — your own words are never replaced."}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {ADJECTIVES.map((adjective) => {
          const active = picked.includes(adjective);
          const full = !active && picked.length >= MAX_ADJECTIVES;
          return (
            <button
              key={adjective}
              type="button"
              onClick={() => toggle(adjective)}
              aria-pressed={active}
              disabled={full}
              title={ADJECTIVE_HINTS[adjective]}
              className={`rounded-sm border-2 px-2 py-1 font-mono text-caption transition ${
                active
                  ? "border-brand-primary bg-surface-page text-brand-primary shadow-card"
                  : full
                    ? "border-state-disabled-bg text-state-disabled-text"
                    : "border-border-default bg-surface-card text-text-primary hover:border-brand-primary"
              }`}
            >
              {adjective}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        {!livePreview && (
          <Button size="sm" disabled={!assembled} onClick={() => assembled && onApply(assembled, picked)}>
            {applyLabel}
          </Button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            const auto = autoAdjectives(tokens, anchors);
            setPicked([...auto]);
            onApply(assembleDescription(auto), auto, { refresh: livePreview });
          }}
        >
          Pick for me
        </Button>
      </div>
    </div>
  );
}
