import { describe, expect, it } from "vitest";
import type { StyleSnapToken } from "../contract/types";
import { computeAutoAccentIds, effectiveAccentIds } from "./accents";

function color(id: string, value: string, occurrences = 1): StyleSnapToken {
  return {
    id,
    captureId: id,
    source: id,
    name: null,
    occurrences,
    merged: false,
    type: "color",
    value,
    opacity: 1,
  };
}

describe("computeAutoAccentIds", () => {
  const tokens = [
    color("pri", "#EA580C", 10),
    color("gold", "#DAC287", 2),
    color("navy", "#130431", 1),
    color("ink", "#292524", 5), // near-neutral — still has chroma; use true gray
    color("gray", "#A8A8A8", 3),
    color("role_red", "#DC2626", 1),
  ];

  it("seeds unassigned non-neutral colors, skipping primary/secondary/assigned", () => {
    const assignments = new Map([["color/feedback/error", "role_red"]]);
    const ids = computeAutoAccentIds(tokens, assignments, "pri", undefined);
    expect(ids).toContain("gold");
    expect(ids).toContain("navy");
    expect(ids).not.toContain("pri");
    expect(ids).not.toContain("role_red");
    expect(ids).not.toContain("gray"); // neutral
  });

  it("effectiveAccentIds uses explicit list when set", () => {
    expect(
      effectiveAccentIds(["gold"], tokens, new Map(), "pri", undefined),
    ).toEqual(["gold"]);
  });
});
