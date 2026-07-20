// Phase 10a acceptance — exact expected values from the fixtures, AA
// enforcement, cascade respecting user edits, determinism (BUILD_PLAN).

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../../contract/schema";
import type { StyleSnapToken } from "../../contract/types";
import { computeChecklist } from "../completeness";
import { contrastRatio } from "../export/accessibility";
import { deriveSystem, type DeriveResult } from "./index";

function fixtureTokens(name: string): StyleSnapToken[] {
  const result = parseStyleSnapExport(
    readFileSync(new URL(`../../../docs/fixtures/${name}`, import.meta.url), "utf-8"),
  );
  if (!result.ok) throw new Error(`fixture ${name} should parse`);
  return result.data.tokens;
}

const derive = (tokens: StyleSnapToken[], overrides = {}, assignments = new Map<string, string>()) =>
  deriveSystem({ tokens, assignments, overrides });

const fillValue = (result: DeriveResult, role: string) => {
  const fill = result.fills.find((f) => f.role === role);
  expect(fill, role).toBeDefined();
  return fill!;
};

describe("anchor detection (C.1)", () => {
  it("test-drive: green button bg wins primary; most frequent body + grid-snapped base", () => {
    const r = derive(fixtureTokens("capture-test-drive.json"));
    expect(r.anchors.primaryColorId).toBe("ext_td_01"); // #17A673, 14× on button bg
    expect(r.anchors.bodyTypographyId).toBe("ext_td_11"); // most frequent (26×)
    expect(r.anchors.baseSpacing).toBe(12); // 10px (12×) snaps to 12 and joins 12px (20×)
  });

  it("thin: brand purple beats the more frequent body-copy ink (text colors never compete)", () => {
    const r = derive(fixtureTokens("capture-thin.json"));
    expect(r.anchors.primaryColorId).toBe("ext_th_01"); // 7× ×2 button bg beats 21× text
    expect(r.anchors.baseSpacing).toBe(16);
  });

  it("lumen: the merged button blue wins primary — never the ink named color/text/primary", () => {
    const lumen = [
      ...fixtureTokens("capture-browser-messy.json"),
      ...fixtureTokens("capture-figma-clean.json"),
    ];
    const r = derive(lumen);
    expect(r.anchors.primaryColorId).toBe("ext_001"); // #2E6BFF, authoredName --color-primary
    expect(r.anchors.secondaryColorId).toBe("ext_012"); // #D92D20 alert — distinct hue
  });

  it("ember-app: orange primary + red alert secondary", () => {
    const r = derive(fixtureTokens("capture-ember-app.json"));
    expect(r.anchors.primaryColorId).toBe("ext_em_01");
    expect(r.anchors.secondaryColorId).toBe("ext_em_12");
  });

  it("thin: no secondary anchor on single-hue capture", () => {
    const r = derive(fixtureTokens("capture-thin.json"));
    expect(r.anchors.secondaryColorId).toBeUndefined();
  });

  it("anchor overrides win", () => {
    const tokens = fixtureTokens("capture-test-drive.json");
    const r = derive(tokens, { primaryColorId: "ext_td_04", baseSpacing: 20 });
    expect(r.anchors.primaryColorId).toBe("ext_td_04");
    expect(r.anchors.baseSpacing).toBe(20);
  });
});

