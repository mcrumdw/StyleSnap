import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "./schema";

const fixture = (name: string) =>
  readFileSync(new URL(`../../docs/fixtures/${name}`, import.meta.url), "utf-8");

describe("parseStyleSnapExport", () => {
  it("accepts the clean Figma fixture", () => {
    const result = parseStyleSnapExport(fixture("capture-figma-clean.json"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.meta.source).toBe("figma");
      expect(result.data.tokens.length).toBeGreaterThan(0);
    }
  });

  it("accepts the messy browser fixture (envelope-only validation)", () => {
    const result = parseStyleSnapExport(fixture("capture-browser-messy.json"));
    expect(result.ok).toBe(true);
  });

  it("rejects the malformed fixture with a friendly error", () => {
    const result = parseStyleSnapExport(fixture("capture-malformed.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBeTruthy();
      expect(result.details.length).toBeGreaterThan(0);
    }
  });

  it("accepts the FIFA fixture (unique ids across captures)", () => {
    const result = parseStyleSnapExport(fixture("capture-fifa.json"));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.tokens.filter((t) => t.type === "color")).toHaveLength(9);
      const ids = result.data.tokens.map((t) => t.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it("rejects captures with duplicate token ids (FIFA-style id collision)", () => {
    const base = JSON.parse(fixture("capture-thin.json")) as {
      meta: Record<string, unknown>;
      tokens: Array<Record<string, unknown>>;
    };
    base.tokens = [
      {
        id: "ext_001",
        captureId: "cap-1",
        source: "button",
        name: null,
        occurrences: 1,
        merged: false,
        type: "color",
        value: "#DAC287",
        opacity: 1,
      },
      {
        id: "ext_001",
        captureId: "cap-2",
        source: "div",
        name: null,
        occurrences: 1,
        merged: false,
        type: "spacing",
        value: 16,
      },
      {
        id: "ext_002",
        captureId: "cap-2",
        source: "div",
        name: null,
        occurrences: 1,
        merged: false,
        type: "spacing",
        value: 8,
      },
      {
        id: "ext_002",
        captureId: "cap-3",
        source: "span",
        name: null,
        occurrences: 1,
        merged: false,
        type: "border-width",
        value: 1,
      },
    ];
    const result = parseStyleSnapExport(JSON.stringify(base));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.details[0]).toMatch(/token ids must be unique/);
      expect(result.details[0]).toMatch(/ext_00[12]/);
      expect(result.details[0]).toMatch(/update the extension/);
    }
  });
});
