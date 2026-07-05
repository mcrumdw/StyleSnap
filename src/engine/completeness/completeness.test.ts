import { describe, expect, it } from "vitest";
import type { ColorToken, StyleSnapToken } from "../../contract/types";
import { ORACLE_ASSIGNMENTS, oracleViewTokens as oracleView } from "../testing/oracle";
import { computeChecklist } from "./index";

describe("completeness checklist (FR-18 / B.5) — the oracle acceptance", () => {
  const checklist = computeChecklist(oracleView(), ORACLE_ASSIGNMENTS);
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
    const assignments = new Map(ORACLE_ASSIGNMENTS).set("color/border/focus", "manual_1");
    const checklist = computeChecklist([...oracleView(), focusColor], assignments);
    const focus = checklist.items.find((i) => i.id === "color/border/focus")!;
    expect(focus.status).toBe("met");
    expect(checklist.requiredTotal - checklist.requiredMet).toBe(3);
  });

  it("completing every required item flips `complete`", () => {
    const assignments = new Map(ORACLE_ASSIGNMENTS);
    const extras: StyleSnapToken[] = ["focus", "success", "warning", "info"].map((kind) => ({
      ...focusColor,
      id: `manual_${kind}`,
      captureId: `manual-${kind}`,
      name: null,
    }));
    assignments.set("color/border/focus", "manual_focus");
    assignments.set("color/feedback/success", "manual_success");
    assignments.set("color/feedback/warning", "manual_warning");
    assignments.set("color/feedback/info", "manual_info");
    const checklist = computeChecklist([...oracleView(), ...extras], assignments);
    expect(checklist.complete).toBe(true);
    // Recommended/info gaps remain — completeness ≠ silence.
    expect(checklist.items.some((i) => i.status === "gap")).toBe(true);
  });

  it("dropping spacing slots below 4 re-opens the scale gap", () => {
    const assignments = new Map(ORACLE_ASSIGNMENTS);
    assignments.delete("space/lg");
    assignments.delete("space/xl");
    assignments.delete("space/2xl");
    const checklist = computeChecklist(oracleView(), assignments);
    const scale = checklist.items.find((i) => i.id === "space-scale")!;
    expect(scale.status).toBe("gap");
    expect(scale.description).toContain("Only 3");
  });
});
