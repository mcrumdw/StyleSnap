// PRD §7.4 — merge as data, not mutation.
//
// The pool's raw tokens are never modified. A merge is a record; the visible
// workspace is a *view* computed by applyMerges. Un-merge = drop the record,
// which restores the original state exactly (FR-13 — reversible until Create
// System). The absorbed tokens (with their `context` role hints, A.1) stay in
// the raw pool for Phase 4 role derivation.

import type { StyleSnapToken } from "../../contract/types";

export interface MergeRecord {
  /** The surviving token's id — the user's pick, canonical by default. */
  survivorId: string;
  /** Ids absorbed into the survivor. */
  mergedIds: string[];
  mergedAt: string; // ISO 8601
}

interface HasToken {
  token: StyleSnapToken;
}

/**
 * Apply merge records in order to any token-carrying items. The survivor
 * inherits Σ occurrences and accumulates `mergedFrom`; absorbed items leave
 * the view. Invalid records (unknown ids) are skipped, not fatal.
 */
export function applyMerges<T extends HasToken>(items: T[], merges: MergeRecord[]): T[] {
  if (merges.length === 0) return items;

  const byId = new Map<string, T>(items.map((item) => [item.token.id, item]));
  const order = items.map((item) => item.token.id);

  for (const merge of merges) {
    const survivor = byId.get(merge.survivorId);
    if (!survivor) continue;
    let absorbedOccurrences = 0;
    const absorbedIds: string[] = [];
    for (const id of merge.mergedIds) {
      const absorbed = byId.get(id);
      if (!absorbed || id === merge.survivorId) continue;
      absorbedOccurrences += absorbed.token.occurrences;
      // A token that was itself a merge survivor passes its mergedFrom along.
      absorbedIds.push(...(absorbed.token.mergedFrom ?? []), id);
      byId.delete(id);
    }
    if (absorbedIds.length === 0) continue;
    byId.set(merge.survivorId, {
      ...survivor,
      token: {
        ...survivor.token,
        merged: true,
        occurrences: survivor.token.occurrences + absorbedOccurrences,
        mergedFrom: [...(survivor.token.mergedFrom ?? []), ...absorbedIds],
      },
    });
  }

  return order.filter((id) => byId.has(id)).map((id) => byId.get(id)!);
}
