// PRD Appendix A.1 — occurrence-led "leader" clustering.
//
// Every candidate is measured against a fixed leader (never transitively) so
// clusters can't chain (A≈B, B≈C but A≠C collapsing into one). The leader —
// the most-used remaining value — is the canonical merge-survivor candidate
// (FR-10). O(n²), deterministic.

import type { StyleSnapToken } from "../../contract/types";

export type FlagLevel = "duplicate" | "similar";

export interface ClusterMember {
  token: StyleSnapToken;
  /** Distance to the canonical token, for the merge dialog (DESIGN.md §5.1). */
  distance: number;
  level: FlagLevel;
}

export interface DedupCluster {
  /** Stable id — the canonical token's id. */
  id: string;
  canonical: StyleSnapToken;
  members: ClusterMember[];
}

export type DistanceFn = (a: StyleSnapToken, b: StyleSnapToken) => number;

/** Deterministic tie-break for equal occurrences: value JSON, then id. */
function stableKey(token: StyleSnapToken): string {
  const opacity = token.type === "color" ? `@${token.opacity}` : "";
  return `${JSON.stringify(token.value)}${opacity}|${token.id}`;
}

export function leaderCluster(
  tokens: StyleSnapToken[],
  distance: DistanceFn,
  dupT: number,
  simT: number,
): DedupCluster[] {
  let pool = [...tokens].sort(
    (a, b) => b.occurrences - a.occurrences || (stableKey(a) < stableKey(b) ? -1 : 1),
  );
  const clusters: DedupCluster[] = [];

  while (pool.length > 0) {
    const leader = pool[0];
    const members: ClusterMember[] = [];
    const rest: StyleSnapToken[] = [];
    for (const t of pool.slice(1)) {
      const d = distance(leader, t);
      if (d <= simT) {
        members.push({ token: t, distance: d, level: d <= dupT ? "duplicate" : "similar" });
      } else {
        rest.push(t);
      }
    }
    if (members.length > 0) {
      clusters.push({ id: leader.id, canonical: leader, members });
    }
    pool = rest;
  }

  return clusters;
}
