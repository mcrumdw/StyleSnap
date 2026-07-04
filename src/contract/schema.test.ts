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
});
