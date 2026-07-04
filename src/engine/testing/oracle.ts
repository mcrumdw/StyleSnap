// Test-only helper: the post-review state described by
// docs/examples/design.example.md (the export oracle) — both fixtures
// imported, the oracle's merges applied, its roles confirmed, its names set.
// Shared by the completeness (Phase 5) and export (Phase 6) acceptance tests.

import { readFileSync } from "node:fs";
import { parseStyleSnapExport } from "../../contract/schema";
import type { StyleSnapMeta, StyleSnapToken } from "../../contract/types";
import { applyMerges, type MergeRecord } from "../dedup";

export function loadFixture(name: string) {
  const text = readFileSync(new URL(`../../../docs/fixtures/${name}`, import.meta.url), "utf-8");
  const result = parseStyleSnapExport(text);
  if (!result.ok) throw new Error(`fixture ${name} should parse`);
  return result.data;
}

export function oracleCaptures(): { meta: StyleSnapMeta; tokens: StyleSnapToken[] }[] {
  return [loadFixture("capture-browser-messy.json"), loadFixture("capture-figma-clean.json")];
}

export function oracleRawTokens(): StyleSnapToken[] {
  return oracleCaptures().flatMap((c) => c.tokens);
}

export const ORACLE_MERGES: MergeRecord[] = [
  { survivorId: "ext_001", mergedIds: ["ext_002", "ext_003", "ext_004", "fig_001"], mergedAt: "t" },
  { survivorId: "ext_006", mergedIds: ["ext_007", "fig_002"], mergedAt: "t" },
  { survivorId: "ext_010", mergedIds: ["fig_003"], mergedAt: "t" },
  { survivorId: "ext_015", mergedIds: ["ext_016", "fig_006"], mergedAt: "t" },
  { survivorId: "ext_023", mergedIds: ["ext_022", "fig_007"], mergedAt: "t" },
  { survivorId: "fig_008", mergedIds: ["ext_028"], mergedAt: "t" },
  { survivorId: "fig_009", mergedIds: ["ext_031"], mergedAt: "t" },
];

export const ORACLE_ROLES = new Map<string, string>([
  ["ext_001", "color/action/primary"],
  ["ext_005", "color/action/primary-hover"],
  ["ext_011", "color/border/default"],
  ["ext_012", "color/feedback/error"],
  ["ext_009", "color/surface/card"],
  ["fig_004", "color/surface/overlay"],
  ["ext_010", "color/surface/page"],
  ["ext_008", "color/text/muted"],
  ["ext_006", "color/text/primary"],
  ["ext_014", "type/display"],
  ["fig_005", "type/heading"],
  ["ext_015", "type/body"],
  ["ext_017", "type/caption"],
  ["ext_019", "space/xs"],
  ["ext_020", "space/sm"],
  ["ext_023", "space/md"],
  ["ext_024", "space/lg"],
  ["ext_025", "space/xl"],
  ["ext_026", "space/2xl"],
  ["ext_027", "radius/sm"],
  ["fig_008", "radius/md"],
  ["ext_029", "border-width/default"],
  ["ext_030", "shadow/sm"],
  ["fig_009", "shadow/md"],
]);

/** The user-assigned primitive names from the oracle's tables. */
export const ORACLE_NAMES = new Map<string, string>([
  ["ext_001", "color/brand-blue"],
  ["ext_005", "color/brand-blue-deep"],
  ["ext_006", "color/ink"],
  ["ext_008", "color/gray-500"],
  ["ext_009", "color/white"],
  ["ext_010", "color/gray-50"],
  ["ext_011", "color/gray-200"],
  ["ext_012", "color/red-600"],
  ["ext_013", "gradient/hero"],
  ["ext_018", "type/label-uppercase"],
]);

/** The reviewed view: raw tokens with the oracle's merges applied. */
export function oracleViewTokens(): StyleSnapToken[] {
  return applyMerges(
    oracleRawTokens().map((token) => ({ token })),
    ORACLE_MERGES,
  ).map((e) => e.token);
}
