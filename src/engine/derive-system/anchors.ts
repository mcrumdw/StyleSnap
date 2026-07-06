// Phase 10a — anchor detection (PRD Appendix C.1): the puzzle corners the
// rest of the system derives from. Anchors are PROPOSALS the user can swap.

import type { StyleSnapToken, TokenContext } from "../../contract/types";
import { isNeutral } from "./oklch";

export interface Anchors {
  /** Token id of the primary color (a captured token, never synthetic). */
  primaryColorId?: string;
  /** Token id of the body typography. */
  bodyTypographyId?: string;
  /** Base spacing in px, snapped to the 4px grid. */
  baseSpacing?: number;
  /** The spacing token the base was read from (for provenance/UI). */
  baseSpacingId?: string;
}

export interface AnchorOverrides {
  primaryColorId?: string;
  bodyTypographyId?: string;
  baseSpacing?: number;
}

/** The token's own context plus absorbed tokens' contexts (merge view). */
function contextsOf(
  token: StyleSnapToken,
  rawById: ReadonlyMap<string, StyleSnapToken>,
): TokenContext[] {
  const contexts: TokenContext[] = [];
  if (token.context) contexts.push(token.context);
  for (const id of token.mergedFrom ?? []) {
    const absorbed = rawById.get(id);
    if (absorbed?.context) contexts.push(absorbed.context);
  }
  return contexts;
}

/**
 * C.1 primary-color weight: authoredName mentioning primary/brand ×3;
 * background-color on a button/action element ×2; any background-color ×1;
 * text/border-only colors don't compete (a body-copy ink is never "primary").
 */
function primaryWeight(token: StyleSnapToken, rawById: ReadonlyMap<string, StyleSnapToken>): number {
  let weight = 0;
  for (const ctx of contextsOf(token, rawById)) {
    // "primary/brand" in the author's name is the strongest signal — but a
    // TEXT-role name ("color/text/primary") is about text, not the brand.
    const authored = ctx.authoredName ?? "";
    if (/primary|brand/i.test(authored) && !/text/i.test(authored)) {
      weight = Math.max(weight, 3);
    }
    if (ctx.cssProperty === "background-color") {
      const actionish =
        ctx.element === "button" || ctx.element === "a" || ctx.ariaRole === "button";
      weight = Math.max(weight, actionish ? 2 : 1);
    }
  }
  return weight;
}

export function detectAnchors(
  tokens: StyleSnapToken[],
  rawById: ReadonlyMap<string, StyleSnapToken> = new Map(),
  overrides: AnchorOverrides = {},
): Anchors {
  const anchors: Anchors = {};

  // Primary color — max(occurrences × weight); neutrals never qualify.
  let bestScore = 0;
  for (const token of tokens) {
    if (token.type !== "color" || token.opacity < 1 || isNeutral(token.value)) continue;
    const score = token.occurrences * primaryWeight(token, rawById);
    if (
      score > bestScore ||
      (score === bestScore && score > 0 && token.id < (anchors.primaryColorId ?? "￿"))
    ) {
      bestScore = score;
      anchors.primaryColorId = token.id;
    }
  }

  // Body typography — most frequent typography token.
  let bodyBest = -1;
  for (const token of tokens) {
    if (token.type !== "typography") continue;
    if (
      token.occurrences > bodyBest ||
      (token.occurrences === bodyBest && token.id < (anchors.bodyTypographyId ?? "￿"))
    ) {
      bodyBest = token.occurrences;
      anchors.bodyTypographyId = token.id;
    }
  }

  // Base spacing — most frequent value snapped to the 4px grid.
  const snap = (v: number) => Math.max(4, Math.round(v / 4) * 4);
  const bySnapped = new Map<number, { occurrences: number; tokenId: string }>();
  for (const token of tokens) {
    if (token.type !== "spacing") continue;
    const key = snap(token.value);
    const entry = bySnapped.get(key) ?? { occurrences: 0, tokenId: token.id };
    entry.occurrences += token.occurrences;
    if (token.id < entry.tokenId) entry.tokenId = token.id;
    bySnapped.set(key, entry);
  }
  let spacingBest = -1;
  for (const [value, { occurrences, tokenId }] of [...bySnapped.entries()].sort(
    (a, b) => a[0] - b[0],
  )) {
    if (occurrences > spacingBest) {
      spacingBest = occurrences;
      anchors.baseSpacing = value;
      anchors.baseSpacingId = tokenId;
    }
  }

  // User swaps win (validated upstream; unknown ids fall back to detection).
  if (overrides.primaryColorId && tokens.some((t) => t.id === overrides.primaryColorId)) {
    anchors.primaryColorId = overrides.primaryColorId;
  }
  if (overrides.bodyTypographyId && tokens.some((t) => t.id === overrides.bodyTypographyId)) {
    anchors.bodyTypographyId = overrides.bodyTypographyId;
  }
  if (overrides.baseSpacing !== undefined) {
    anchors.baseSpacing = snap(overrides.baseSpacing);
    anchors.baseSpacingId = undefined;
  }
  return anchors;
}
