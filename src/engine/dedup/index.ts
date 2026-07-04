// StyleSnap dedup engine (Phase 3) — PRD §7.3 / Appendix A, implemented as
// pure functions. Detection is suggestive, never destructive (FR-11): this
// module only *flags*; merging is a separate, user-initiated, reversible step
// (see merge.ts).

import type { StyleSnapToken, TokenType } from "../../contract/types";
import { leaderCluster, type DedupCluster } from "./cluster";
import {
  colorDistance,
  DUP_T,
  gradientDistance,
  OPACITY_EPSILON,
  shadowDistance,
  SIM_T,
  typographyDistance,
} from "./distances";
import { clusterNumeric } from "./numeric";

export type { ClusterMember, DedupCluster, FlagLevel } from "./cluster";
export { colorDeltaEOK, normalizeTypography, typographyDupKey } from "./distances";
export * from "./merge";

// A.6 — one sensitivity slider, three positions, scaling every type's
// thresholds uniformly. Re-flags live; never re-merges anything by itself.
export type Sensitivity = "strict" | "default" | "loose";

export const SENSITIVITY_FACTOR: Record<Sensitivity, number> = {
  strict: 0.5,
  default: 1,
  loose: 1.5,
};

// A.2 — ΔEOK thresholds at ×1.
const COLOR_DUP_T = 0.02;
const COLOR_SIM_T = 0.05;

const TYPE_ORDER: readonly TokenType[] = [
  "color",
  "gradient",
  "typography",
  "spacing",
  "border-radius",
  "border-width",
  "shadow",
];

/**
 * Detect duplicate/similar clusters across the given tokens (typically the
 * post-merge view). Output is deterministic: same input ⇒ identical clusters.
 */
export function detectClusters(
  tokens: StyleSnapToken[],
  sensitivity: Sensitivity = "default",
): DedupCluster[] {
  const factor = SENSITIVITY_FACTOR[sensitivity];
  const byType = new Map<TokenType, StyleSnapToken[]>();
  for (const token of tokens) {
    const group = byType.get(token.type) ?? [];
    group.push(token);
    byType.set(token.type, group);
  }

  const clusters: DedupCluster[] = [];
  for (const type of TYPE_ORDER) {
    const group = byType.get(type) ?? [];
    if (group.length < 2) continue;
    switch (type) {
      case "color":
        clusters.push(
          ...leaderCluster(group, colorDistance, COLOR_DUP_T * factor, COLOR_SIM_T * factor),
        );
        break;
      case "gradient":
        clusters.push(...leaderCluster(group, gradientDistance(factor), DUP_T, SIM_T));
        break;
      case "typography":
        clusters.push(...leaderCluster(group, typographyDistance(factor), DUP_T, SIM_T));
        break;
      case "spacing":
      case "border-radius":
        clusters.push(...clusterNumeric(group, factor, 1));
        break;
      case "border-width":
        clusters.push(...clusterNumeric(group, factor, 0.5)); // A.3: 0.5px floor
        break;
      case "shadow":
        clusters.push(...leaderCluster(group, shadowDistance(factor), DUP_T, SIM_T));
        break;
    }
  }
  return clusters;
}

/**
 * FR-6 badge levels: canonical + exact-duplicate members show DUP; similar
 * members (and a canonical whose cluster is similar-only) show ~SIM.
 */
export function flagLevels(clusters: DedupCluster[]): Map<string, "dup" | "sim"> {
  const flags = new Map<string, "dup" | "sim">();
  for (const cluster of clusters) {
    const hasDup = cluster.members.some((m) => m.level === "duplicate");
    flags.set(cluster.canonical.id, hasDup ? "dup" : "sim");
    for (const member of cluster.members) {
      flags.set(member.token.id, member.level === "duplicate" ? "dup" : "sim");
    }
  }
  return flags;
}

export { OPACITY_EPSILON };
