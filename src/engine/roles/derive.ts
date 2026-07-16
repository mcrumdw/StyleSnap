// PRD §7.5 / Appendix B.4 — deterministic role derivation from capture
// context (DECISIONS.md §2.4), ROLE-KEYED since Phase 8: roles point at
// primitives, so the engine suggests candidates PER ROLE, and one token may
// be a candidate for several roles (a merged blue that was captured both as
// a button background and as link text hints at color/action/primary AND
// color/text/link).
//
// Signals, strongest-first:
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
  roleOrderIndex,
  SHADOW_SLOTS,
  SPACE_SLOTS,
} from "./taxonomy";

export type SuggestionSource = "authored-name" | "context" | "scale";

export interface RoleCandidate {
  tokenId: string;
  /** Signal strength: authored-name 0.9 · context 0.6 · scale 0.5. */
  confidence: number;
  source: SuggestionSource;
  /** Frequency signal (types.ts) — breaks confidence ties in the ranking. */
  occurrences: number;
}

const CONFIDENCE: Record<SuggestionSource, number> = {
  "authored-name": 0.9,
  context: 0.6,
  scale: 0.5,
};

/** role → candidate tokens, strongest first (ties broken by token id). */
export type RoleCandidates = Map<string, RoleCandidate[]>;

/**
 * Derive candidates for the current (post-merge) tokens. `rawById` lets a
 * merge survivor inherit the contexts of the tokens it absorbed (A.1) — a
 * 16px survivor that swallowed Figma's `space/md` inherits that name.
 */
export function deriveRoleCandidates(
  tokens: StyleSnapToken[],
  rawById: Map<string, StyleSnapToken> = new Map(),
): RoleCandidates {
  // token id → role → best source for that role.
  const perToken = new Map<string, Map<string, SuggestionSource>>();
  const addHint = (tokenId: string, role: string, source: SuggestionSource) => {
    const roles = perToken.get(tokenId) ?? new Map<string, SuggestionSource>();
    const existing = roles.get(role);
    if (existing === undefined || CONFIDENCE[source] > CONFIDENCE[existing]) {
      roles.set(role, source);
    }
    perToken.set(tokenId, roles);
  };

  for (const token of tokens) {
    // ALL contexts contribute — that is what makes multi-role suggestions work.
    const fallbacks: string[] = [];
    for (const ctx of candidateContexts(token, rawById)) {
      const authored = ctx.authoredName?.toLowerCase().trim();
      if (authored !== undefined && isValidRole(authored, token.type)) {
        addHint(token.id, authored, "authored-name");
      }
      const contextual = contextRule(token, ctx);
      if (contextual?.fallback) fallbacks.push(contextual.role);
      else if (contextual) addHint(token.id, contextual.role, "context");
    }
    // Catch-all rules (generic surface/card) only fire when nothing specific
    // did — otherwise every merged button blue would also hint surface/card.
    if ((perToken.get(token.id)?.size ?? 0) === 0) {
      for (const role of fallbacks) addHint(token.id, role, "context");
    }
  }

  suggestScaleSlots(tokens, perToken, addHint);

  // Invert token → roles into role → candidates, ranked by signal strength,
  // then frequency, then id (fully deterministic).
  const occurrencesOf = new Map(tokens.map((t) => [t.id, t.occurrences]));
  const byRole: RoleCandidates = new Map();
  const tokenOrder = [...perToken.keys()].sort();
  for (const tokenId of tokenOrder) {
    for (const [role, source] of perToken.get(tokenId)!) {
      const list = byRole.get(role) ?? [];
      list.push({
        tokenId,
        confidence: CONFIDENCE[source],
        source,
        occurrences: occurrencesOf.get(tokenId) ?? 0,
      });
      byRole.set(role, list);
    }
  }
  for (const list of byRole.values()) {
    list.sort(
      (a, b) =>
        b.confidence - a.confidence ||
        b.occurrences - a.occurrences ||
        (a.tokenId < b.tokenId ? -1 : 1),
    );
  }
  return byRole;
}

/**
 * For the token cards' dashed chips: the roles each token is the LEADING
 * candidate for (Appendix B order). Weaker candidates stay discoverable
 * through the role picker, not as chips on every near-match.
 */