describe("color derivation (C.2–C.4) — exact values from #17A673", () => {
  const r = derive(fixtureTokens("capture-test-drive.json"));

  it("interaction states: captured :hover claims the slot; else ΔL formula", () => {
    expect(fillValue(r, "color/action/primary").token.id).toBe("ext_td_01"); // anchor claims
    const hover = fillValue(r, "color/action/primary-hover");
    expect(hover.token.id).toBe("ext_td_04");
    expect(hover.token.value).toBe("#0F8259");
    expect(hover.method).toContain("captured :hover");
    expect(fillValue(r, "color/action/primary-active").token.value).toBe("#007E55");
    expect(fillValue(r, "color/border/focus").token.id).toBe("ext_td_01"); // focus = primary
  });

  it("ΔL hover formula when no :hover capture exists", () => {
    const thin = derive(fixtureTokens("capture-thin.json"));
    const hover = fillValue(thin, "color/action/primary-hover");
    expect(hover.token.id).toMatch(/^derived_/);
    expect(hover.method).toContain("ΔL");
  });

  it("tinted neutrals: captured page/card/text claim slots when present", () => {
    expect(fillValue(r, "color/text/primary").token.id).toBe("ext_td_05");
    expect(fillValue(r, "color/surface/page").token.id).toBe("ext_td_07");
    expect(fillValue(r, "color/surface/card").token.id).toBe("ext_td_08");
    expect(fillValue(r, "color/surface/page").method).toContain("captured");
    expect(fillValue(r, "color/surface/card").method).toContain("captured");
    // Muted only claims when context hints it — meta gray stays a primitive here.
    expect(fillValue(r, "color/text/muted").token.id).toMatch(/^derived_/);
  });

  it("ΔL page surface when no page background is captured", () => {
    const thin = derive(fixtureTokens("capture-thin.json"));
    // Panel white claims card; page still formula (no body/html bg in thin).
    expect(fillValue(thin, "color/surface/card").token.id).toBe("ext_th_03");
    expect(fillValue(thin, "color/surface/page").token.id).toMatch(/^derived_/);
    expect(fillValue(thin, "color/surface/page").method).toContain("tinted neutral");
  });

  it("feedback colors: conventional hues, brand chroma, AA-tuned", () => {
    expect(fillValue(r, "color/feedback/success").token.value).toBe("#228744");
    expect(fillValue(r, "color/feedback/warning").token.value).toBe("#A56800");
    expect(fillValue(r, "color/feedback/error").token.value).toBe("#BE5550");
    expect(fillValue(r, "color/feedback/info").token.value).toBe("#2778C1");
  });

  it("harvests captured feedback colors before deriving the rest (ember alert)", () => {
    const r = derive(fixtureTokens("capture-ember-app.json"));
    const error = fillValue(r, "color/feedback/error");
    expect(error.token.id).toBe("ext_em_12");
    expect(error.token.value).toBe("#DC2626");
    expect(error.method).toContain("harvested from capture");
    expect(fillValue(r, "color/feedback/success").method).toContain("conventional hue");
  });

  it("system color recapture: no synthetic derived colors — only capture fills", () => {
    const tokens: StyleSnapToken[] = [
      {
        id: "p",
        captureId: "c",
        source: "Paint Style",
        name: "color/action/primary",
        occurrences: 8,
        merged: false,
        type: "color",
        value: "#2E6BFF",
        opacity: 1,
        context: { authoredName: "color/action/primary" },
      },
      {
        id: "ph",
        captureId: "c",
        source: "Paint Style",
        name: "color/action/primary-hover",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#1E4FCC",
        opacity: 1,
        context: { authoredName: "color/action/primary-hover" },
      },
      {
        id: "tp",
        captureId: "c",
        source: "Paint Style",
        name: "color/text/primary",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#101828",
        opacity: 1,
        context: { authoredName: "color/text/primary" },
      },
      {
        id: "tm",
        captureId: "c",
        source: "Paint Style",
        name: "color/text/muted",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#667085",
        opacity: 1,
        context: { authoredName: "color/text/muted" },
      },
      {
        id: "sp",
        captureId: "c",
        source: "Paint Style",
        name: "color/surface/page",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#F9FAFB",
        opacity: 1,
        context: { authoredName: "color/surface/page" },
      },
      {
        id: "sc",
        captureId: "c",
        source: "Paint Style",
        name: "color/surface/card",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#FFFFFF",
        opacity: 1,
        context: { authoredName: "color/surface/card" },
      },
      {
        id: "bd",
        captureId: "c",
        source: "Paint Style",
        name: "color/border/default",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#E4E7EC",
        opacity: 1,
        context: { authoredName: "color/border/default" },
      },
      {
        id: "fw",
        captureId: "c",
        source: "Paint Style",
        name: "color/feedback/warning",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#B45309",
        opacity: 1,
        context: { authoredName: "color/feedback/warning" },
      },
      {
        id: "fe",
        captureId: "c",
        source: "Paint Style",
        name: "color/feedback/error",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#DC2626",
        opacity: 1,
        context: { authoredName: "color/feedback/error" },
      },
      {
        id: "fs",
        captureId: "c",
        source: "Paint Style",
        name: "color/feedback/success",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#16A34A",
        opacity: 1,
        context: { authoredName: "color/feedback/success" },
      },
      {
        id: "fi",
        captureId: "c",
        source: "Paint Style",
        name: "color/feedback/info",
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#2563EB",
        opacity: 1,
        context: { authoredName: "color/feedback/info" },
      },
    ];
    const result = derive(tokens);
    const colorFills = result.fills.filter((f) => f.role.startsWith("color/"));
    expect(colorFills.length).toBeGreaterThan(0);
    for (const fill of colorFills) {
      expect(fill.token.id.startsWith("derived_"), `${fill.role} should not be derived`).toBe(
        false,
      );
    }
    expect(fillValue(result, "color/feedback/warning").token.id).toBe("fw");
    expect(fillValue(result, "color/feedback/warning").token.value).toBe("#B45309");
  });

  it("every derived text/feedback color passes AA on the derived card surface", () => {
    const card = fillValue(r, "color/surface/card").token.value as string;
    for (const role of [
      "color/text/primary",
      "color/text/muted",
      "color/feedback/success",
      "color/feedback/warning",
      "color/feedback/error",
      "color/feedback/info",
    ]) {
      const hex = fillValue(r, role).token.value as string;
      expect(contrastRatio(hex, card), role).toBeGreaterThanOrEqual(4.5);
    }
  });
});

