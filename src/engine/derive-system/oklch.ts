// Phase 10a — OKLCH helpers (PRD Appendix C). All derivation color math
// happens in OKLCH via culori; output is always an uppercase 6-digit hex
// (the contract's ColorValue format).

import { clampChroma, converter, formatHex } from "culori";

const toOklch = converter("oklch");

export interface Oklch {
  l: number;
  c: number;
  h: number;
}

export function oklchOf(hex: string): Oklch {
  const parsed = toOklch(hex);
  if (!parsed) throw new Error(`not a color: ${hex}`);
  // Achromatic colors (white, grays) have an undefined hue — normalize to 0.
  return { l: parsed.l ?? 0, c: parsed.c ?? 0, h: parsed.h ?? 0 };
}

/** Gamut-clamped uppercase hex for an OKLCH triple. */
export function hexAt(l: number, c: number, h: number): string {
  const clamped = clampChroma({ mode: "oklch" as const, l, c, h }, "oklch");
  return formatHex(clamped).toUpperCase();
}

/** Circular hue distance in degrees (0–180). */
export function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/** Neutral = too little chroma to read as "a color" (white, grays, near-blacks). */
export const NEUTRAL_CHROMA = 0.03;

export function isNeutral(hex: string): boolean {
  return oklchOf(hex).c < NEUTRAL_CHROMA;
}
