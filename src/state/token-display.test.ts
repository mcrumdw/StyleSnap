import { describe, expect, it } from "vitest";
import type { ColorToken, ShadowToken, SpacingToken, StyleSnapToken } from "../contract/types";
import { buildPreviewContext, describeShadowValue, humanValueLabel } from "./token-display";

describe("humanValueLabel", () => {
  it("describes shadow/lg single-layer drop with ink", () => {
    const token: ShadowToken = {
      id: "derived_lg",
      type: "shadow",
      value: [
        { inset: false, offsetX: 0, offsetY: 12, blur: 24, spread: -4, color: "#292524", opacity: 0.08 },
      ],
      source: "derived",
      occurrences: 1,
      captureId: "c",
      name: null,
      merged: false,
    };
    const label = humanValueLabel(token, "shadow/lg");
    expect(label).toContain("#292524 at 8%");
    expect(label).toContain("Drop shadow");
    expect(label).toContain("Modals");
  });

  it("distinguishes inset sm from layered md on ember-like captures", () => {
    const sm: ShadowToken = {
      id: "inset",
      type: "shadow",
      value: [{ inset: true, offsetX: 0, offsetY: 1, blur: 2, spread: 0, color: "#292524", opacity: 0.04 }],
      source: "input",
      occurrences: 1,
      captureId: "c",
      name: null,
      merged: false,
    };
    const md: ShadowToken = {
      id: "card",
      type: "shadow",
      value: [
        { inset: false, offsetX: 0, offsetY: 4, blur: 12, spread: -2, color: "#292524", opacity: 0.08 },
        { inset: false, offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "#292524", opacity: 0.06 },
      ],
      source: "card",
      occurrences: 1,
      captureId: "c",
      name: null,
      merged: false,
    };
    expect(humanValueLabel(sm, "shadow/sm")).toMatch(/Inner shadow/);
    expect(humanValueLabel(md, "shadow/md")).toMatch(/2 layers/);
    expect(humanValueLabel(sm)).not.toEqual(humanValueLabel(md));
  });

  it("describes derived multi-layer shadows", () => {
    const label = describeShadowValue([
      { inset: false, offsetX: 0, offsetY: 4, blur: 12, spread: -2, color: "#292524", opacity: 0.08 },
      { inset: false, offsetX: 0, offsetY: 1, blur: 3, spread: 0, color: "#292524", opacity: 0.06 },
    ]);
    expect(label).toMatch(/2 layers/);
    expect(label).toContain("#292524 at 6%–8%");
  });

  it("describes spacing in pixels", () => {
    const token: SpacingToken = {
      id: "x",
      type: "spacing",
      value: 16,
      source: "css",
      occurrences: 1,
      captureId: "c",
      name: null,
      merged: false,
    };
    expect(humanValueLabel(token)).toBe("16px gap or padding");
  });
});

describe("buildPreviewContext", () => {
  it("resolves captured surface, action, border, and radius roles", () => {
    const page: ColorToken = {
      id: "p",
      type: "color",
      value: "#FFFBF5",
      opacity: 1,
      source: "body",
      occurrences: 1,
      captureId: "c",
      name: null,
      merged: false,
    };
    const card: ColorToken = {
      id: "c",
      type: "color",
      value: "#FFFFFF",
      opacity: 1,
      source: "card",
      occurrences: 1,
      captureId: "c",
      name: null,
      merged: false,
    };
    const primary: ColorToken = {
      id: "a",
      type: "color",
      value: "#EA580C",
      opacity: 1,
      source: "button",
      occurrences: 1,
      captureId: "c",
      name: null,
      merged: false,
    };
    const ctx = buildPreviewContext(
      new Map<string, StyleSnapToken>([
        ["color/surface/page", page],
        ["color/surface/card", card],
        ["color/action/primary", primary],
        ["radius/md", { id: "r", type: "border-radius", value: 10, source: "css", occurrences: 1, captureId: "c", name: null, merged: false }],
      ]),
    );
    expect(ctx.surfacePage).toBe("#FFFBF5");
    expect(ctx.surfaceCard).toBe("#FFFFFF");
    expect(ctx.actionPrimary).toBe("#EA580C");
    expect(ctx.cardRadiusPx).toBe(10);
  });
});
