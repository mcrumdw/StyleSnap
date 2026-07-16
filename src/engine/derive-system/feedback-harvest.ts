// PRD Appendix C.4 tier 2 — harvest unassigned capture colors into feedback
// roles before conventional-hue derivation. Deterministic: same capture →
// same harvest.

import type { StyleSnapToken, TokenContext } from "../../contract/types";
import { FEEDBACK_HUES, type FeedbackRole } from "./color";
import { hueDistance, isNeutral, NEUTRAL_CHROMA, oklchOf } from "./oklch";

export const FEEDBACK_ROLE_PATHS = {
  success: "color/feedback/success",
  warning: "color/feedback/warning",
  error: "color/feedback/error",
  info: "color/feedback/info",
} as const satisfies Record<FeedbackRole, string>;

const ROLE_KEYWORDS: Record<FeedbackRole, readonly string[]> = {
  error: ["error", "danger", "destructive", "fail", "invalid"],
  warning: ["warning", "caution", "warn"],
  success: ["success", "confirm", "positive", "ok"],
  info: ["info", "information", "note"],
};

/** OKLCH hue bands when no keyword/context signal exists. */
const HUE_BANDS: Record<FeedbackRole, { min: number; max: number }> = {
  error: { min: 15, max: 45 },
  warning: { min: 55, max: 85 },
  success: { min: 130, max: 170 },
  info: { min: 220, max: 270 },
};

const CONFIDENCE = {
  authored: 0.95,
  keyword: 0.9,
  context: 0.6,
  hue: 0.5,
} as const;

export interface HarvestedFeedback {
  role: FeedbackRole;
  token: StyleSnapToken;
  method: string;
}

interface FeedbackCandidate {
  role: FeedbackRole;
  token: StyleSnapToken;
  confidence: number;
  signal: string;
}

function candidateContexts(
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

function textBlob(token: StyleSnapToken, ctx: TokenContext): string {
  return [
    token.source,
    token.name,
    ctx.authoredName,
    ctx.selector,
    ctx.element,
    ctx.ariaRole,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function keywordRole(blob: string): FeedbackRole | undefined {
  const compounds: Array<[string, FeedbackRole]> = [
    ["alert-warning", "warning"],
    ["toast-warning", "warning"],
    ["alert-success", "success"],
    ["toast-success", "success"],
    ["alert-info", "info"],
    ["toast-info", "info"],
  ];
  for (const [phrase, role] of compounds) {
    if (blob.includes(phrase)) return role;
  }
  for (const role of ["error", "warning", "success", "info"] as const) {
    if (ROLE_KEYWORDS[role].some((kw) => blob.includes(kw))) return role;
  }
  return undefined;
}

function contextRole(ctx: TokenContext, blob: string): FeedbackRole | undefined {
  if (ctx.ariaRole === "alert") return "error";
  if (ctx.ariaRole === "status") return "success";
  if (ctx.ariaRole === "note") return "info";
  if (blob.includes("alert-warning") || blob.includes("toast-warning")) return "warning";
  if (blob.includes("alert-success") || blob.includes("toast-success")) return "success";
  if (blob.includes("alert-info") || blob.includes("toast-info")) return "info";
  return undefined;
}

function hueRole(h: number, c: number): FeedbackRole | undefined {
  if (c < NEUTRAL_CHROMA) return undefined;
  for (const role of ["error", "warning", "success", "info"] as const) {
    const { min, max } = HUE_BANDS[role];
    if (h >= min && h <= max) return role;
  }
  return undefined;
}

function collidesWithPrimary(
  primaryHue: number | undefined,
  hue: number,
  confidence: number,
): boolean {
  if (primaryHue === undefined) return false;
  // Collision guard applies to hue-band guesses only — context/keyword signals
  // are intentional semantic colors even when near the primary hue.
  if (confidence > CONFIDENCE.hue) return false;
  return hueDistance(primaryHue, hue) < 15;
}

function candidatesForToken(
  token: StyleSnapToken,
  rawById: ReadonlyMap<string, StyleSnapToken>,
  primaryHue: number | undefined,
): FeedbackCandidate[] {
  if (token.type !== "color" || token.opacity !== 1 || isNeutral(token.value)) return [];

  const { h, c } = oklchOf(token.value);
  const out: FeedbackCandidate[] = [];
  const seen = new Set<FeedbackRole>();

  const add = (role: FeedbackRole, confidence: number, signal: string) => {
    if (seen.has(role)) return;
    if (collidesWithPrimary(primaryHue, h, confidence)) return;
    seen.add(role);
    out.push({ role, token, confidence, signal });
  };

  const sourceBlob = [token.source, token.name].filter(Boolean).join(" ").toLowerCase();

  for (const ctx of candidateContexts(token, rawById)) {
    const blob = textBlob(token, ctx);
    const authored = ctx.authoredName?.toLowerCase().trim();
    if (authored !== undefined) {
      for (const role of ["success", "warning", "error", "info"] as const) {
        if (authored === FEEDBACK_ROLE_PATHS[role]) {
          add(role, CONFIDENCE.authored, `authored name "${authored}"`);
        }
      }
    }
    const kw = keywordRole(blob);
    if (kw) add(kw, CONFIDENCE.keyword, "keyword in capture context");
    const ctxRole = contextRole(ctx, blob);
    if (ctxRole) add(ctxRole, CONFIDENCE.context, `DOM context (${ctx.ariaRole ?? blob})`);
  }

  const sourceKeyword = keywordRole(sourceBlob);
  if (sourceKeyword) add(sourceKeyword, CONFIDENCE.keyword, "keyword in capture source");

  const hueMatch = hueRole(h, c);
  if (hueMatch) add(hueMatch, CONFIDENCE.hue, `hue band (${FEEDBACK_HUES[hueMatch]}°)`);

  return out;
}

/**
 * Match unassigned color tokens to feedback roles. One token → at most one
 * role; one role → at most one token. Skips roles already in `assignments`.
 */
export function harvestFeedbackColors(
  tokens: StyleSnapToken[],
  assignments: ReadonlyMap<string, string>,
  primaryHex: string | undefined,
  rawById: ReadonlyMap<string, StyleSnapToken> = new Map(),
): HarvestedFeedback[] {
  const assignedTokenIds = new Set(assignments.values());
  const primaryHue = primaryHex ? oklchOf(primaryHex).h : undefined;
  const openRoles = new Set(
    (["success", "warning", "error", "info"] as const).filter(
      (role) => !assignments.has(FEEDBACK_ROLE_PATHS[role]),
    ),
  );
  if (openRoles.size === 0) return [];

  const all: FeedbackCandidate[] = [];
  for (const token of tokens) {
    if (assignedTokenIds.has(token.id)) continue;
    all.push(...candidatesForToken(token, rawById, primaryHue));
  }

  all.sort(
    (a, b) =>
      b.confidence - a.confidence ||
      b.token.occurrences - a.token.occurrences ||
      (a.token.id < b.token.id ? -1 : 1),
  );

  const takenRoles = new Set<FeedbackRole>();
  const takenTokens = new Set<string>();
  const results: HarvestedFeedback[] = [];

  for (const candidate of all) {
    if (!openRoles.has(candidate.role)) continue;
    if (takenRoles.has(candidate.role)) continue;
    if (takenTokens.has(candidate.token.id)) continue;
    takenRoles.add(candidate.role);
    takenTokens.add(candidate.token.id);
    results.push({
      role: candidate.role,
      token: candidate.token,
      method: `harvested from capture — ${candidate.signal}`,
    });
  }

  return results.sort((a, b) => a.role.localeCompare(b.role));
}
