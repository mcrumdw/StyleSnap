// Phase 9a — computed Accessibility section (PRD §11).
// WCAG 2.x contrast for every assigned text/surface color pair, plus white on
// action/feedback fills (buttons and badges carry white labels by §11
// convention). Pure functions; culori stays in dedup — contrast needs the
// WCAG relative-luminance formula, not a perceptual color space.

import { roleOrderIndex } from "../roles";
import type { ExportInput } from "./index";

export const AA_NORMAL_TEXT = 4.5;

/** WCAG relative luminance of a 6-digit hex color. */
export function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const linear = (byte: number) => {
    const c = byte / 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * linear((n >> 16) & 0xff) +
    0.7152 * linear((n >> 8) & 0xff) +
    0.0722 * linear(n & 0xff)
  );
}

/** WCAG contrast ratio (1–21), order-independent. */
export function contrastRatio(hexA: string, hexB: string): number {
  const a = relativeLuminance(hexA);
  const b = relativeLuminance(hexB);
  const [hi, lo] = a >= b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
}

export interface ContrastPair {
  /** Row label, e.g. "`color/text/primary` on `color/surface/card`". */
  label: string;
  ratio: number;
  /** One decimal, e.g. "17.7:1". */
  ratioText: string;
  passes: boolean;
  /** Passing with no headroom (rounds to 4.5) — flag "avoid small text". */
  noMargin: boolean;
}

function pair(label: string, fg: string, bg: string): ContrastPair {
  const ratio = contrastRatio(fg, bg);
  const passes = ratio >= AA_NORMAL_TEXT;
  return {
    label,
    ratio,
    ratioText: `${ratio.toFixed(1)}:1`,
    passes,
    noMargin: passes && ratio < 4.55,
  };
}

/**
 * The measured pairs, deterministically ordered: text roles (taxonomy order)
 * × surface roles (alphabetical), then white on each action/feedback fill
 * (taxonomy order). Translucent colors are skipped — contrast over an unknown
 * backdrop is undefined (the overlay scrim never carries text directly).
 */
export function accessibilityPairs(input: ExportInput): ContrastPair[] {
  const byId = new Map(input.tokens.map((t) => [t.id, t]));
  const hexOf = (role: string): string | undefined => {
    const id = input.assignments.get(role);
    const token = id ? byId.get(id) : undefined;
    return token && token.type === "color" && token.opacity === 1
      ? token.value.toUpperCase()
      : undefined;
  };

  const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  const byTaxonomy = (a: string, b: string) =>
    roleOrderIndex(a) - roleOrderIndex(b) || byString(a, b);

  const colorRoles = [...input.assignments.keys()].filter((r) => hexOf(r) !== undefined);
  const bodyTextRoles = colorRoles
    .filter((r) => r.startsWith("color/text/") && r !== "color/text/inverse")
    .sort(byTaxonomy);
  const inverseHex = hexOf("color/text/inverse");
  // Body ink is measured on page/card — not on inverse bands (§2.73).
  const pageLikeSurfaces = colorRoles
    .filter((r) => r === "color/surface/page" || r === "color/surface/card")
    .sort(byString);
  const fillRoles = colorRoles
    .filter((r) => r.startsWith("color/action/") || r.startsWith("color/feedback/"))
    .sort(byTaxonomy);

  const pairs: ContrastPair[] = [];
  for (const text of bodyTextRoles) {
    for (const surface of pageLikeSurfaces) {
      pairs.push(pair(`\`${text}\` on \`${surface}\``, hexOf(text)!, hexOf(surface)!));
    }
  }
  // Inverse text ↔ inverse surface + action/feedback fills.
  const onFillLabel = inverseHex ? "`color/text/inverse`" : "white";
  const onFillHex = inverseHex ?? "#FFFFFF";
  const inverseSurf = hexOf("color/surface/inverse");
  if (inverseHex && inverseSurf) {
    pairs.push(
      pair("`color/text/inverse` on `color/surface/inverse`", inverseHex, inverseSurf),
    );
  }
  for (const fill of fillRoles) {
    pairs.push(pair(`${onFillLabel} on \`${fill}\``, onFillHex, hexOf(fill)!));
  }
  return pairs;
}

/** Gaps bullets for the failing pairs (they also fail visibly in the table). */
export function contrastGapBullets(input: ExportInput): string[] {
  return accessibilityPairs(input)
    .filter((p) => !p.passes)
    .map(
      (p) =>
        `${p.label} — contrast ${p.ratioText} fails AA (${AA_NORMAL_TEXT}:1); adjust one of the pair before build.`,
    );
}

export function accessibilitySection(input: ExportInput): string {
  const pairs = accessibilityPairs(input);
  const lines = ["## Accessibility (computed)", ""];
  if (pairs.length === 0) {
    lines.push("*(no full-opacity color roles assigned yet — see Gaps)*");
    return lines.join("\n");
  }
  lines.push(
    "Measured WCAG contrast for the assigned text/surface pairs:",
    "",
    "| Pair | Ratio | AA (4.5:1) |",
    "|---|---|---|",
  );
  for (const p of pairs) {
    const verdict = p.passes
      ? p.noMargin
        ? "✅ (no margin — avoid small text)"
        : "✅"
      : `❌ fails — see Gaps`;
    lines.push(`| ${p.label} | ${p.ratioText} | ${verdict} |`);
  }
  return lines.join("\n");
}
