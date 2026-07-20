// Normalize captured values for a tidy, merge-friendly primitive list.
// Spacing: whole pixels only — 8.5 / 9.4 → 9 so near-misses become duplicates.

import type { StyleSnapToken } from "../contract/types";

/** Round spacing to whole CSS px (sub-pixel capture noise). */
export function roundSpacingPx(value: number): number {
  return Math.round(value);
}

/**
 * User-created primitive (Add token / save-as-primitive) — not from a snap.
 * Manual tokens use a `manual_…` id and/or a "manual entry…" source.
 */
export function isManualToken(token: StyleSnapToken): boolean {
  return token.id.startsWith("manual_") || token.source.startsWith("manual entry");
}

export function normalizeToken(token: StyleSnapToken): StyleSnapToken {
  if (token.type !== "spacing") return token;
  const value = roundSpacingPx(token.value);
  return value === token.value ? token : { ...token, value };
}

export function normalizeTokens(tokens: StyleSnapToken[]): StyleSnapToken[] {
  return tokens.map(normalizeToken);
}