describe("type scale (C.6) and ramps (C.7)", () => {
  const r = derive(fixtureTokens("capture-thin.json"));

  it("modular scale from the 16px body anchor at ×1.25 (single-font snap)", () => {
    expect(fillValue(r, "type/body").token.id).toBe("ext_th_04");
    const size = (role: string) =>
      (fillValue(r, role).token as { value: { fontSize: number } }).value.fontSize;
    expect(size("type/caption")).toBe(13);
    expect(size("type/subheading")).toBe(20);
    expect(size("type/heading")).toBe(25);
    expect(size("type/display")).toBe(31);
    // One font → every non-body slot is DERIVED from it, nothing captured.
    for (const role of ["type/caption", "type/subheading", "type/heading", "type/display"]) {
      expect(fillValue(r, role).token.id.startsWith("derived_")).toBe(true);
    }
  });

  it("a captured hero/heading font claims its slot verbatim (multi-font snap)", () => {
    const td = derive(fixtureTokens("capture-test-drive.json"));
    // The Sora 56px <h1> is used AS the display font, not a derived body size.
    const display = fillValue(td, "type/display");
    expect(display.token.id).toBe("ext_td_10");
    expect(display.token.id.startsWith("derived_")).toBe(false);
    expect((display.token as { value: { fontFamily: string; fontSize: number } }).value).toMatchObject(
      { fontFamily: "Sora", fontSize: 56 },
    );
    expect(display.method).toContain("captured");
    // Body is still the most-frequent captured font; heading (no captured
    // <h2/h3>) still derives from it.
    expect(fillValue(td, "type/body").token.id).toBe("ext_td_11");
    expect(fillValue(td, "type/heading").token.id.startsWith("derived_")).toBe(true);
  });

  it("an authoredName font claims its slot too (Figma type/heading)", () => {
    const lumen = derive([
      ...fixtureTokens("capture-browser-messy.json"),
      ...fixtureTokens("capture-figma-clean.json"),
    ]);
    // fig_005 carries authoredName "type/heading"; ext_014 is the <h1> display.
    expect(fillValue(lumen, "type/heading").token.id).toBe("fig_005");
    expect(fillValue(lumen, "type/display").token.id).toBe("ext_014");
  });

  it("spacing ramp from base 16 on the 4px grid; captured 16 claims its slot", () => {
    const value = (role: string) => fillValue(r, role).token.value;
    expect(value("space/xs")).toBe(8);
    expect(fillValue(r, "space/sm").token.id).toBe("ext_th_05"); // captured 16
    expect(value("space/md")).toBe(24);
    expect(value("space/lg")).toBe(32);
    expect(value("space/xl")).toBe(48);
    expect(value("space/2xl")).toBe(64);
  });

  it("seeds semantic spacing roles from the scale (§2.47 / §2.49)", () => {
    // page = clamp(2 × xl, 32–160); thin-capture xl is 48 → 96
    expect(fillValue(r, "space/page").token.value).toBe(96);
    expect(fillValue(r, "space/page").method).toMatch(/2× space\/xl/);
    expect(fillValue(r, "space/section").token.value).toBe(fillValue(r, "space/2xl").token.value);
    expect(fillValue(r, "space/stack").token.value).toBe(fillValue(r, "space/lg").token.value);
    expect(fillValue(r, "space/inset").token.value).toBe(fillValue(r, "space/sm").token.value);
  });

  it("radius ×0.5/×1/×2 from captured 8; border-width falls back to the 1px convention", () => {
    expect(fillValue(r, "radius/sm").token.value).toBe(4);
    expect(fillValue(r, "radius/md").token.id).toBe("ext_th_06");
    expect(fillValue(r, "radius/lg").token.value).toBe(16);
    const width = fillValue(r, "border-width/default");
    expect(width.token.value).toBe(1);
    expect(width.derivedFrom).toBe("convention");
  });

  it("leaves elevation empty when nothing was captured (§2.63)", () => {
    expect(r.fills.some((f) => f.role.startsWith("shadow/"))).toBe(false);
  });
});

