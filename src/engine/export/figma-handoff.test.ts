import { describe, expect, it } from "vitest";
import { buildFigmaHandoff } from "./figma-handoff";
import { generateCleanedJson, type ExportInput } from "./index";
import {
  ORACLE_ASSIGNMENTS,
  ORACLE_MERGES,
  ORACLE_NAMES,
  ORACLE_NOTES,
  oracleCaptures,
  oracleEffective,
  oracleRawTokens,
} from "../testing/oracle";
import { spacingInsight, radiusInsight, typeInsight } from "../insights";

function oracleExportInput(): ExportInput {
  const raw = oracleRawTokens();
  const effective = oracleEffective();
  const assignmentsObj = Object.fromEntries(effective.assignments);
  return {
    projectName: "Lumen",
    generatedAt: "2026-07-04T12:00:00Z",
    captures: oracleCaptures().map((c) => c.meta),
    rawTokenCount: raw.length,
    mergeCount: ORACLE_MERGES.length,
    tokens: effective.tokens,
    rawById: new Map(raw.map((t) => [t.id, t])),
    assignments: effective.assignments,
    names: ORACLE_NAMES,
    notes: ORACLE_NOTES,
    derived: effective.derived,
    unreviewedMerges: 0,
    spacingInsight: spacingInsight(effective.tokens, assignmentsObj),
    radiusInsight: radiusInsight(effective.tokens, assignmentsObj),
    typeInsight: typeInsight(effective.tokens, ORACLE_ASSIGNMENTS.get("type/body"), 1.25),
  };
}

describe("buildFigmaHandoff (§2.66)", () => {
  const input = oracleExportInput();
  const { roles, figmaHandoff } = buildFigmaHandoff({
    tokens: input.tokens,
    assignments: input.assignments,
    names: input.names,
  });

  it("exports role → token id map", () => {
    expect(roles["color/action/primary"]).toBe("ext_001");
    expect(roles["type/body"]).toBeDefined();
  });

  it("puts color/spacing primitives in the Primitives plan", () => {
    expect(figmaHandoff.version).toBe("1.0");
    const brand = figmaHandoff.collections.primitives.find((p) => p.name === "color/brand-blue");
    expect(brand).toMatchObject({ type: "COLOR", value: "#2E6BFF" });
    const space = figmaHandoff.collections.primitives.filter((p) => p.type === "FLOAT");
    expect(space.length).toBeGreaterThan(0);
  });

  it("aliases semantic color roles to primitive names", () => {
    const primary = figmaHandoff.collections.semantic.find((s) => s.name === "color/action/primary");
    expect(primary).toMatchObject({
      type: "COLOR",
      aliasOf: "color/brand-blue",
      role: "color/action/primary",
    });
  });

  it("emits paint styles for color roles bound to semantic vars", () => {
    const paint = figmaHandoff.styles.paint.find((p) => p.name === "color/action/primary");
    expect(paint).toMatchObject({
      kind: "solid",
      bindVariableName: "color/action/primary",
    });
  });

  it("emits text styles for type roles", () => {
    const body = figmaHandoff.styles.text.find((t) => t.name === "type/body");
    expect(body?.value.fontSize).toBe(16);
  });

  it("emits effect styles for shadow roles", () => {
    const sm = figmaHandoff.styles.effect.find((e) => e.name === "shadow/sm");
    expect(sm?.kind).toBe("drop");
    expect(sm?.layers.length).toBeGreaterThan(0);
  });
});

describe("generateCleanedJson includes figma handoff", () => {
  it("attaches roles and figmaHandoff; still round-trips the envelope", () => {
    const cleaned = generateCleanedJson(oracleExportInput());
    expect(cleaned.roles?.["color/action/primary"]).toBe("ext_001");
    expect(cleaned.figmaHandoff?.collections.semantic.length).toBeGreaterThan(0);
    expect(cleaned.figmaHandoff?.styles.paint.some((p) => p.kind === "solid")).toBe(true);
  });
});
