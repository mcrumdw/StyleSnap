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

  it("interaction states by OKLCH lightness shifts", () => {
    expect(fillValue(r, "color/action/primary").token.id).toBe("ext_td_01"); // anchor claims
    expect(fillValue(r, "color/action/primary-hover").token.value).toBe("#009263");
    expect(fillValue(r, "color/action/primary-active").token.value).toBe("#007E55");
    expect(fillValue(r, "color/border/focus").token.id).toBe("ext_td_01"); // focus = primary
  });

  it("tinted neutrals wear the brand hue at chroma ≤ 0.02", () => {
    expect(fillValue(r, "color/text/primary").token.value).toBe("#121E18");
    expect(fillValue(r, "color/text/muted").token.value).toBe("#5F6D65");
    expect(fillValue(r, "color/surface/page").token.value).toBe("#EFFFF6");
    expect(fillValue(r, "color/surface/card").token.value).toBe("#FFFFFF");
    expect(fillValue(r, "color/border/default").token.value).toBe("#D3E2DA");
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
    expect(size("type/display")).toBe(31); // whole-px sizes only (16×1.25³ = 31.25 → 31)
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

  it("radius ×0.5/×1/×2 from captured 8; border-width falls back to the 1px convention", () => {
    expect(fillValue(r, "radius/sm").token.value).toBe(4);
    expect(fillValue(r, "radius/md").token.id).toBe("ext_th_06");
    expect(fillValue(r, "radius/lg").token.value).toBe(16);
    const width = fillValue(r, "border-width/default");
    expect(width.token.value).toBe(1);
    expect(width.derivedFrom).toBe("convention");
  });

  it("shadow ramp reuses ink at 8% when nothing was captured", () => {
    const sm = fillValue(r, "shadow/sm").token;
    if (sm.type !== "shadow") throw new Error("expected shadow");
    expect(sm.value[0]).toEqual({
      inset: false,
      offsetX: 0,
      offsetY: 1,
      blur: 2,
      spread: 0,
      color: "#1B1923", // the derived ink
      opacity: 0.08,
    });
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

  it("changing the primary anchor regenerates the derived colors", () => {
    const before = derive(tokens);
    const after = derive(tokens, { primaryColorId: "ext_td_04" }); // darker green
    expect(fillValue(after, "color/action/primary-hover").token.value).not.toBe(
      fillValue(before, "color/action/primary-hover").token.value,
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

    expect(fillValue(r, "color/action/secondary").token.id).toMatch(/^derived_/);
    expect(fillValue(r, "color/action/secondary").method).toContain("accent");
    expect(fillValue(r, "type/mono").token.type).toBe("typography");
    expect(fillValue(r, "shadow/md").token.id).toBe("ext_td_20");
    expect(assignments.get("radius/lg")).toBe("ext_td_18");
    expect(gaps.filter((g) => g.severity === "recommended")).toHaveLength(0);
    expect(gaps.filter((g) => g.id.startsWith("unassigned-"))).toHaveLength(0);
  });

  it("uses secondary anchor when a distinct hue is detected", () => {
    const r = derive(fixtureTokens("capture-ember-app.json"));
    const secondary = fillValue(r, "color/action/secondary");
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

  it("accentHarmony overrides auto-detected secondary anchor", () => {
    const tokens = fixtureTokens("capture-ember-app.json");
    const anchored = derive(fixtureTokens("capture-ember-app.json"));
    expect(fillValue(anchored, "color/action/secondary").token.id).toBe("ext_em_12");

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
});
