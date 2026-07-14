// Phase 10a — color derivation (PRD Appendix C.2–C.5). Deterministic OKLCH
// math: interaction states by lightness shifts, tinted neutrals wearing the
// brand hue, feedback colors as conventional hues with the brand's chroma
// (AA-enforced), accents suggested via color-wheel harmonies.

import { contrastRatio } from "../export/accessibility";
import { hexAt, hueDistance, NEUTRAL_CHROMA, oklchOf } from "./oklch";

// ─────────────────────────────────────────
// C.2 interaction states
// ─────────────────────────────────────────

export interface DerivedStates {
  hover: string;
  active: string;
}

export function deriveStates(primaryHex: string): DerivedStates {
  const { l, c, h } = oklchOf(primaryHex);
  return {
    hover: hexAt(Math.max(0.15, l - 0.06), c, h),
    active: hexAt(Math.max(0.15, l - 0.12), c, h),
  };
}

// ─────────────────────────────────────────
// C.3 tinted neutrals — brand hue, chroma ≤ 0.02
// ─────────────────────────────────────────

export interface DerivedNeutrals {
  textPrimary: string;
  textMuted: string;
  surfacePage: string;
  surfaceCard: string;
  border: string;
}

export function deriveNeutrals(primaryHex: string): DerivedNeutrals {
  const { c, h } = oklchOf(primaryHex);
  const tint = Math.min(c, 0.02);
  return {
    textPrimary: hexAt(0.22, tint, h),
    textMuted: hexAt(0.52, tint, h),
    surfacePage: hexAt(0.985, tint, h),
    surfaceCard: "#FFFFFF",
    border: hexAt(0.9, tint, h),
  };
}

// ─────────────────────────────────────────
// C.4 feedback — conventional hues, brand chroma, AA-tuned
// ─────────────────────────────────────────

export const FEEDBACK_HUES = {
  error: 25,
  warning: 70,
  success: 150,
  info: 250,
} as const;

export type FeedbackRole = keyof typeof FEEDBACK_HUES;

/**
 * Darken from a pleasant start until the color reads AA (≥ 4.5:1) as text on
 * surface-card white. Deterministic: fixed start, fixed 0.01 steps.
 */
export function tuneForAA(c: number, h: number, startL = 0.64): string {
  let l = startL;
  while (l > 0.15 && contrastRatio(hexAt(l, c, h), "#FFFFFF") < 4.5) {
    l = Math.round((l - 0.01) * 100) / 100;
  }
  return hexAt(l, c, h);
}

/** Darken a fill until white label text passes AA (4.5:1) — for CTA fills. */
export function tuneFillForWhiteText(hex: string): string {
  const { c, h, l } = oklchOf(hex);
  let fillL = l;
  while (fillL > 0.15 && contrastRatio("#FFFFFF", hexAt(fillL, c, h)) < 4.5) {
    fillL = Math.round((fillL - 0.01) * 100) / 100;
  }
  return hexAt(fillL, c, h);
}

/** Link color — same hue as brand, darkened until AA on the page surface. */
export function deriveLinkColor(primaryHex: string, surfacePageHex: string): string {
  const { c, h, l } = oklchOf(primaryHex);
  let linkL = l;
  while (linkL > 0.15 && contrastRatio(hexAt(linkL, c, h), surfacePageHex) < 4.5) {
    linkL = Math.round((linkL - 0.01) * 100) / 100;
  }
  return hexAt(linkL, c, h);
}

export function deriveFeedback(primaryHex: string): Record<FeedbackRole, string> {
  const brand = oklchOf(primaryHex);
  const chroma = Math.min(brand.c, 0.18);
  return {
    error: tuneForAA(chroma, FEEDBACK_HUES.error),
    warning: tuneForAA(chroma, FEEDBACK_HUES.warning),
    success: tuneForAA(chroma, FEEDBACK_HUES.success),
    info: tuneForAA(chroma, FEEDBACK_HUES.info),
  };
}

// ─────────────────────────────────────────
// C.5 accent suggestion — suggest, never impose
// ─────────────────────────────────────────

export type Harmony = "complementary" | "split-complementary" | "analogous";

export interface AccentSuggestion {
  candidates: Record<Harmony, string>;
  /** Appendix C.5 suitability rule. */
  suggested: Harmony;
}

/**
 * Only when the capture has no second hue: every captured full-opacity,
 * non-neutral color sits within ±40° of the primary.
 */
/** Ghost/outline secondary CTA — same hue, low chroma (when no harmony accent applies). */
export function deriveSecondaryFromPrimary(primaryHex: string): string {
  const { l, c, h } = oklchOf(primaryHex);
  return hexAt(Math.min(0.78, l + 0.12), Math.min(c * 0.35, 0.1), h);
}

/** Color-theory candidates from primary alone — always available for secondary swap. */
export function harmonyFromPrimary(primaryHex: string): AccentSuggestion {
  const brand = oklchOf(primaryHex);
  const at = (rotation: number) => tuneForAA(brand.c, (brand.h + rotation + 360) % 360, brand.l);
  const suggested: Harmony =
    brand.c > 0.17 ? "analogous" : brand.c < 0.09 ? "complementary" : "split-complementary";
  return {
    candidates: {
      complementary: at(180),
      "split-complementary": at(150),
      analogous: at(30),
    },
    suggested,
  };
}

export function deriveAccent(
  primaryHex: string,
  capturedHexes: string[],
): AccentSuggestion | null {
  const brand = oklchOf(primaryHex);
  for (const hex of capturedHexes) {
    const color = oklchOf(hex);
    if (color.c < NEUTRAL_CHROMA) continue;
    if (hueDistance(color.h, brand.h) > 40) return null; // second hue exists
  }
  return harmonyFromPrimary(primaryHex);
}