describe("accent suggestion (C.5)", () => {
  it("suppressed when a second hue was captured (lumen: red alert + gradient purple)", () => {
    const lumen = [
      ...fixtureTokens("capture-browser-messy.json"),
      ...fixtureTokens("capture-figma-clean.json"),
    ];
    expect(derive(lumen).accent).toBeNull();
  });

  it("offered for single-hue captures with all three harmonies and a suitability default", () => {
    const td = derive(fixtureTokens("capture-test-drive.json"));
    expect(td.accent).toEqual({
      candidates: {
        complementary: "#AF5691",
        "split-complementary": "#9560B4",
        analogous: "#008380",
      },
      suggested: "split-complementary", // brand C between 0.09 and 0.17
    });
    const thin = derive(fixtureTokens("capture-thin.json"));
    expect(thin.accent?.suggested).toBe("analogous"); // vivid purple, C > 0.17
  });
});

describe("precedence and cascade (C.8)", () => {
  const tokens = fixtureTokens("capture-test-drive.json");

  it("captured/user assignments always win — no fill for taken roles", () => {
    const taken = new Map([["color/text/primary", "ext_td_05"]]);
    const r = deriveSystem({ tokens, assignments: taken, overrides: {} });
    expect(r.fills.some((f) => f.role === "color/text/primary")).toBe(false);
  });

  it("changing the primary anchor regenerates formula-derived colors", () => {
    const before = derive(tokens);
    const after = derive(tokens, { primaryColorId: "ext_td_04" }); // darker green
    // Captured :hover still claims the slot; ΔL active cascades with the new primary.
    expect(fillValue(after, "color/action/primary-hover").token.id).toBe("ext_td_04");
    expect(fillValue(after, "color/action/primary-active").token.value).not.toBe(
      fillValue(before, "color/action/primary-active").token.value,
    );
    // Non-color derivations are untouched by a color anchor swap.
    expect(fillValue(after, "space/2xl").token.value).toBe(
      fillValue(before, "space/2xl").token.value,
    );
  });

  it("deterministic: same input → deep-equal output", () => {
    expect(derive(tokens)).toEqual(derive(tokens));
  });
});

