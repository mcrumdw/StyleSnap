import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../../contract/schema";
import type { ColorToken, StyleSnapToken } from "../../contract/types";
import { applyMerges, type MergeRecord } from "../dedup";
import { computeChecklist } from "./index";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../docs/fixtures/${name}`, import.meta.url), "utf-8");

function allTokens(): StyleSnapToken[] {
  const tokens: StyleSnapToken[] = [];
  for (const name of ["capture-browser-messy.json", "capture-figma-clean.json"]) {
    const result = parseStyleSnapExport(fixture(name));
    if (!result.ok) throw new Error(`fixture ${name} should parse`);
    tokens.push(...result.data.tokens);
  }
  return tokens;
}

// The post-Phase-4 state from docs/examples/design.example.md: the oracle's
// merges applied and its roles confirmed.
const ORACLE_MERGES: MergeRecord[] = [
  { survivorId: "ext_001", mergedIds: ["ext_002", "ext_003", "ext_004", "fig_001"], mergedAt: "t" },
  { survivorId: "ext_006", mergedIds: ["ext_007", "fig_002"], mergedAt: "t" },
  { survivorId: "ext_010", mergedIds: ["fig_003"], mergedAt: "t" },
  { survivorId: "ext_015", mergedIds: ["ext_016", "fig_006"], mergedAt: "t" },
  { survivorId: "ext_023", mergedIds: ["ext_022", "fig_007"], mergedAt: "t" },
  { survivorId: "fig_008", mergedIds: ["ext_028"], mergedAt: "t" },
  { survivorId: "fig_009", mergedIds: ["ext_031"], mergedAt: "t" },
];

const ORACLE_ROLES = new Map<string, string>([
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

function oracleView(): StyleSnapToken[] {
  return applyMerges(allTokens().map((token) => ({ token })), ORACLE_MERGES).map((e) => e.token);
}

describe("completeness checklist (FR-18 / B.5) — the oracle acceptance", () => {
  const checklist = computeChecklist(oracleView(), ORACLE_ROLES);
  const gaps = checklist.items.filter((i) => i.status === "gap").map((i) => i.id);

  it("flags exactly the gaps in design.example.md §Gaps", () => {
    expect(gaps.sort()).toEqual(
      [
        "color/text/link",
        "color/action/primary-active",
        "color/action/secondary",
        "color/border/focus",
        "color/feedback/success",
        "color/feedback/warning",
        "color/feedback/info",
        "type/mono",
        "unassigned-ext_021", // the 12px spacing, captured 9×
        "manual-foundations",
      ].sort(),
    );
  });

  it("describes the 12px spacing gap with its occurrences", () => {
    const item = checklist.items.find((i) => i.id === "unassigned-ext_021")!;
    expect(item.label).toBe("12px spacing unassigned");
    expect(item.description).toContain("9×");
  });

  it("counts required progress: 4 required gaps (focus + 3 feedback colors)", () => {
    expect(checklist.requiredTotal).toBe(18); // 12 colors + 2 type + 4 scales
    expect(checklist.requiredTotal - checklist.requiredMet).toBe(4);
    expect(checklist.complete).toBe(false);
  });
});

describe("gaps clear live (FR-19 acceptance)", () => {
  const focusColor: ColorToken = {
    id: "manual_1",
    captureId: "manual-1",
    source: "manual entry",
    name: "color/brand-blue",
    occurrences: 1,
    merged: false,
    type: "color",
    value: "#2E6BFF",
    opacity: 1,
  };

  it("adding a focus color with the role confirmed clears its gap", () => {
    const roles = new Map(ORACLE_ROLES).set("manual_1", "color/border/focus");
    const checklist = computeChecklist([...oracleView(), focusColor], roles);
    const focus = checklist.items.find((i) => i.id === "color/border/focus")!;
    expect(focus.status).toBe("met");
    expect(checklist.requiredTotal - checklist.requiredMet).toBe(3);
  });

  it("completing every required item flips `complete`", () => {
    const roles = new Map(ORACLE_ROLES);
    const extras: StyleSnapToken[] = ["focus", "success", "warning", "info"].map((kind) => ({
      ...focusColor,
      id: `manual_${kind}`,
      captureId: `manual-${kind}`,
      name: null,
    }));
    roles.set("manual_focus", "color/border/focus");
    roles.set("manual_success", "color/feedback/success");
    roles.set("manual_warning", "color/feedback/warning");
    roles.set("manual_info", "color/feedback/info");
    const checklist = computeChecklist([...oracleView(), ...extras], roles);
    expect(checklist.complete).toBe(true);
    // Recommended/info gaps remain — completeness ≠ silence.
    expect(checklist.items.some((i) => i.status === "gap")).toBe(true);
  });

  it("dropping spacing slots below 4 re-opens the scale gap", () => {
    const roles = new Map(ORACLE_ROLES);
    roles.delete("ext_024");
    roles.delete("ext_025");
    roles.delete("ext_026");
    const checklist = computeChecklist(oracleView(), roles);
    const scale = checklist.items.find((i) => i.id === "space-scale")!;
    expect(scale.status).toBe("gap");
    expect(scale.description).toContain("Only 3");
  });
});
