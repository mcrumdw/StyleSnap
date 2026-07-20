// User-defined semantic roles beyond Appendix B (DECISIONS.md §2.30).
// Completeness still uses the lean Appendix B checklist only; custom roles
// export and assign like any other slot but never count as required gaps.

import type { TokenType } from "../../contract/types";
import { ALL_ROLES, type RoleDefinition } from "./taxonomy";

const CANONICAL = new Set(ALL_ROLES.map((d) => d.role));

/** One path segment: `card`, `table-cell`, `2xl` — no spaces, no uppercase. */
const SEGMENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Role prefix for a capture token type. Gradients have no role taxonomy.
 * Note: border *color* lives under `color/border/*`; border *width* under
 * `border-width/*` — there is no bare `border/` prefix.
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
      return "shadow";
    default:
      return null;
  }
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

/**
 * Build a custom role under the type prefix. Rejects Appendix B collisions and
 * invalid paths. Example: type `border-width` + path `table-cell` →
 * `border-width/table-cell`; type `color` + `border/card` → `color/border/card`.
 */
export function buildCustomRole(type: TokenType, pathAfterPrefix: string): string | null {
  const prefix = rolePrefixForType(type);
  if (!prefix) return null;
  const path = normalizeRolePath(pathAfterPrefix);
  if (!path) return null;
  const role = `${prefix}${path}`;
  if (isCanonicalRole(role)) return null;
  return role;
}

export function isAllowedCustomRole(role: string, type: TokenType): boolean {
  if (isCanonicalRole(role)) return false;
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
  for (const prefix of ["border-width/", "color/", "type/", "space/", "radius/", "shadow/"] as const) {
    if (role.startsWith(prefix)) return tokenTypeForRolePrefix(prefix);
  }
  return null;
}
