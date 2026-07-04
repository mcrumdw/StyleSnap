import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../../contract/schema";
import type { StyleSnapToken } from "../../contract/types";
import { applyMerges } from "../dedup";
import { deriveRoleSuggestions } from "./derive";
import { fallbackName, validateSlashName } from "./naming";
import { ALL_ROLES, isValidRole, roleOrderIndex, rolesForType } from "./taxonomy";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../docs/fixtures/${name}`, import.meta.url), "utf-8");

function tokensOf(name: string): StyleSnapToken[] {
  const result = parseStyleSnapExport(fixture(name));
  if (!result.ok) throw new Error(`fixture ${name} should parse`);
  return result.data.tokens;
}

const browserTokens = tokensOf("capture-browser-messy.json");
const figmaTokens = tokensOf("capture-figma-clean.json");
const allTokens = [...browserTokens, ...figmaTokens];
const rawById = new Map(allTokens.map((t) => [t.id, t]));

describe("taxonomy (Appendix B)", () => {
  it("carries the 17 color roles and 6 type roles in B order", () => {
    expect(rolesForType("color")).toHaveLength(17);
    expect(rolesForType("typography")).toHaveLength(6);
    expect(ALL_ROLES.filter((r) => r.required && r.tokenType === "color")).toHaveLength(12);
    expect(roleOrderIndex("color/text/primary")).toBeLessThan(roleOrderIndex("color/action/primary"));
    expect(roleOrderIndex(undefined)).toBe(Number.MAX_SAFE_INTEGER); // role-less last
  });

  it("validates roles against their token type", () => {
    expect(isValidRole("color/action/primary", "color")).toBe(true);
    expect(isValidRole("color/action/primary", "typography")).toBe(false);
    expect(isValidRole("made/up/role", "color")).toBe(false);
  });
});

describe("derivation from the Figma fixture (authoredName wins)", () => {
  const suggestions = deriveRoleSuggestions(figmaTokens, rawById);

  it("auto-suggests the exact role for every taxonomy-named token", () => {
    const expected: Record<string, string> = {
      fig_001: "color/action/primary",
      fig_002: "color/text/primary",
      fig_003: "color/surface/page",
      fig_004: "color/surface/overlay",
      fig_005: "type/heading",
      fig_006: "type/body",
      fig_007: "space/md",
      fig_008: "radius/md",
      fig_009: "shadow/md",
    };
    for (const [id, role] of Object.entries(expected)) {
      expect(suggestions.get(id), id).toEqual({ role, source: "authored-name" });
    }
  });
});

describe("derivation from the browser fixture (B.4 context rules)", () => {
  const suggestions = deriveRoleSuggestions(browserTokens, rawById);
  const roleOf = (id: string) => suggestions.get(id)?.role;

  it("derives the acceptance-criteria roles", () => {
    expect(roleOf("ext_010")).toBe("color/surface/page"); // #F9FAFB body bg
    expect(roleOf("ext_001")).toBe("color/action/primary"); // button blue
    expect(roleOf("ext_005")).toBe("color/action/primary-hover"); // #2456CC :hover
  });

  it("covers the rest of the hint table", () => {
    expect(roleOf("ext_006")).toBe("color/text/primary"); // color on p
    expect(roleOf("ext_002")).toBe("color/text/link"); // color on a
    expect(roleOf("ext_009")).toBe("color/surface/card"); // card bg
    expect(roleOf("ext_011")).toBe("color/border/default"); // input border
    expect(roleOf("ext_012")).toBe("color/feedback/error"); // [role=alert]
    expect(roleOf("ext_014")).toBe("type/display"); // 48px h1
    expect(roleOf("ext_015")).toBe("type/body"); // p copy
  });

  it("never forces a role — the caption color stays a primitive", () => {
    expect(suggestions.has("ext_008")).toBe(false); // #667085 on span
    expect(suggestions.has("ext_013")).toBe(false); // gradient — no taxonomy roles
  });

  it("a fuzzy authoredName (--color-primary) falls through to context, not a guess", () => {
    expect(suggestions.get("ext_001")).toEqual({ role: "color/action/primary", source: "context" });
  });
});

describe("scale slots (B.4)", () => {
  const suggestions = deriveRoleSuggestions(allTokens, rawById);

  it("assigns radius/shadow/border-width slots by ascending size", () => {
    expect(suggestions.get("ext_027")?.role).toBe("radius/sm"); // 8px
    expect(suggestions.get("ext_028")?.role).toBe("radius/md"); // 12px
    expect(suggestions.get("ext_030")?.role).toBe("shadow/sm");
    expect(suggestions.get("ext_031")?.role).toBe("shadow/md");
    expect(suggestions.get("ext_029")?.role).toBe("border-width/default");
  });

  it("leaves spacing unassigned when there are more values than slots", () => {
    // 4/8/12/15/16/24/32/64 = 8 distinct values > 6 slots ⇒ user's call.
    const spacingSuggestions = browserTokens
      .filter((t) => t.type === "spacing")
      .filter((t) => suggestions.has(t.id));
    expect(spacingSuggestions).toHaveLength(0);
  });

  it("a merge survivor inherits the absorbed token's authoredName", () => {
    // Merge Figma's `space/md` 16px into the browser's 16px survivor.
    const view = applyMerges(allTokens.map((token) => ({ token })), [
      { survivorId: "ext_023", mergedIds: ["fig_007"], mergedAt: "t" },
    ]).map((e) => e.token);
    const merged = deriveRoleSuggestions(view, rawById);
    expect(merged.get("ext_023")).toEqual({ role: "space/md", source: "authored-name" });
  });
});

describe("determinism", () => {
  it("same tokens in any order ⇒ identical suggestions", () => {
    const a = [...deriveRoleSuggestions(allTokens, rawById).entries()].sort();
    const b = [...deriveRoleSuggestions([...allTokens].reverse(), rawById).entries()].sort();
    expect(b).toEqual(a);
  });
});

describe("naming (§7.7)", () => {
  it("accepts slash-nested names and rejects everything else", () => {
    expect(validateSlashName("color/action/primary")).toBeNull();
    expect(validateSlashName("color/brand-blue-deep")).toBeNull();
    expect(validateSlashName("space/md")).toBeNull();
    expect(validateSlashName("not-a-slash-name")).toBeTruthy();
    expect(validateSlashName("Color/Primary")).toBeTruthy(); // uppercase
    expect(validateSlashName("color/")).toBeTruthy();
    expect(validateSlashName("/primary")).toBeTruthy();
  });

  it("generates deterministic slash-valid fallback names (FR-22)", () => {
    const byId = new Map(allTokens.map((t) => [t.id, t]));
    expect(fallbackName(byId.get("ext_001")!)).toBe("color/2e6bff");
    expect(fallbackName(byId.get("fig_004")!)).toBe("color/101828-50"); // scrim @ 50%
    expect(fallbackName(byId.get("ext_014")!)).toBe("type/inter-48-700");
    expect(fallbackName(byId.get("ext_018")!)).toBe("type/inter-14-500-uppercase");
    expect(fallbackName(byId.get("ext_023")!)).toBe("space/16");
    expect(fallbackName(byId.get("ext_031")!)).toBe("shadow/0-4-8-n2"); // -2 spread
    expect(fallbackName(byId.get("ext_013")!)).toBe("gradient/linear-135");
    for (const token of allTokens) {
      expect(validateSlashName(fallbackName(token)), token.id).toBeNull();
    }
  });
});
