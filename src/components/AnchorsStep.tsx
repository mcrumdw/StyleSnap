import { useEffect, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { AccentSuggestion, Anchors, AnchorOverrides, Harmony } from "../engine/derive-system";
import { harmonyFromPrimary } from "../engine/derive-system";
import {
  deriveFeedback,
  deriveNeutrals,
  deriveStates,
} from "../engine/derive-system/color";
import { fallbackName } from "../engine/roles";
import { isNeutral } from "../engine/derive-system/oklch";
import type { FillOrigin } from "../state/useSessionViewModel";
import { humanValueLabel } from "../state/token-display";
import { RoleTokenPreview } from "./RoleTokenPreview";
import { Button } from "./Button";

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

const HARMONIES: Harmony[] = ["complementary", "split-complementary", "analogous"];

const HARMONY_LABELS: Record<Harmony, string> = {
  complementary: "Complementary",
  "split-complementary": "Split-complementary",
  analogous: "Analogous",
};

interface AnchorsStepProps {
  anchors: Anchors;
  /** The cluster-canonical tokens the anchors point into. */
  tokens: StyleSnapToken[];
  onSetAnchor: (patch: Partial<AnchorOverrides>) => void;
  /** C.5 — harmony accent when no secondary anchor (monochrome captures). */
  accent?: AccentSuggestion | null;
  accentHarmony?: Harmony;
  onAccentHarmony?: (harmony: Harmony) => void;
  /** Effective secondary role token (after derivation + edits). */
  secondaryToken?: StyleSnapToken;
  secondaryOrigin?: FillOrigin;
  onEditSecondary?: (token: StyleSnapToken) => void;
  onResetSecondary?: () => void;
  /** Role corrections (EditRolesPanel) rendered below by the parent. */
  children?: React.ReactNode;
}

const PRIMARY_ANCHOR_TIP = "Main brand color. Drives buttons, links, and neutrals.";
const SECONDARY_ANCHOR_TIP = "Second accent. Used for ghost buttons and alternate CTAs.";
const COLOR_FAMILY_TIP =
  "Preview of colors built from your primary. Change primary or secondary above to rebuild.";

const SWATCH_TIPS: Record<string, string> = {
  Primary: "Main actions and links.",
  Hover: "Primary button on hover.",
  Secondary: "Ghost buttons and alternate CTAs.",
  Text: "Body text.",
  Surface: "Page background.",
  Success: "Success / confirmation.",
};

function swatchTip(label: string, hex: string): string {
  return `${label} · ${hex} — ${SWATCH_TIPS[label] ?? hex}`;
}

const nameOf = (t: StyleSnapToken) => t.name ?? fallbackName(t);

function ColorFamilyPreview({
  primaryHex,
  secondaryHex,
  accentHarmony,
}: {
  primaryHex: string;
  secondaryHex?: string;
  accentHarmony?: Harmony;
}) {
  const states = deriveStates(primaryHex);
  const neutrals = deriveNeutrals(primaryHex);
  const feedback = deriveFeedback(primaryHex);

  const swatches: Array<{ label: string; hex?: string }> = [
    { label: "Primary", hex: primaryHex },
    { label: "Hover", hex: states.hover },
    { label: "Secondary", hex: secondaryHex },
    { label: "Text", hex: neutrals.textPrimary },
    { label: "Surface", hex: neutrals.surfacePage },
    { label: "Success", hex: feedback.success },
  ];

  return (
    <div className="flex flex-col gap-2">
      <p className="text-caption font-medium text-text-primary" title={COLOR_FAMILY_TIP}>
        Your color family
        {accentHarmony ? ` · ${HARMONY_LABELS[accentHarmony]}` : ""}
      </p>
      <div className="grid w-full grid-cols-3 gap-2 sm:flex sm:gap-1 md:gap-2">
        {swatches.map(({ label, hex }) => (
          <div key={label} className="flex min-w-0 flex-col items-center gap-1 sm:flex-1">
            {hex ? (
              <span
                className="h-8 w-full rounded-sm border-2 border-border-default"
                style={{ backgroundColor: hex }}
                title={swatchTip(label, hex)}
                aria-hidden
              />
            ) : (
              <span
                className="h-8 w-full rounded-sm border-2 border-dashed border-border-default bg-surface-page"
                title={`${label} — not set yet`}
                aria-hidden
              />
            )}
            <span
              className="truncate font-mono text-badge text-text-muted"
              title={hex ? swatchTip(label, hex) : `${label} — not set yet`}
            >
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorAnchorCard({
  anchorRole,
  token,
  humanLabel,
  detailLine,
  tip,
  open,
  onToggle,
  picker,
}: {
  anchorRole: string;
  token?: StyleSnapToken & { type: "color"; value: string };
  humanLabel: string;
  detailLine?: string;
  tip?: string;
  open: boolean;
  onToggle: () => void;
  picker: React.ReactNode;
}) {
  return (
    <div className="relative flex w-full min-w-0 flex-col gap-3">
      <div className="box-content flex h-[5.5rem] w-full min-w-0 items-stretch overflow-hidden rounded-md border-2 border-border-default bg-surface-card shadow-card">
        <button
          type="button"
          onClick={onToggle}
          className="flex h-full min-w-0 flex-1 items-stretch text-left hover:opacity-95"
          aria-expanded={open}
          title={tip}
        >
          {token ? (
            <RoleTokenPreview token={token} role={anchorRole} />
          ) : (
            <div
              className="flex h-full w-16 shrink-0 self-stretch border-r-2 border-border-default bg-surface-page sm:w-[5.5rem]"
              aria-hidden
            />
          )}
          <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5 px-4 py-2">
            <span className="truncate font-mono text-caption font-medium text-brand-primary">{anchorRole}</span>
            <span className="line-clamp-2 text-caption text-text-primary">{humanLabel}</span>
            {detailLine && (
              <span className="truncate font-mono text-badge text-text-muted" title={detailLine}>
                {detailLine}
              </span>
            )}
          </div>
        </button>
        <div className="flex h-full shrink-0 items-center border-l-2 border-border-default px-3 sm:px-4">
          <button
            type="button"
            onClick={onToggle}
            className="whitespace-nowrap font-mono text-caption text-text-muted underline-offset-2 hover:text-brand-primary hover:underline"
            aria-expanded={open}
          >
            {open ? "Done" : token ? "Swap" : "Set"}
          </button>
        </div>
      </div>
      {open && (
        <div className="rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">{picker}</div>
      )}
    </div>
  );
}

function SecondaryHarmonyPicker({
  primaryHex,
  accentHarmony,
  secondaryToken,
  secondaryOrigin,
  capturedSecondary,
  onAccentHarmony,
  onEditSecondary,
  onResetSecondary,
  onUseCaptured,
}: {
  primaryHex: string;
  accentHarmony?: Harmony;
  secondaryToken?: StyleSnapToken;
  secondaryOrigin?: FillOrigin;
  capturedSecondary?: StyleSnapToken & { type: "color"; value: string };
  onAccentHarmony?: (harmony: Harmony) => void;
  onEditSecondary?: (token: StyleSnapToken) => void;
  onResetSecondary?: () => void;
  onUseCaptured?: () => void;
}) {
  const harmonySuggestion = harmonyFromPrimary(primaryHex);
  const activeHarmony = accentHarmony ?? harmonySuggestion.suggested;
  const usingCaptured =
    (secondaryOrigin === "snap" || secondaryOrigin === "seeded") &&
    capturedSecondary !== undefined &&
    accentHarmony === undefined;

  const [editHex, setEditHex] = useState(
    secondaryToken?.type === "color" ? secondaryToken.value : harmonySuggestion.candidates[activeHarmony],
  );

  useEffect(() => {
    if (secondaryToken?.type === "color") setEditHex(secondaryToken.value);
    else setEditHex(harmonyFromPrimary(primaryHex).candidates[activeHarmony]);
  }, [secondaryToken, activeHarmony, primaryHex]);

  const applyTweak = () => {
    if (!onEditSecondary || !HEX_RE.test(editHex)) return;
    const base =
      secondaryToken?.type === "color"
        ? secondaryToken
        : {
            id: "derived_color_action_secondary",
            captureId: "derived",
            source: "derived" as const,
            name: null,
            occurrences: 1,
            merged: false,
            type: "color" as const,
            value: editHex.toUpperCase(),
            opacity: 1,
          };
    onEditSecondary({ ...base, value: editHex.toUpperCase() });
  };

  return (
    <div className="flex w-full flex-col gap-4">
      <div className="flex flex-col gap-2">
        <p className="text-caption font-medium text-text-primary">Color theory — pick a harmony</p>
        <div className="flex flex-wrap gap-2">
          {HARMONIES.map((harmony) => {
            const hex = harmonySuggestion.candidates[harmony];
            const active = !usingCaptured && activeHarmony === harmony;
            return (
              <button
                key={harmony}
                type="button"
                onClick={() => onAccentHarmony?.(harmony)}
                aria-pressed={active}
                className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 ${
                  active ? "border-brand-primary shadow-card" : "border-border-default"
                }`}
              >
                <span
                  className="h-6 w-6 shrink-0 rounded-sm border-2 border-border-default"
                  style={{ backgroundColor: hex }}
                  aria-hidden
                />
                <span className="flex flex-col text-left">
                  <span className="text-caption font-medium text-text-primary">
                    {HARMONY_LABELS[harmony]}
                    {harmony === harmonySuggestion.suggested ? " (suggested)" : ""}
                  </span>
                  <span className="font-mono text-badge text-text-muted">{hex}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2 rounded-md border-2 border-border-default bg-surface-page p-3">
        <p className="text-caption font-medium text-text-primary">Fine-tune</p>
        <p className="text-caption text-text-muted">
          Tweak the hex. You can still pick another harmony after.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="color"
            value={HEX_RE.test(editHex) ? editHex : "#000000"}
            onChange={(e) => setEditHex(e.target.value.toUpperCase())}
            className="h-9 w-9 cursor-pointer rounded-sm border-2 border-border-default bg-transparent p-0"
            aria-label="Secondary color picker"
          />
          <input
            type="text"
            value={editHex}
            onChange={(e) => setEditHex(e.target.value)}
            placeholder="#RRGGBB"
            className="w-28 rounded-sm border-2 border-border-default bg-surface-card px-2 py-1 font-mono text-badge"
            aria-label="Secondary hex value"
          />
          <Button
            size="sm"
            variant="primary"
            onClick={applyTweak}
            disabled={!HEX_RE.test(editHex) || !onEditSecondary}
          >
            Apply
          </Button>
          {secondaryOrigin === "edited" && onResetSecondary && (
            <Button size="sm" variant="ghost" onClick={onResetSecondary}>
              Reset
            </Button>
          )}
        </div>
      </div>

      {capturedSecondary && (
        <div className="flex flex-col gap-2">
          <p className="text-caption font-medium text-text-primary">From your capture</p>
          <button
            type="button"
            onClick={onUseCaptured}
            aria-pressed={usingCaptured}
            className={`flex w-fit items-center gap-2 rounded-sm border-2 px-2 py-1 ${
              usingCaptured ? "border-brand-primary" : "border-border-default"
            }`}
          >
            <span
              className="h-6 w-6 rounded-sm border-2 border-border-default"
              style={{ backgroundColor: capturedSecondary.value }}
              aria-hidden
            />
            <span className="font-mono text-badge">
              {nameOf(capturedSecondary)} · {capturedSecondary.value}
            </span>
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Colors page — primary + secondary color anchors. Swapping cascades derivation
 * live (never over user-edited values, C.8).
 */
export function AnchorsStep({
  anchors,
  tokens,
  onSetAnchor,
  accentHarmony,
  onAccentHarmony,
  secondaryToken,
  secondaryOrigin,
  onEditSecondary,
  onResetSecondary,
  children,
}: AnchorsStepProps) {
  const [open, setOpen] = useState<null | "primary" | "secondary">(null);
  const byId = new Map(tokens.map((t) => [t.id, t]));

  const primary = anchors.primaryColorId ? byId.get(anchors.primaryColorId) : undefined;
  const capturedSecondary = anchors.secondaryColorId ? byId.get(anchors.secondaryColorId) : undefined;

  const colorCandidates = tokens.filter(
    (t): t is StyleSnapToken & { type: "color"; value: string } =>
      t.type === "color" && t.opacity === 1 && !t.id.startsWith("derived_") && !isNeutral(t.value),
  );

  /** Instantiated: captured anchor, explicit harmony opt-in, or a fill/edit. */
  const secondaryActive =
    Boolean(capturedSecondary && accentHarmony === undefined) ||
    accentHarmony !== undefined ||
    secondaryToken !== undefined;

  const secondaryDisplay =
    secondaryToken?.type === "color"
      ? secondaryToken
      : capturedSecondary?.type === "color" && accentHarmony === undefined
        ? capturedSecondary
        : undefined;

  const secondarySummaryLabel = (() => {
    if (!secondaryDisplay || secondaryDisplay.type !== "color") return null;
    if (
      (secondaryOrigin === "snap" || secondaryOrigin === "seeded") &&
      accentHarmony === undefined
    ) {
      return `${nameOf(secondaryDisplay)} · ${secondaryDisplay.value}`;
    }
    const harmony =
      accentHarmony ??
      (primary?.type === "color" ? harmonyFromPrimary(primary.value).suggested : undefined);
    const harmonyLabel = harmony ? HARMONY_LABELS[harmony] : "Derived";
    const suffix = secondaryOrigin === "edited" ? " (edited)" : "";
    return `${harmonyLabel}${suffix} · ${secondaryDisplay.value}`;
  })();

  const enableSecondary = () => {
    if (!primary || primary.type !== "color" || !onAccentHarmony) return;
    onAccentHarmony(harmonyFromPrimary(primary.value).suggested);
  };

  const secondaryPicker =
    primary && primary.type === "color" ? (
      secondaryActive ? (
        <SecondaryHarmonyPicker
          primaryHex={primary.value}
          accentHarmony={accentHarmony}
          secondaryToken={secondaryToken}
          secondaryOrigin={secondaryOrigin}
          capturedSecondary={
            capturedSecondary?.type === "color" ? capturedSecondary : undefined
          }
          onAccentHarmony={(harmony) => {
            onAccentHarmony?.(harmony);
          }}
          onEditSecondary={onEditSecondary}
          onResetSecondary={onResetSecondary}
          onUseCaptured={() => {
            if (capturedSecondary) onSetAnchor({ secondaryColorId: capturedSecondary.id });
          }}
        />
      ) : (
        <div className="flex flex-col gap-3">
          <p className="text-caption text-text-muted">
            No secondary in this snap. Generate one from primary, then fine-tune if you want.
          </p>
          <Button type="button" size="sm" onClick={enableSecondary}>
            Use secondary color
          </Button>
        </div>
      )
    ) : (
      <p className="text-caption text-text-muted">Set a primary color first.</p>
    );

  const primaryPicker = colorCandidates
    .filter((t) => t.id !== anchors.secondaryColorId)
    .map((t) => (
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
    ));

  return (
    <section className="flex w-full flex-col gap-8">
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        <ColorAnchorCard
          anchorRole="anchor/primary"
          token={primary?.type === "color" ? primary : undefined}
          humanLabel={
            primary?.type === "color"
              ? humanValueLabel(primary)
              : "No color captured yet."
          }
          detailLine={
            primary?.type === "color" ? `${nameOf(primary)} · ${primary.value}` : undefined
          }
          tip={PRIMARY_ANCHOR_TIP}
          open={open === "primary"}
          onToggle={() => setOpen(open === "primary" ? null : "primary")}
          picker={<div className="flex flex-wrap gap-2">{primaryPicker}</div>}
        />

        <ColorAnchorCard
          anchorRole="anchor/secondary"
          token={secondaryDisplay?.type === "color" ? secondaryDisplay : undefined}
          humanLabel={
            secondaryDisplay?.type === "color"
              ? humanValueLabel(secondaryDisplay)
              : primary
                ? "Not set yet."
                : "Set primary first."
          }
          detailLine={secondarySummaryLabel ?? undefined}
          tip={SECONDARY_ANCHOR_TIP}
          open={open === "secondary"}
          onToggle={() => setOpen(open === "secondary" ? null : "secondary")}
          picker={secondaryPicker}
        />
      </div>

      {primary && primary.type === "color" && (
        <div className="rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
          <ColorFamilyPreview
            primaryHex={primary.value}
            secondaryHex={secondaryDisplay?.type === "color" ? secondaryDisplay.value : undefined}
            accentHarmony={accentHarmony}
          />
        </div>
      )}

      {children}
    </section>
  );
}
