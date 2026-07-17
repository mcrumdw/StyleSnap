import { describe, expect, it } from "vitest";
import { deriveSystem } from "./derive-system";
import { styleProfileFromFamily, scaleRadius } from "./style-profile";
import type { Family } from "./templates/families";

describe("styleProfileFromFamily", () => {
  it("returns a profile for every family", () => {
    const families: Family[] = [
      "calm-saas",
      "neobrutalist",
      "editorial",
      "playful",
      "technical",
      "warm-friendly",
      "luxury",
      "fluid-motion",
      "trustworthy-steady",
      "confident-direct",
      "expressive-maximal",
      "retro-nostalgic",
    ];
    for (const family of families) {
      const profile = styleProfileFromFamily(family);
      expect(profile.family).toBe(family);
      expect([1.2, 1.25, 1.333]).toContain(profile.typeRatio);
      expect(profile.radiusScale).toBeGreaterThan(0);
    }
  });

  it("neobrutalist uses hard shadows and tighter radius scale", () => {
    const profile = styleProfileFromFamily("neobrutalist");
    expect(profile.shadowStyle).toBe("hard");
    expect(profile.radiusScale).toBeLessThan(1);
    expect(profile.harmony).toBe("complementary");
  });
});

describe("scaleRadius", () => {
  it("scales and rounds derived radius values", () => {
    expect(scaleRadius(8, 1.2)).toBe(10);
    expect(scaleRadius(4, 0.75)).toBe(3);
    expect(scaleRadius(1, 0.5)).toBe(1);
  });
});

describe("style profile in derivation", () => {
  it("biases derived radius slots when no capture claims them", () => {
    const tokens = [
      {
        id: "c1",
        captureId: "x",
        source: "btn",
        name: null,
        occurrences: 5,
        merged: false,
        type: "color" as const,
        value: "#2E6BFF",
        opacity: 1,
      },
      {
        id: "r1",
        captureId: "x",
        source: "btn",
        name: null,
        occurrences: 3,
        merged: false,
        type: "border-radius" as const,
        value: 8,
      },
    ];
    const defaultResult = deriveSystem({
      tokens,
      assignments: new Map(),
      styleProfile: { radiusScale: 1, shadowStyle: "soft" },
    });
    const tightResult = deriveSystem({
      tokens,
      assignments: new Map(),
      styleProfile: { radiusScale: 0.75, shadowStyle: "soft" },
    });
    const defaultLg = defaultResult.fills.find((f) => f.role === "radius/lg")?.token.value;
    const tightLg = tightResult.fills.find((f) => f.role === "radius/lg")?.token.value;
    expect(typeof defaultLg).toBe("number");
    expect(typeof tightLg).toBe("number");
    expect(tightLg as number).toBeLessThan(defaultLg as number);
  });
});
