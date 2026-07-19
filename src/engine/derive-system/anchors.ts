// Phase 10a — anchor detection (PRD Appendix C.1): the puzzle corners the
// rest of the system derives from. Anchors are PROPOSALS the user can swap.

import type { StyleSnapToken, TokenContext } from "../../contract/types";
import { isNeutral, oklchOf, hueDistance } from "./oklch";

export interface Anchors {
  /** Token id of the primary color (a captured token, never synthetic). */
  primaryColorId?: string;
  /**
   * Resolved hex for the primary anchor. Usually the primary color token's
   * value, but when the primary is a gradient it is the gradient's
   * representative (most chromatic) stop — so the system can still derive.
   */
  primaryColorHex?: string;
  /** Token id of the secondary color — distinct accent / second CTA hue. */
  secondaryColorId?: string;
  /** Token id of the body typography. */
  bodyTypographyId?: string;
  /** Base spacing in px, snapped to the 4px grid. */
  baseSpacing?: number;
  /** The spacing token the base was read from (for provenance/UI). */
  baseSpacingId?: string;
}

export interface AnchorOverrides {
  primaryColorId?: string;
  secondaryColorId?: string;
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
 * A single hex that best stands in for a token's "color" when proposing a
 * primary. Opaque color → its value; gradient → its most chromatic stop (a
 * screen's real brand hue often lives only in a gradient). Undefined for
 * transparent colors or non-color tokens.
 */
function representativeHex(token: StyleSnapToken): string | undefined {
  if (token.type === "color") return token.opacity >= 1 ? token.value : undefined;
  if (token.type === "gradient") {
    let best: string | undefined;
    let bestChroma = -1;
    for (const stop of token.value.stops) {
      const chroma = oklchOf(stop.color).c;
      if (chroma > bestChroma) {
        bestChroma = chroma;
        best = stop.color;
      }
    }
    return best;
  }
  return undefined;
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

/** Secondary must be a different personality than primary — hue gap or alert/error role. */
function isDistinctSecondary(
  token: StyleSnapToken,
  rawById: ReadonlyMap<string, StyleSnapToken>,
  primaryHex?: string,
): boolean {
  if (primaryHex === undefined || token.type !== "color") return false;
  for (const ctx of contextsOf(token, rawById)) {
    if (ctx.ariaRole === "alert") return true;
  }
  return hueDistance(oklchOf(token.value).h, oklchOf(primaryHex).h) >= 18;
}

/** Secondary anchor: authored "secondary/accent" names, then alert or distinct hue. */
function secondaryWeight(
  token: StyleSnapToken,
  rawById: ReadonlyMap<string, StyleSnapToken>,
  primaryHex?: string,
): number {
  let weight = 0;
  for (const ctx of contextsOf(token, rawById)) {
    const authored = ctx.authoredName ?? "";
    if (/secondary|accent/i.test(authored) && !/text/i.test(authored)) {
      weight = Math.max(weight, 3);
    }
    if (ctx.ariaRole === "alert") {
      weight = Math.max(weight, 3);
    }
    if (ctx.cssProperty === "background-color") {
      const actionish =
        ctx.element === "button" || ctx.element === "a" || ctx.ariaRole === "button";
      weight = Math.max(weight, actionish ? 1.5 : 0.75);
    }
  }
  if (primaryHex && token.type === "color") {
    const dist = hueDistance(oklchOf(token.value).h, oklchOf(primaryHex).h);
    if (dist >= 18) weight += 2;
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

  // Fallback: no color carried a weighted signal (common for Figma captures
  // without a "primary/brand" authored name, or screens whose only strong hue
  // lives in a gradient). Propose the most-used color so the system still
  // derives — prefer chromatic candidates, allow neutrals only if nothing else.
  if (!anchors.primaryColorId) {
    const candidates = tokens
      .map((t) => ({
        id: t.id,
        hex: representativeHex(t),
        occurrences: t.occurrences,
        solid: t.type === "color",
      }))
      .filter(
        (c): c is { id: string; hex: string; occurrences: number; solid: boolean } =>
          c.hex !== undefined,
      );
    const chromatic = candidates.filter((c) => !isNeutral(c.hex));
    // Precedence: a real captured solid color wins over a gradient's
    // representative hue, which wins over a neutral. A gradient only becomes
    // primary when the design has no chromatic solid color at all (as with the
    // weather app, whose only strong hue lives in its background gradient).
    // Most-used wins within a tier; token id breaks ties for determinism.
    const solidChromatic = chromatic.filter((c) => c.solid);
    const pool =
      solidChromatic.length > 0 ? solidChromatic : chromatic.length > 0 ? chromatic : candidates;
    let best: (typeof pool)[number] | undefined;
    for (const c of pool) {
      if (
        !best ||
        c.occurrences > best.occurrences ||
        (c.occurrences === best.occurrences && c.id < best.id)
      ) {
        best = c;
      }
    }
    if (best) {
      anchors.primaryColorId = best.id;
      anchors.primaryColorHex = best.hex;
    }
  }

  const primaryToken = anchors.primaryColorId
    ? tokens.find((t) => t.id === anchors.primaryColorId)
    : undefined;
  if (anchors.primaryColorHex === undefined && primaryToken) {
    anchors.primaryColorHex = representativeHex(primaryToken);
  }
  const primaryHex = anchors.primaryColorHex;

  // Secondary color — only when a distinct second hue exists in the capture.
  let bestSecondary: { score: number; id: string } | undefined;
  for (const token of tokens) {
    if (token.id === anchors.primaryColorId) continue;
    if (token.type !== "color" || token.opacity < 1 || isNeutral(token.value)) continue;
    if (!isDistinctSecondary(token, rawById, primaryHex)) continue;
    const score = token.occurrences * secondaryWeight(token, rawById, primaryHex);
    if (score <= 0) continue;
    if (
      !bestSecondary ||
      score > bestSecondary.score ||
      (score === bestSecondary.score && token.id < bestSecondary.id)
    ) {
      bestSecondary = { score, id: token.id };
    }
  }
  if (bestSecondary) anchors.secondaryColorId = bestSecondary.id;

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
    const swapped = tokens.find((t) => t.id === overrides.primaryColorId);
    anchors.primaryColorHex = swapped ? representativeHex(swapped) : undefined;
  }
  if (overrides.secondaryColorId && tokens.some((t) => t.id === overrides.secondaryColorId)) {
    anchors.secondaryColorId = overrides.secondaryColorId;
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