export function topSuggestionsByToken(candidates: RoleCandidates): Map<string, string[]> {
  const byToken = new Map<string, string[]>();
  for (const [role, list] of candidates) {
    const top = list[0];
    if (!top) continue;
    const roles = byToken.get(top.tokenId) ?? [];
    roles.push(role);
    byToken.set(top.tokenId, roles);
  }
  for (const roles of byToken.values()) {
    roles.sort((a, b) => roleOrderIndex(a) - roleOrderIndex(b));
  }
  return byToken;
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

interface ContextHint {
  role: string;
  /** Catch-all rule — only applies when no specific rule fired for the token. */
  fallback?: boolean;
}

function contextRule(token: StyleSnapToken, ctx: TokenContext): ContextHint | undefined {
  const element = ctx.element?.toLowerCase();

  if (token.type === "color") {
    // State beats everything: a hover/active capture is a state shade.
    if (ctx.state === "hover") return { role: "color/action/primary-hover" };
    if (ctx.state === "active") return { role: "color/action/primary-active" };
    if (ctx.ariaRole === "alert") return { role: "color/feedback/error" };
    if (ctx.ariaRole === "status") return { role: "color/feedback/success" };
    if (ctx.ariaRole === "note") return { role: "color/feedback/info" };

    const sourceBlob = `${token.source} ${ctx.selector ?? ""}`.toLowerCase();
    if (sourceBlob.includes("alert-warning") || sourceBlob.includes("toast-warning")) {
      return { role: "color/feedback/warning" };
    }
    if (sourceBlob.includes("alert-success") || sourceBlob.includes("toast-success")) {
      return { role: "color/feedback/success" };
    }
    if (sourceBlob.includes("alert-info") || sourceBlob.includes("toast-info")) {
      return { role: "color/feedback/info" };
    }
    if (sourceBlob.includes("warning") || sourceBlob.includes("caution")) {
      return { role: "color/feedback/warning" };
    }
    if (sourceBlob.includes("success") || sourceBlob.includes("confirm")) {
      return { role: "color/feedback/success" };
    }
    if (sourceBlob.includes("info")) {
      return { role: "color/feedback/info" };
    }

    switch (ctx.cssProperty) {
      case "background-color":
        if (element === "body" || element === "main" || element === "html") {
          return { role: "color/surface/page" };
        }
        if (element === "button" || ctx.ariaRole === "button") {
          return { role: "color/action/primary" };
        }
        return { role: "color/surface/card", fallback: true };
      case "border-color":
        return { role: "color/border/default" };
      case "color":
        if (element === "a") return { role: "color/text/link" };
        if (element !== undefined && HEADING_ELEMENTS.has(element)) {
          return { role: "color/text/primary" };
        }
        if (element === "p" || element === "body") return { role: "color/text/primary" };
        return undefined;
      default:
        return undefined;
    }
  }

  if (token.type === "typography" && element !== undefined) {
    if (element === "h1" && token.value.fontSize >= 40) return { role: "type/display" };
    if (HEADING_ELEMENTS.has(element)) return { role: "type/heading" };
    if (element === "p" || element === "body") return { role: "type/body" };
  }

  return undefined;
}

// ─────────────────────────────────────────
// B.4 scale slots — by ascending size, only when the values fit
// ─────────────────────────────────────────

type AddHint = (tokenId: string, role: string, source: SuggestionSource) => void;

function suggestScaleSlots(
  tokens: StyleSnapToken[],
  perToken: Map<string, Map<string, SuggestionSource>>,
  addHint: AddHint,
): void {
  const hasHints = (id: string) => (perToken.get(id)?.size ?? 0) > 0;
  assignNumericSlots(tokens, "spacing", SPACE_SLOTS.map((s) => s.role), hasHints, addHint);
  assignNumericSlots(
    tokens,
    "border-radius",
    RADIUS_SLOTS.filter((s) => s.role !== "radius/full").map((s) => s.role),
    hasHints,
    addHint,
  );
  assignNumericSlots(
    tokens,
    "border-width",
    BORDER_WIDTH_SLOTS.map((s) => s.role),
    hasHints,
    addHint,
  );
  assignShadowSlots(tokens, hasHints, addHint);
}

function assignNumericSlots(
  tokens: StyleSnapToken[],
  type: "spacing" | "border-radius" | "border-width",
  slots: string[],
  hasHints: (id: string) => boolean,
  addHint: AddHint,
): void {
  const group = tokens.filter(
    (t): t is StyleSnapToken & { value: number } => t.type === type,
  );
  const unassigned = group.filter((t) => !hasHints(t.id));
  const values = [...new Set(unassigned.map((t) => t.value))].sort((a, b) => a - b);
  // More distinct values than slots ⇒ ambiguous; leave it to the user.
  if (values.length === 0 || values.length > slots.length) return;
  const slotByValue = new Map(values.map((v, i) => [v, slots[i]]));
  for (const token of unassigned) {
    addHint(token.id, slotByValue.get(token.value)!, "scale");
  }
}

/** Shadows rank by visual size (blur + |offsetY| of the first layer). */
function shadowSize(token: ShadowToken): number {
  const layer = token.value[0];
  return layer.blur + Math.abs(layer.offsetY);
}

function assignShadowSlots(
  tokens: StyleSnapToken[],
  hasHints: (id: string) => boolean,
  addHint: AddHint,
): void {
  const slots = SHADOW_SLOTS.map((s) => s.role);
  const group = tokens.filter((t): t is ShadowToken => t.type === "shadow");
  const unassigned = group.filter((t) => !hasHints(t.id));
  const sizes = [...new Set(unassigned.map(shadowSize))].sort((a, b) => a - b);
  if (sizes.length === 0 || sizes.length > slots.length) return;
  const slotBySize = new Map(sizes.map((s, i) => [s, slots[i]]));
  for (const token of unassigned) {
    addHint(token.id, slotBySize.get(shadowSize(token))!, "scale");
  }
}
