import { describe, expect, it } from "vitest";
import { radiusInsight, spacingInsight, typeInsight } from "./insights";
import type { StyleSnapToken } from "../contract/types";

const space = (id: string, value: number, occurrences = 1): StyleSnapToken => ({
  id,
  type: "spacing",
  value,
  name: null,
  source: "test",
  captureId: id,
  occurrences,
  merged: false,
});

const radius = (id: string, value: number): StyleSnapToken => ({
  id,
  type: "border-radius",
  value,
  name: null,
  source: "test",
  captureId: id,
  occurrences: 1,
  merged: false,
});

describe("spacingInsight", () => {
  it("detects a 4px base unit and lists unassigned values", () => {
    const tokens = [space("a", 8), space("b", 16), space("c", 12, 9)];
    const insight = spacingInsight(tokens, { "space/sm": "a", "space/md": "b" });
    expect(insight.baseUnit).toBe(4);
    expect(insight.unassigned).toEqual([{ value: 12, occurrences: 9 }]);
    expect(insight.summary).toContain("Base ~4px");
    expect(insight.summary).toContain("12px");
  });
});

describe("radiusInsight", () => {
  it("labels soft profiles", () => {
    const insight = radiusInsight([radius("r1", 16), radius("r2", 24)], {});
    expect(insight.profile).toBe("soft");
    expect(insight.summary).toMatch(/Soft/);
  });
});

describe("typeInsight", () => {
  it("summarizes body size and ratio", () => {
    const tokens: StyleSnapToken[] = [
      {
        id: "t1",
        type: "typography",
        value: {
          fontFamily: "Inter",
          fontSize: 16,
          fontWeight: 400,
          lineHeight: 1.5,
        },
        name: null,
        source: "test",
        captureId: "t1",
        occurrences: 1,
        merged: false,
      },
    ];
    const insight = typeInsight(tokens, "t1", 1.25);
    expect(insight.summary).toContain("Inter");
    expect(insight.summary).toContain("body 16px");
    expect(insight.summary).toContain("×1.25");
  });
});
