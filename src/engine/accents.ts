// Design accents — captured colors that aren't primary/secondary/role-assigned.
// Auto-seeded into "use sparingly"; user can add/remove. DECISIONS §2.25.

import type { StyleSnapToken } from "../contract/types";
import { isNeutral } from "./derive-system/oklch";

/**
 * Every remaining captured non-neutral color that isn't the primary or
 * secondary anchor and isn't filling a color role — the FIFA gold, navy, etc.
 * Deterministic: occurrences desc → id asc.
 */
export function computeAutoAccentIds(
  tokens: ReadonlyArray<StyleSnapToken>,
  assignments: ReadonlyMap<string, string> | Record<string, string>,
  primaryId: string | undefined,
  secondaryId: string | undefined,
): string[] {
  const assigned = new Set(
    assignments instanceof Map ? assignments.values() : Object.values(assignments),
  );
  const reserved = new Set([primaryId, secondaryId].filter(Boolean) as string[]);

  return tokens
    .filter(
      (t): t is StyleSnapToken & { type: "color" } =>
        t.type === "color" &&
        !t.id.startsWith("derived_") &&
        t.opacity === 1 &&
        !isNeutral(t.value) &&
        !reserved.has(t.id) &&
        !assigned.has(t.id),
    )
    .sort((a, b) => b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1))
    .map((t) => t.id);
}

/** Effective accent list: explicit user list, or auto-seed when unset. */
export function effectiveAccentIds(
  explicit: string[] | undefined,
  tokens: ReadonlyArray<StyleSnapToken>,
  assignments: ReadonlyMap<string, string> | Record<string, string>,
  primaryId: string | undefined,
  secondaryId: string | undefined,
): string[] {
  if (explicit !== undefined) {
    const known = new Set(tokens.map((t) => t.id));
    return explicit.filter((id) => known.has(id));
  }
  return computeAutoAccentIds(tokens, assignments, primaryId, secondaryId);
}
