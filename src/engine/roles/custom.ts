// User-defined semantic roles beyond Appendix B (DECISIONS.md §2.30 / §2.46).
// Completeness still uses the lean Appendix B checklist only; custom roles
// export and assign like any other slot but never count as required gaps.

import type { TokenType } from "../../contract/types";
import { ALL_ROLES, type RoleDefinition } from "./taxonomy";

const CANONICAL = new Set(ALL_ROLES.map((d) => d.role));

/** One path segment: `card`, `table-cell`, `2xl` — no spaces, no uppercase. */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Shadow-typed tokens (box-shadow + encoded backdrop blur) may use these
 * role prefixes. Appendix B elevation stays `shadow/*`; backdrop blur and
 * other non-elevation effects use `effect/` or `blur/` (§2.46).
 */
export const SHADOW_CUSTOM_PREFIXES = ["shadow/", "effect/", "blur/"] as const;
export type ShadowCustomPrefix = (typeof SHADOW_CUSTOM_PREFIXES)[number];

/** Role prefixes longer-first so `border-width/` wins over a hypothetical `border/`. */
const ROLE_PREFIXES = [
  "border-width/",
  "color/",
  "type/",
  "space/",
  "radius/",
  "shadow/",
  "effect/",
  "blur/",
] as const;

/**
 * Role prefix for a capture token type. Gradients have no role taxonomy.
 * Note: border *color* lives under `color/border/*`; border *width* under
 * `border-width/*` — there is no bare `border/` prefix.
 * Shadow defaults to `shadow/`; callers may pass `effect/` or `blur/` via
 * `buildCustomRole` for non-elevation effects.
 */
export function rolePrefixForType(type: TokenType): string | null {
  switch (type) {
    case "color":
      return "color/";
    case "typography":
      return "type/";
    case "spacing":
      return "space/";
    case "border-radius":
      return "radius/";
    case "border-width":
      return "border-width/";
    case "shadow":
      return "shadow/";
    case "gradient":
      return null;
  }
}

export function tokenTypeForRolePrefix(prefix: string): TokenType | null {
  switch (prefix) {
    case "color/":
      return "color";
    case "type/":
      return "typography";
    case "space/":
      return "spacing";
    case "radius/":
      return "border-radius";
    case "border-width/":
      return "border-width";
    case "shadow/":
    case "effect/":
    case "blur/":
      return "shadow";
    default:
      return null;
  }
}

/** True when a role belongs on the Effects category page. */
export function isEffectsCategoryRole(role: string): boolean {
  return (SHADOW_CUSTOM_PREFIXES as readonly string[]).some((p) => role.startsWith(p));
}

/** Normalize free text into slash-nested kebab segments, or null if invalid. */
export function normalizeRolePath(raw: string): string | null {
  const cleaned = raw
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/\/+/g, "/")
    .replace(/^\/|\/$/g, "");
  if (!cleaned) return null;
  const parts = cleaned.split("/");
  if (!parts.every((p) => SEGMENT.test(p))) return null;
  return parts.join("/");
}

export function isCanonicalRole(role: string): boolean {
  return CANONICAL.has(role);
}

function resolvePrefix(type: TokenType, prefixOverride?: string): string | null {
  const defaultPrefix = rolePrefixForType(type);
  if (!defaultPrefix) return null;
  if (!prefixOverride) return defaultPrefix;
  if (type === "shadow") {
    return (SHADOW_CUSTOM_PREFIXES as readonly string[]).includes(prefixOverride)
      ? prefixOverride
      : null;
  }
  return prefixOverride === defaultPrefix ? defaultPrefix : null;
}

/**
 * Build a custom role under the type prefix. Rejects Appendix B collisions and
 * invalid paths. Example: type `border-width` + path `table-cell` →
 * `border-width/table-cell`; type `color` + `border/card` → `color/border/card`.
 * For shadow tokens, pass `prefixOverride` of `effect/` or `blur/` for
 * backdrop-blur roles (default remains `shadow/`).
 */
export function buildCustomRole(
  type: TokenType,
  pathAfterPrefix: string,
  prefixOverride?: string,
): string | null {
  const prefix = resolvePrefix(type, prefixOverride);
  if (!prefix) return null;
  const path = normalizeRolePath(pathAfterPrefix);
  if (!path) return null;
  const role = `${prefix}${path}`;
  if (isCanonicalRole(role)) return null;
  return role;
}

export function isAllowedCustomRole(role: string, type: TokenType): boolean {
  if (isCanonicalRole(role)) return false;
  if (type === "shadow") {
    for (const prefix of SHADOW_CUSTOM_PREFIXES) {
      if (!role.startsWith(prefix)) continue;
      const rest = role.slice(prefix.length);
      return rest.length > 0 && normalizeRolePath(rest) === rest;
    }
    return false;
  }
  const prefix = rolePrefixForType(type);
  if (!prefix || !role.startsWith(prefix)) return false;
  const rest = role.slice(prefix.length);
  return normalizeRolePath(rest) === rest;
}

export function customRoleDefinition(role: string, type: TokenType): RoleDefinition {
  return {
    role,
    tokenType: type,
    meaning: "Custom semantic role — exports with the system; not required for completeness",
    required: false,
  };
}

/** Infer declared custom roles from assignments (draft migration). */
export function inferCustomRoles(assignments: Record<string, string>): string[] {
  const out: string[] = [];
  for (const role of Object.keys(assignments).sort()) {
    if (isCanonicalRole(role)) continue;
    const type = tokenTypeFromRole(role);
    if (type && isAllowedCustomRole(role, type)) out.push(role);
  }
  return out;
}

export function tokenTypeFromRole(role: string): TokenType | null {
  for (const prefix of ROLE_PREFIXES) {
    if (role.startsWith(prefix)) return tokenTypeForRolePrefix(prefix);
  }
  return null;
}
