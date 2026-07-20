// PRD Appendix B — the canonical role taxonomy as data (Phase 4).
//
// This is the FIXED vocabulary behind role assignment (§7.5), the
// completeness checklist (FR-18, Phase 5), and the design.md structure (§11).
// Naming is slash-nested — Figma Variables' native nesting. Array order IS
// Appendix B order (the canonical sort uses it). Roles come from here only;
// a role is never forced (FR-16) — unmatched tokens stay primitives.

import type { TokenType } from "../../contract/types";

export interface RoleDefinition {
  role: string;
  /** The token type this role can be assigned to. */
  tokenType: TokenType;
  meaning: string;
  /** ✅ in Appendix B — needed for the B.5 completeness checklist. */
  required: boolean;
  /**
   * B.2's "type/body + at least one of display/heading": members of a named
   * group satisfy the requirement together (evaluated in Phase 5).
   */
  requiredOneOf?: string;
}

// B.1 — Color roles (17)
export const COLOR_ROLES: RoleDefinition[] = [
  { role: "color/text/primary", tokenType: "color", meaning: "Default text", required: true },
  { role: "color/text/muted", tokenType: "color", meaning: "Secondary text, captions", required: true },
  { role: "color/text/inverse", tokenType: "color", meaning: "Text on dark/brand fills", required: false },
  { role: "color/text/link", tokenType: "color", meaning: "Links", required: false },
  { role: "color/surface/page", tokenType: "color", meaning: "App/page background", required: true },
  { role: "color/surface/card", tokenType: "color", meaning: "Cards, panels, inputs", required: true },
  { role: "color/surface/overlay", tokenType: "color", meaning: "Modal scrim", required: false },
  { role: "color/action/primary", tokenType: "color", meaning: "Primary buttons, active nav", required: true },
  { role: "color/action/primary-hover", tokenType: "color", meaning: "Hover state", required: true },
  { role: "color/action/primary-active", tokenType: "color", meaning: "Pressed state", required: false },
  { role: "color/action/secondary", tokenType: "color", meaning: "Secondary CTAs", required: false },
  { role: "color/border/default", tokenType: "color", meaning: "Card/input borders, dividers", required: true },
  { role: "color/border/focus", tokenType: "color", meaning: "Keyboard focus ring", required: true },
  { role: "color/feedback/success", tokenType: "color", meaning: "Confirmation", required: true },
  { role: "color/feedback/warning", tokenType: "color", meaning: "Caution", required: true },
  { role: "color/feedback/error", tokenType: "color", meaning: "Errors, destructive", required: true },
  { role: "color/feedback/info", tokenType: "color", meaning: "Neutral information", required: true },
];

// B.2 — Typography roles (6)
export const TYPE_ROLES: RoleDefinition[] = [
  { role: "type/display", tokenType: "typography", meaning: "Hero/display headings", required: false, requiredOneOf: "display-or-heading" },
  { role: "type/heading", tokenType: "typography", meaning: "Section headings", required: false, requiredOneOf: "display-or-heading" },
  { role: "type/subheading", tokenType: "typography", meaning: "Sub-section headings", required: false },
  { role: "type/body", tokenType: "typography", meaning: "Body copy", required: true },
  { role: "type/caption", tokenType: "typography", meaning: "Captions, metadata", required: false },
  { role: "type/mono", tokenType: "typography", meaning: "Code, token values", required: false },
];

// B.3 — Foundation scales: named slots assigned to deduped primitives.
// Completeness minima (≥4 spacing steps etc.) are evaluated in Phase 5.
export const SPACE_SLOTS: RoleDefinition[] = ["xs", "sm", "md", "lg", "xl", "2xl"].map((step) => ({
  role: `space/${step}`,
  tokenType: "spacing" as TokenType,
  meaning: `Spacing scale step ${step}`,
  required: false,
}));

/**
 * B.3 semantic spacing jobs (§2.47) — System roles that point at scale steps.
 * Completeness requires `space/page`; the rest are suggested.
 */
export const SPACE_SEMANTIC_ROLES: RoleDefinition[] = [
  {
    role: "space/page",
    tokenType: "spacing",
    meaning:
      "Page / container horizontal inset — default 2× space/xl, clamped 32–160px; never flush to the viewport edge",
    required: true,
  },
  {
    role: "space/section",
    tokenType: "spacing",
    meaning: "Between major sections",
    required: false,
  },
  {
    role: "space/stack",
    tokenType: "spacing",
    meaning: "Vertical rhythm between related blocks (title→body, paragraphs)",
    required: false,
  },
  {
    role: "space/inset",
    tokenType: "spacing",
    meaning: "Padding inside cards, buttons, and inputs",
    required: false,
  },
];

