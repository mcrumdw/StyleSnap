// Phase 10a — modular type scale (PRD Appendix C.6). Derives the empty type
// role slots from the body anchor; captured typography claims its slot first.

import type { TypographyToken, TypographyValue } from "../../contract/types";

export type TypeRatio = 1.2 | 1.25 | 1.333;
export const DEFAULT_TYPE_RATIO: TypeRatio = 1.25;

// Whole-px sizes only — no 11.5px steps. Design tools and CSS read cleaner
// with integers, and it avoids sub-pixel rendering fuzz.
const roundPx = (px: number) => Math.max(1, Math.round(px));

/** role → { size multiplier exponent, line-height } (C.6). */
const TYPE_SLOTS: ReadonlyArray<{ role: string; exponent: number; lineHeight: number }> = [
  { role: "type/caption", exponent: -1, lineHeight: 1.4 },
  { role: "type/body", exponent: 0, lineHeight: 1.5 },
  { role: "type/subheading", exponent: 1, lineHeight: 1.3 },
  { role: "type/heading", exponent: 2, lineHeight: 1.2 },
  { role: "type/display", exponent: 3, lineHeight: 1.1 },
];

export interface DerivedTypeSlot {
  role: string;
  value: TypographyValue;
  /** Human-readable derivation, e.g. "×1.25²". */
  method: string;
}

/** Monospace companion — body size, system mono stack (code, token values). */
export function deriveMono(body: TypographyToken): TypographyValue {
  const size = roundPx(body.value.fontSize * 0.875);
  return {
    fontFamily: "ui-monospace",
    fontStack: [
      "ui-monospace",
      "SFMono-Regular",
      "SF Mono",
      "Menlo",
      "Consolas",
      "monospace",
    ],
    fontSize: size,
    fontWeight: 400,
    lineHeight: 1.5,
  };
}

export function deriveTypeScale(
  body: TypographyToken,
  capturedTypography: TypographyToken[],
  ratio: TypeRatio = DEFAULT_TYPE_RATIO,
): DerivedTypeSlot[] {
  const base = body.value;
  // Heading weight = the heaviest captured weight, else 700 (C.6).
  const maxWeight = capturedTypography.reduce((w, t) => Math.max(w, t.value.fontWeight), 0);
  const headingWeight = maxWeight > base.fontWeight ? maxWeight : 700;

  return TYPE_SLOTS.map(({ role, exponent, lineHeight }) => {
    const size = roundPx(base.fontSize * Math.pow(ratio, exponent));
    const heading = exponent >= 1;
    const value: TypographyValue = {
      fontFamily: base.fontFamily,
      ...(base.fontStack ? { fontStack: base.fontStack } : {}),
      fontSize: size,
      fontWeight: heading ? headingWeight : exponent === 0 ? base.fontWeight : 500,
      lineHeight,
    };
    const method =
      exponent === 0
        ? "body anchor"
        : `×${ratio}${exponent === 1 ? "" : exponent === -1 ? "⁻¹" : exponent === 2 ? "²" : "³"}`;
    return { role, value, method };
  });
}
