// PRD §7.5 / Appendix B.4 — deterministic role derivation from capture
// context (DECISIONS.md §2.4). Signals strongest-first:
//
//   1. authoredName that EXACTLY matches a taxonomy role (Figma Variable
//      names like "color/action/primary" parse directly). Fuzzy names
//      ("--color-primary") deliberately fall through to the context rules —
//      guessing between text/primary and action/primary would be prediction,
//      not derivation.
//   2. The B.4 context-hint table (cssProperty × element × state × ariaRole).
//   3. Scale slots (space/radius/shadow/border-width) by ascending size —
//      only when the value count fits the slots; otherwise assignment is the
//      user's call (Phase 5).
//
// Everything here is a SUGGESTION (dashed chip). Nothing is finalized
// without human confirmation (FR-16).

import type { ShadowToken, StyleSnapToken, TokenContext } from "../../contract/types";
import {
  BORDER_WIDTH_SLOTS,
  isValidRole,
  RADIUS_SLOTS,
  SHADOW_SLOTS,
  SPACE_SLOTS,
} from "./taxonomy";

export interface RoleSuggestion {
  role: string;
  source: "authored-name" | "context" | "scale";
}

/**
 * Derive suggestions for the current (post-merge) tokens. `rawById` lets a
 * merge survivor inherit the contexts of the tokens it absorbed (A.1) — a
 * 16px survivor that swallowed Figma's `space/md` inherits that name.
 */
export function deriveRoleSuggestions(
  tokens: StyleSnapToken[],
  rawById: Map<string, StyleSnapToken> = new Map(),
): Map<string, RoleSuggestion> {
  const suggestions = new Map<string, RoleSuggestion>();

  for (const token of tokens) {
    const contexts = candidateContexts(token, rawById);

    const authored = contexts
      .map((ctx) => ctx.authoredName?.toLowerCase().trim())
      .find((name) => name !== undefined && isValidRole(name, token.type));
    if (authored) {
      suggestions.set(token.id, { role: authored, source: "authored-name" });
      continue;
    }

    for (const ctx of contexts) {
      const role = contextRule(token, ctx);
      if (role) {
        suggestions.set(token.id, { role, source: "context" });
        break;
      }
    }
  }

  suggestScaleSlots(tokens, suggestions);
  return suggestions;
}

/** The token's own context first, then the absorbed tokens' contexts in order. */
function candidateContexts(
  token: StyleSnapToken,
  rawById: Map<string, StyleSnapToken>,
): TokenContext[] {
  const contexts: TokenContext[] = [];
  if (token.context) contexts.push(token.context);
  for (const id of token.mergedFrom ?? []) {
    const absorbed = rawById.get(id);
    if (absorbed?.context) contexts.push(absorbed.context);
  }
  return contexts;
}

// ─────────────────────────────────────────
// B.4 context-hint table
// ─────────────────────────────────────────

const HEADING_ELEMENTS = new Set(["h1", "h2", "h3"]);

function contextRule(token: StyleSnapToken, ctx: TokenContext): string | undefined {
  const element = ctx.element?.toLowerCase();

  if (token.type === "color") {
    // State beats everything: a hover/active capture is a state shade.
    if (ctx.state === "hover") return "color/action/primary-hover";
    if (ctx.state === "active") return "color/action/primary-active";
    if (ctx.ariaRole === "alert") return "color/feedback/error";

    switch (ctx.cssProperty) {
      case "background-color":
        if (element === "body" || element === "main" || element === "html") {
          return "color/surface/page";
        }
        if (element === "button" || ctx.ariaRole === "button") return "color/action/primary";
        return "color/surface/card";
      case "border-color":
        return "color/border/default";
      case "color":
        if (element === "a") return "color/text/link";
        if (element !== undefined && HEADING_ELEMENTS.has(element)) return "color/text/primary";
        if (element === "p" || element === "body") return "color/text/primary";
        return undefined;
      default:
        return undefined;
    }
  }

  if (token.type === "typography" && element !== undefined) {
    if (element === "h1" && token.value.fontSize >= 40) return "type/display";
    if (HEADING_ELEMENTS.has(element)) return "type/heading";
    if (element === "p" || element === "body") return "type/body";
  }

  return undefined;
}

// ─────────────────────────────────────────
// B.4 scale slots — by ascending size, only when the values fit
// ─────────────────────────────────────────

function suggestScaleSlots(
  tokens: StyleSnapToken[],
  suggestions: Map<string, RoleSuggestion>,
): void {
  assignNumericSlots(tokens, "spacing", SPACE_SLOTS.map((s) => s.role), suggestions);
  assignNumericSlots(
    tokens,
    "border-radius",
    RADIUS_SLOTS.filter((s) => s.role !== "radius/full").map((s) => s.role),
    suggestions,
  );
  assignNumericSlots(tokens, "border-width", BORDER_WIDTH_SLOTS.map((s) => s.role), suggestions);
  assignShadowSlots(tokens, suggestions);
}

function assignNumericSlots(
  tokens: StyleSnapToken[],
  type: "spacing" | "border-radius" | "border-width",
  slots: string[],
  suggestions: Map<string, RoleSuggestion>,
): void {
  const group = tokens.filter(
    (t): t is StyleSnapToken & { value: number } => t.type === type,
  );
  const unassigned = group.filter((t) => !suggestions.has(t.id));
  const values = [...new Set(unassigned.map((t) => t.value))].sort((a, b) => a - b);
  // More distinct values than slots ⇒ ambiguous; leave it to the user.
  if (values.length === 0 || values.length > slots.length) return;
  const slotByValue = new Map(values.map((v, i) => [v, slots[i]]));
  for (const token of unassigned) {
    suggestions.set(token.id, { role: slotByValue.get(token.value)!, source: "scale" });
  }
}

/** Shadows rank by visual size (blur + |offsetY| of the first layer). */
function shadowSize(token: ShadowToken): number {
  const layer = token.value[0];
  return layer.blur + Math.abs(layer.offsetY);
}

function assignShadowSlots(
  tokens: StyleSnapToken[],
  suggestions: Map<string, RoleSuggestion>,
): void {
  const slots = SHADOW_SLOTS.map((s) => s.role);
  const group = tokens.filter((t): t is ShadowToken => t.type === "shadow");
  const unassigned = group.filter((t) => !suggestions.has(t.id));
  const sizes = [...new Set(unassigned.map(shadowSize))].sort((a, b) => a - b);
  if (sizes.length === 0 || sizes.length > slots.length) return;
  const slotBySize = new Map(sizes.map((s, i) => [s, slots[i]]));
  for (const token of unassigned) {
    suggestions.set(token.id, { role: slotBySize.get(shadowSize(token))!, source: "scale" });
  }
}
