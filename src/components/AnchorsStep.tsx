import { useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { Anchors, AnchorOverrides } from "../engine/derive-system";
import { fallbackName } from "../engine/roles";
import { isNeutral } from "../engine/derive-system/oklch";
import { Button } from "./Button";

interface AnchorsStepProps {
  anchors: Anchors;
  /** The cluster-canonical tokens the anchors point into. */
  tokens: StyleSnapToken[];
  onSetAnchor: (patch: Partial<AnchorOverrides>) => void;
  /** Role corrections (EditRolesPanel) rendered below by the parent. */
  children?: React.ReactNode;
}

const nameOf = (t: StyleSnapToken) => t.name ?? fallbackName(t);

/**
 * Phase 10b — the three anchors, presented plainly ("your main color / your
 * text style / your base unit"). Swapping cascades the derivation live —
 * never over user-edited values (C.8).
 */
export function AnchorsStep({ anchors, tokens, onSetAnchor, children }: AnchorsStepProps) {
  const [open, setOpen] = useState<null | "color" | "type" | "spacing">(null);
  const byId = new Map(tokens.map((t) => [t.id, t]));

  const primary = anchors.primaryColorId ? byId.get(anchors.primaryColorId) : undefined;
  const body = anchors.bodyTypographyId ? byId.get(anchors.bodyTypographyId) : undefined;

  const colorCandidates = tokens.filter(
    (t): t is StyleSnapToken & { type: "color"; value: string } =>
      t.type === "color" && t.opacity === 1 && !t.id.startsWith("derived_") && !isNeutral(t.value),
  );
  const typeCandidates = tokens.filter(
    (t) => t.type === "typography" && !t.id.startsWith("derived_"),
  );
  const spacingChoices = [
    ...new Set(
      tokens
        .filter((t): t is StyleSnapToken & { type: "spacing"; value: number } => t.type === "spacing")
        .map((t) => Math.max(4, Math.round(t.value / 4) * 4)),
    ),
  ].sort((a, b) => a - b);

  const card = (
    key: "color" | "type" | "spacing",
    title: string,
    summary: React.ReactNode,
    picker: React.ReactNode,
  ) => (
    <div className="flex flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">{summary}</div>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => setOpen(open === key ? null : key)}
          aria-expanded={open === key}
        >
          {open === key ? "Done" : "Swap"}
        </Button>
      </div>
      <p className="text-caption text-text-muted">{title}</p>
      {open === key && <div className="flex flex-wrap gap-2">{picker}</div>}
    </div>
  );

  return (
    <section className="flex w-full flex-col gap-8">
      <div className="grid gap-4 md:grid-cols-3">
        {card(
          "color",
          "Your main color — hover shades, neutrals, and feedback colors are all built from it.",
          <>
            {primary && primary.type === "color" ? (
              <>
                <span
                  className="h-10 w-10 rounded-sm border-2 border-border-default"
                  style={{ backgroundColor: primary.value }}
                  aria-hidden
                />
                <span className="flex flex-col">
                  <span className="font-heading text-card-title font-medium">Main color</span>
                  <span className="font-mono text-caption text-text-muted">
                    {nameOf(primary)} · {primary.value}
                  </span>
                </span>
              </>
            ) : (
              <span className="text-caption text-text-muted">No color captured yet.</span>
            )}
          </>,
          colorCandidates.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                onSetAnchor({ primaryColorId: t.id });
                setOpen(null);
              }}
              aria-pressed={t.id === anchors.primaryColorId}
              title={`${nameOf(t)} · ${t.value}`}
              className={`flex items-center gap-2 rounded-sm border-2 px-2 py-1 ${
                t.id === anchors.primaryColorId ? "border-brand-primary" : "border-border-default"
              }`}
            >
              <span
                className="h-6 w-6 rounded-sm border-2 border-border-default"
                style={{ backgroundColor: t.value }}
                aria-hidden
              />
              <span className="font-mono text-badge">{t.value}</span>
            </button>
          )),
        )}

        {card(
          "type",
          "Your text style — the whole type scale steps up and down from it.",
          <>
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
          </>,
          typeCandidates.map((t) => {
            if (t.type !== "typography") return null;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => {
                  onSetAnchor({ bodyTypographyId: t.id });
                  setOpen(null);
                }}
                aria-pressed={t.id === anchors.bodyTypographyId}
                className={`rounded-sm border-2 px-2 py-1 font-mono text-badge ${
                  t.id === anchors.bodyTypographyId ? "border-brand-primary" : "border-border-default"
                }`}
              >
                {t.value.fontFamily} {t.value.fontSize}px/{t.value.fontWeight} · ×{t.occurrences}
              </button>
            );
          }),
        )}

        {card(
          "spacing",
          "Your base unit — the spacing scale ramps up from it on the 4px grid.",
          <span className="flex flex-col">
            <span className="font-heading text-card-title font-medium">Base unit</span>
            <span className="font-mono text-caption text-text-muted">
              {anchors.baseSpacing !== undefined ? `${anchors.baseSpacing}px` : "none yet"}
            </span>
          </span>,
          spacingChoices.map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                onSetAnchor({ baseSpacing: v });
                setOpen(null);
              }}
              aria-pressed={v === anchors.baseSpacing}
              className={`rounded-sm border-2 px-2 py-1 font-mono text-badge ${
                v === anchors.baseSpacing ? "border-brand-primary" : "border-border-default"
              }`}
            >
              {v}px
            </button>
          )),
        )}
      </div>

      {children}
    </section>
  );
}