describe("thin capture → complete system (the point of it all)", () => {
  it("6 tokens in, every required checklist item met, zero forms", () => {
    const tokens = fixtureTokens("capture-thin.json");
    const r = derive(tokens);
    // Assemble the effective view the app would show: captured + derived.
    const derivedTokens = r.fills.map((f) => f.token);
    const all = [...tokens, ...derivedTokens.filter((t) => t.id.startsWith("derived_"))];
    const assignments = new Map(r.fills.map((f) => [f.role, f.token.id]));
    const checklist = computeChecklist(all, assignments);
    expect(checklist.complete).toBe(true);
    expect(checklist.requiredMet).toBe(checklist.requiredTotal);
  });

  it("test-drive: recommended roles and captured foundations are auto-filled — no orphan gaps", () => {
    const tokens = fixtureTokens("capture-test-drive.json");
    const r = derive(tokens);
    const assignments = new Map(r.fills.map((f) => [f.role, f.token.id]));
    const all = [...tokens, ...r.fills.map((f) => f.token).filter((t) => t.id.startsWith("derived_"))];
    const checklist = computeChecklist(all, assignments);
    const gaps = checklist.items.filter((i) => i.status === "gap" && i.id !== "manual-foundations");

    expect(r.fills.some((f) => f.role === "color/action/secondary")).toBe(false);
    expect(fillValue(r, "type/mono").token.type).toBe("typography");
    expect(fillValue(r, "shadow/md").token.id).toBe("ext_td_20");
    expect(assignments.get("radius/lg")).toBe("ext_td_18");
    // Secondary stays empty until the user opts in (§2.38) — the only recommended gap.
    expect(
      gaps.filter((g) => g.severity === "recommended").map((g) => g.id),
    ).toEqual(["color/action/secondary"]);
    expect(gaps.filter((g) => g.id.startsWith("unassigned-"))).toHaveLength(0);
  });

  it("leaves secondary empty until accentHarmony opt-in when no secondary anchor", () => {
    const tokens = fixtureTokens("capture-test-drive.json");
    const without = derive(tokens);
    expect(without.fills.some((f) => f.role === "color/action/secondary")).toBe(false);

    const withHarmony = deriveSystem({
      tokens,
      assignments: new Map(),
      accentHarmony: "analogous",
    });
    expect(fillValue(withHarmony, "color/action/secondary").token.id).toMatch(/^derived_/);
    expect(fillValue(withHarmony, "color/action/secondary").method).toContain("analogous");
  });

  it("does not fill secondary from auto-detected hue until user override", () => {
    const tokens = fixtureTokens("capture-ember-app.json");
    const auto = derive(tokens);
    expect(auto.anchors.secondaryColorId).toBe("ext_em_12");
    expect(auto.fills.some((f) => f.role === "color/action/secondary")).toBe(false);

    const opted = deriveSystem({
      tokens,
      assignments: new Map(),
      overrides: { secondaryColorId: "ext_em_12" },
    });
    const secondary = fillValue(opted, "color/action/secondary");
    expect(secondary.token.id).toBe("ext_em_12");
    expect(secondary.method).toContain("secondary");
  });

  it("uses accentHarmony override for secondary when no secondary anchor", () => {
    const tokens = fixtureTokens("capture-test-drive.json");
    const withAnalogous = deriveSystem({ tokens, assignments: new Map(), accentHarmony: "analogous" });
    const withComplementary = deriveSystem({
      tokens,
      assignments: new Map(),
      accentHarmony: "complementary",
    });
    expect(fillValue(withAnalogous, "color/action/secondary").token.value).not.toBe(
      fillValue(withComplementary, "color/action/secondary").token.value,
    );
  });

  it("accentHarmony fills secondary even when a distinct hue was auto-detected", () => {
    const tokens = fixtureTokens("capture-ember-app.json");
    const anchored = derive(tokens);
    expect(anchored.fills.some((f) => f.role === "color/action/secondary")).toBe(false);

    const withHarmony = deriveSystem({
      tokens,
      assignments: new Map(),
      accentHarmony: "complementary",
    });
    const secondary = fillValue(withHarmony, "color/action/secondary");
    expect(secondary.token.id).toMatch(/^derived_/);
    expect(secondary.method).toContain("complementary");
    expect(secondary.token.value).not.toBe("#D92D20");
  });

  it("seeds shadow/inset and blur/backdrop from capture (§2.50)", () => {
    const tokens = fixtureTokens("capture-effects-kinds.json");
    const r = derive(tokens);
    expect(fillValue(r, "shadow/inset").token.id).toBe("fx_inset");
    expect(fillValue(r, "blur/backdrop").token.id).toBe("fx_blur");
    // Elevation uses the drop only — not inset or blur.
    const md = fillValue(r, "shadow/md");
    expect(md.token.id).toBe("fx_drop");
  });

  it("does not seed blur/backdrop from a manual Add-token (§2.64)", () => {
    const manualBlur: StyleSnapToken = {
      id: "manual_blur1",
      captureId: "manual-blur",
      source: "manual entry:backdrop-blur",
      name: "blur/blue",
      occurrences: 1,
      merged: false,
      type: "shadow",
      context: { cssProperty: "backdrop-filter" },
      value: [
        {
          inset: false,
          offsetX: 0,
          offsetY: 0,
          blur: 12,
          spread: 0,
          color: "#000000",
          opacity: 0,
        },
      ],
    };
    const r = derive([manualBlur]);
    expect(r.fills.some((f) => f.role === "blur/backdrop")).toBe(false);
  });
});
