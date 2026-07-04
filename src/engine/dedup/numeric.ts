// PRD Appendix A.3 — 1-D gap clustering for spacing / border-radius /
// border-width. Hybrid absolute+relative tolerance so it behaves at 4px and
// 64px alike: 14/15/16 cluster, 4 and 8 never collapse.

import type { BorderRadiusToken, BorderWidthToken, SpacingToken, StyleSnapToken } from "../../contract/types";
import type { DedupCluster } from "./cluster";
import { numericTol } from "./distances";

type NumericToken = SpacingToken | BorderRadiusToken | BorderWidthToken;

/** Distance from a clean 4px scale — the canonical tie-break ("snap"). */
function gridDistance(value: number): number {
  const mod = ((value % 4) + 4) % 4;
  return Math.min(mod, 4 - mod);
}

export function clusterNumeric(
  tokens: StyleSnapToken[],
  factor: number,
  floor: number,
): DedupCluster[] {
  const numeric = tokens as NumericToken[];
  const sorted = [...numeric].sort(
    (a, b) => a.value - b.value || b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1),
  );

  // Walk ascending; a gap larger than tol(clusterMax) starts a new cluster.
  const runs: NumericToken[][] = [];
  for (const token of sorted) {
    const run = runs[runs.length - 1];
    const max = run?.[run.length - 1]?.value;
    if (run && token.value - max <= numericTol(max, factor, floor)) {
      run.push(token);
    } else {
      runs.push([token]);
    }
  }

  const clusters: DedupCluster[] = [];
  for (const run of runs) {
    if (run.length < 2) continue;
    // Canonical = highest occurrence; tie-break → nearest 4px grid step, then id.
    const canonical = [...run].sort(
      (a, b) =>
        b.occurrences - a.occurrences ||
        gridDistance(a.value) - gridDistance(b.value) ||
        (a.id < b.id ? -1 : 1),
    )[0];
    clusters.push({
      id: canonical.id,
      canonical,
      members: run
        .filter((t) => t.id !== canonical.id)
        .map((t) => ({
          token: t,
          distance: Math.abs(t.value - canonical.value),
          level: t.value === canonical.value ? ("duplicate" as const) : ("similar" as const),
        })),
    });
  }
  return clusters;
}
