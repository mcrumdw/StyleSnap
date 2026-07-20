import { describe, expect, it } from "vitest";
import type { StyleSnapToken } from "../../contract/types";
import { harvestFeedbackColors } from "./feedback-harvest";

function colorToken(
  id: string,
  value: string,
  overrides: Partial<StyleSnapToken> = {},
): StyleSnapToken {
  return {
    id,
    captureId: id,
    source: id,
    name: null,
    occurrences: 1,
    merged: false,
    type: "color",
    value,
    opacity: 1,
    ...overrides,
  } as StyleSnapToken;
}

describe("harvestFeedbackColors (C.4 tier 2)", () => {
  it("maps keyword + context signals before hue bands", () => {
    const tokens = [
      colorToken("success_t", "#15803D", {
        source: "div.toast-success",
        occurrences: 4,
        context: { selector: ".toast-success", cssProperty: "background-color" },
      }),
      colorToken("warn_t", "#B45309", {
        source: "div.alert-warning",
        occurrences: 2,
        context: { selector: ".alert-warning" },
      }),
    ];
    const harvested = harvestFeedbackColors(tokens, new Map(), "#2E6BFF");
    expect(harvested.map((h) => h.role).sort()).toEqual(["success", "warning"]);
    expect(harvested.find((h) => h.role === "success")?.token.value).toBe("#15803D");
  });

  it("skips roles already assigned and does not reuse assigned tokens", () => {
    const tokens = [
      colorToken("err", "#DC2626", {
        occurrences: 3,
        context: { ariaRole: "alert" },
      }),
      colorToken("green", "#16A34A", { occurrences: 1 }),
    ];
    const assignments = new Map([["color/feedback/error", "err"]]);
    const harvested = harvestFeedbackColors(tokens, assignments, "#EA580C");
    expect(harvested).toEqual([
      expect.objectContaining({ role: "success", token: expect.objectContaining({ id: "green" }) }),
    ]);
  });

  it("harvests hue-band matches when no keyword exists", () => {
    const tokens = [colorToken("info_hue", "#2563EB", { occurrences: 2 })];
    const harvested = harvestFeedbackColors(tokens, new Map(), "#17A673");
    expect(harvested).toEqual([
      expect.objectContaining({ role: "info", token: expect.objectContaining({ id: "info_hue" }) }),
    ]);
  });

  it("skips hue-band match when it collides with primary unless keyword overrides", () => {
    const tokens = [
      colorToken("green", "#22C55E", { occurrences: 5 }),
      colorToken("named", "#22C55E", {
        id: "named_success",
        source: "span.badge-success",
        occurrences: 1,
      }),
    ];
    const harvested = harvestFeedbackColors(tokens, new Map(), "#17A673");
    expect(harvested.find((h) => h.role === "success")?.token.id).toBe("named_success");
  });

  it("respects exact authored feedback role names", () => {
    const tokens = [
      colorToken("figma_var", "#0EA5E9", {
        context: { authoredName: "color/feedback/info" },
      }),
    ];
    const harvested = harvestFeedbackColors(tokens, new Map(), "#2E6BFF");
    expect(harvested[0]?.role).toBe("info");
    expect(harvested[0]?.method).toContain("authored name");
  });

  it("claims Figma style name even when opacity is not exactly 1", () => {
    const tokens = [
      colorToken("warn_style", "#9F6B26", {
        name: "color/feedback/warning",
        opacity: 0.97,
        context: { authoredName: "color/feedback/warning" },
      }),
    ];
    const harvested = harvestFeedbackColors(tokens, new Map(), "#14121F");
    expect(harvested).toEqual([
      expect.objectContaining({
        role: "warning",
        token: expect.objectContaining({ id: "warn_style" }),
      }),
    ]);
  });
});