/** Page inset bounds (§2.49) — `clamp(2 × space/xl, min, max)`. */
export const PAGE_INSET_MIN_PX = 32;
export const PAGE_INSET_MAX_PX = 160;

/** Derive page margin/padding from the xl scale step. */
export function derivePageInsetPx(xlPx: number): number {
  const doubled = xlPx * 2;
  return Math.min(PAGE_INSET_MAX_PX, Math.max(PAGE_INSET_MIN_PX, doubled));
}

/** Scale step each semantic role prefers (fallback chain). `space/page` is derived separately. */
export const SPACE_SEMANTIC_FROM_SCALE: ReadonlyArray<{
  role: string;
  from: readonly string[];
}> = [
  { role: "space/section", from: ["space/2xl", "space/xl"] },
  { role: "space/stack", from: ["space/lg", "space/md"] },
  { role: "space/inset", from: ["space/sm", "space/md"] },
];

export const SPACE_SCALE_ROLES = new Set(SPACE_SLOTS.map((s) => s.role));

export function isSpaceScaleRole(role: string): boolean {
  return SPACE_SCALE_ROLES.has(role);
}

export function isSpaceSemanticRole(role: string): boolean {
  return SPACE_SEMANTIC_ROLES.some((d) => d.role === role);
}

export const RADIUS_SLOTS: RoleDefinition[] = ["sm", "md", "lg", "full"].map((step) => ({
  role: `radius/${step}`,
  tokenType: "border-radius" as TokenType,
  meaning: `Radius ${step}`,
  required: false,
}));

export const SHADOW_SLOTS: RoleDefinition[] = ["sm", "md", "lg"].map((step) => ({
  role: `shadow/${step}`,
  tokenType: "shadow" as TokenType,
  meaning: `Elevation ${step}`,
  required: false,
}));

/**
 * B.3 effect semantics (§2.50) — inset depth and backdrop blur.
 * Seeded from capture when present; not required for completeness.
 */
export const SHADOW_INSET_ROLE: RoleDefinition = {
  role: "shadow/inset",
  tokenType: "shadow",
  meaning: "Inner / inset shadow — pressed wells, recessed inputs, carved depth",
  required: false,
};

export const BLUR_BACKDROP_ROLE: RoleDefinition = {
  role: "blur/backdrop",
  tokenType: "shadow",
  meaning: "Frosted glass / modal scrim backdrop blur",
  required: false,
};

export const EFFECT_SEMANTIC_ROLES: RoleDefinition[] = [SHADOW_INSET_ROLE, BLUR_BACKDROP_ROLE];

export function isElevationRole(role: string): boolean {
  return SHADOW_SLOTS.some((s) => s.role === role);
}

export function isEffectSemanticRole(role: string): boolean {
  return EFFECT_SEMANTIC_ROLES.some((d) => d.role === role);
}

export const BORDER_WIDTH_SLOTS: RoleDefinition[] = ["default", "thick"].map((step) => ({
  role: `border-width/${step}`,
  tokenType: "border-width" as TokenType,
  meaning: `Border width ${step}`,
  required: false,
}));

/** Every role, in Appendix B order (the canonical role sort). */
export const ALL_ROLES: RoleDefinition[] = [
  ...COLOR_ROLES,
  ...TYPE_ROLES,
  ...SPACE_SLOTS,
  ...SPACE_SEMANTIC_ROLES,
  ...RADIUS_SLOTS,
  ...SHADOW_SLOTS,
  ...EFFECT_SEMANTIC_ROLES,
  ...BORDER_WIDTH_SLOTS,
];

const BY_ROLE = new Map(ALL_ROLES.map((def) => [def.role, def]));
const ORDER = new Map(ALL_ROLES.map((def, i) => [def.role, i]));

export function roleDefinition(role: string): RoleDefinition | undefined {
  return BY_ROLE.get(role);
}

/**
 * Appendix B position for the canonical sort; role-less sorts last.
 * User-defined roles (§2.30) share one bucket after B — callers secondary-sort
 * by role string so customs stay deterministic.
 */
export function roleOrderIndex(role: string | undefined): number {
  if (role === undefined) return Number.MAX_SAFE_INTEGER;
  return ORDER.get(role) ?? ALL_ROLES.length;
}

export function rolesForType(type: TokenType): RoleDefinition[] {
  return ALL_ROLES.filter((def) => def.tokenType === type);
}

export function isValidRole(role: string, type: TokenType): boolean {
  return BY_ROLE.get(role)?.tokenType === type;
}
