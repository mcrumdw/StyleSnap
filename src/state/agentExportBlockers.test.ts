import { describe, expect, it } from "vitest";
import { getAgentExportBlockers, agentExportBlockerMessage } from "./agentExportBlockers";

describe("agentExportBlockers", () => {
  it("reports missing system-note fields", () => {
    const blockers = getAgentExportBlockers({ mood: "Calm", motion: "Snappy" });
    expect(blockers.filled).toBe(2);
    expect(blockers.total).toBe(5);
    expect(blockers.complete).toBe(false);
    expect(blockers.missingLabels).toEqual([
      "Component principles",
      "Voice & microcopy",
      "Layout",
    ]);
    expect(agentExportBlockerMessage(blockers)).toContain("2 of 5");
    expect(agentExportBlockerMessage(blockers)).toContain("Component principles");
  });

  it("is complete when all five fields are filled", () => {
    const blockers = getAgentExportBlockers({
      mood: "a",
      componentPrinciples: "b",
      motion: "c",
      voice: "d",
      layout: "e",
    });
    expect(blockers.complete).toBe(true);
    expect(agentExportBlockerMessage(blockers)).toBe("");
  });
});
