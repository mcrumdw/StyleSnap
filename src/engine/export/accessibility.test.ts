// Phase 9a acceptance — exact WCAG ratios for the fixture palette
// (BUILD_PLAN: ink/white 17.7:1, white on brand-blue 4.5:1, gray-500/white 5.0:1).

import { describe, expect, it } from "vitest";
import {
  ORACLE_ASSIGNMENTS,
  ORACLE_MERGES,
  ORACLE_NAMES,
  ORACLE_NOTES,
  oracleCaptures,
  oracleRawTokens,
  oracleViewTokens,
} from "../testing/oracle";
import { accessibilityPairs, contrastGapBullets, contrastRatio } from "./accessibility";
import type { ExportInput } from "./index";

function input(assignments = ORACLE_ASSIGNMENTS): ExportInput {
  const raw = oracleRawTokens();
  return {
    projectName: "Lumen",
    generatedAt: "2026-07-04T12:00:00Z",
    captures: oracleCaptures().map((c) => c.meta),
    rawTokenCount: raw.length,
    mergeCount: ORACLE_MERGES.length,
    tokens: oracleViewTokens(),
    rawById: new Map(raw.map((t) => [t.id, t])),
    assignments,
    names: ORACLE_NAMES,
    notes: ORACLE_NOTES,
  };
}

describe("contrastRatio", () => {
  it("measures the acceptance palette exactly", () => {
    expect(contrastRatio("#101828", "#FFFFFF").toFixed(1)).toBe("17.7"); // ink / white
    expect(contrastRatio("#FFFFFF", "#2E6BFF").toFixed(1)).toBe("4.5"); // white on brand-blue
    expect(contrastRatio("#667085", "#FFFFFF").toFixed(1)).toBe("5.0"); // gray-500 / white
  });

  it("is order-independent and spans 1–21", () => {
    expect(contrastRatio("#000000", "#FFFFFF")).toBeCloseTo(21, 5);
    expect(contrastRatio("#FFFFFF", "#000000")).toBeCloseTo(21, 5);
    expect(contrastRatio("#ABCDEF", "#ABCDEF")).toBe(1);
  });
});

describe("accessibilityPairs", () => {
  it("white on brand-blue passes AA with no margin", () => {
    const pair = accessibilityPairs(input()).find(
      (p) => p.label === "white on `color/action/primary`",
    )!;
    expect(pair.ratioText).toBe("4.5:1");
    expect(pair.passes).toBe(true);
    expect(pair.noMargin).toBe(true);
  });

  it("skips translucent colors (the overlay scrim)", () => {
    const labels = accessibilityPairs(input()).map((p) => p.label);
    expect(labels.some((l) => l.includes("color/surface/overlay"))).toBe(false);
  });

  it("a failing pair lands in the gaps bullets", () => {
    // Point text/muted at the light gray border color — unreadable on white.
    const failing = new Map(ORACLE_ASSIGNMENTS).set("color/text/muted", "ext_011");
    const bullets = contrastGapBullets(input(failing));
    expect(bullets.some((b) => b.includes("`color/text/muted` on `color/surface/card`"))).toBe(
      true,
    );
    expect(bullets.every((b) => b.includes("fails AA (4.5:1)"))).toBe(true);
  });

  it("passes produce no gap bullets", () => {
    expect(contrastGapBullets(input())).toEqual([]);
  });
});
