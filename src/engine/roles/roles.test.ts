import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../../contract/schema";
import type { StyleSnapToken } from "../../contract/types";
import { applyMerges } from "../dedup";
import { deriveRoleCandidates, topSuggestionsByToken } from "./derive";
import { fallbackName, namePlaceholder, validateSlashName } from "./naming";
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

/** The strongest candidate for a role. */
const topOf = (candidates: ReturnType<typeof deriveRoleCandidates>, role: string) =>
  candidates.get(role)?.[0];

describe("derivation from the Figma fixture (authoredName wins)", () => {
  const candidates = deriveRoleCandidates(figmaTokens, rawById);

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
      const top = topOf(candidates, role);
      expect(top?.tokenId, role).toBe(id);
      expect(top?.source, role).toBe("authored-name");
    }
  });
});

describe("derivation from the browser fixture (B.4 context rules)", () => {
  const candidates = deriveRoleCandidates(browserTokens, rawById);

  it("derives the acceptance-criteria roles", () => {
    expect(topOf(candidates, "color/surface/page")?.tokenId).toBe("ext_010"); // #F9FAFB body bg
    expect(topOf(candidates, "color/action/primary")?.tokenId).toBe("ext_001"); // button blue
    expect(topOf(candidates, "color/action/primary-hover")?.tokenId).toBe("ext_005"); // :hover
  });

  it("covers the rest of the hint table", () => {
    expect(topOf(candidates, "color/text/primary")?.tokenId).toBe("ext_006"); // color on p, 44×
    expect(topOf(candidates, "color/text/link")?.tokenId).toBe("ext_002"); // color on a
    expect(topOf(candidates, "color/surface/card")?.tokenId).toBe("ext_009"); // card bg, 25×
    expect(topOf(candidates, "color/border/default")?.tokenId).toBe("ext_011"); // input border
    expect(topOf(candidates, "color/feedback/error")?.tokenId).toBe("ext_012"); // [role=alert]
    expect(topOf(candidates, "type/display")?.tokenId).toBe("ext_014"); // 48px h1
    expect(topOf(candidates, "type/body")?.tokenId).toBe("ext_015"); // p copy
  });

  it("never forces a role — the caption color stays a primitive", () => {
    for (const list of candidates.values()) {
      expect(list.some((c) => c.tokenId === "ext_008")).toBe(false); // #667085 on span
      expect(list.some((c) => c.tokenId === "ext_013")).toBe(false); // gradient — no roles
    }
  });

  it("a fuzzy authoredName (--color-primary) falls through to context, not a guess", () => {
    expect(topOf(candidates, "color/action/primary")?.source).toBe("context");
  });
});

describe("multi-role candidates (Phase 8 — roles point at primitives)", () => {
  it("the merged blue is the top candidate for action/primary AND text/link", () => {
    const view = applyMerges(allTokens.map((token) => ({ token })), [
      { survivorId: "ext_001", mergedIds: ["ext_002", "ext_003", "ext_004", "fig_001"], mergedAt: "t" },
    ]).map((e) => e.token);
    const candidates = deriveRoleCandidates(view, rawById);
    // fig_001's authored name + ext_002's link context both land on the survivor.
    const primary = topOf(candidates, "color/action/primary");
    expect(primary).toMatchObject({ tokenId: "ext_001", source: "authored-name" });
    const link = topOf(candidates, "color/text/link");
    expect(link).toMatchObject({ tokenId: "ext_001", source: "context" });
    // The absorbed badge/banner catch-all (surface/card) must NOT pollute the
    // blue — a specific rule fired, so the fallback stays silent.
    expect(candidates.get("color/surface/card")?.some((c) => c.tokenId === "ext_001")).toBeFalsy();
    // The dashed chips show both roles on the one card.
    const chips = topSuggestionsByToken(candidates).get("ext_001");
    expect(chips).toContain("color/action/primary");
    expect(chips).toContain("color/text/link");
  });
});

describe("scale slots (B.4)", () => {
  const candidates = deriveRoleCandidates(allTokens, rawById);

  it("assigns radius/shadow/border-width slots by ascending size", () => {
    expect(topOf(candidates, "radius/sm")?.tokenId).toBe("ext_027"); // 8px
    // Figma's authored `radius/md` outranks the browser 12px scale hint —
    // but both are candidates for the slot.
    expect(topOf(candidates, "radius/md")?.tokenId).toBe("fig_008");
    expect(candidates.get("radius/md")?.some((c) => c.tokenId === "ext_028")).toBe(true);
    expect(topOf(candidates, "shadow/sm")?.tokenId).toBe("ext_030");
    expect(topOf(candidates, "shadow/md")?.tokenId).toBe("fig_009"); // authored beats scale
    expect(candidates.get("shadow/md")?.some((c) => c.tokenId === "ext_031")).toBe(true);
    expect(topOf(candidates, "border-width/default")?.tokenId).toBe("ext_029");
  });

  it("leaves spacing unassigned when there are more values than slots", () => {
    // 4/8/12/15/16/24/32/64 = 8 distinct values > 6 slots ⇒ user's call.
    for (const [role, list] of candidates) {
      if (!role.startsWith("space/")) continue;
      expect(list.filter((c) => c.tokenId.startsWith("ext_"))).toHaveLength(0);
    }
  });

  it("a merge survivor inherits the absorbed token's authoredName", () => {
    // Merge Figma's `space/md` 16px into the browser's 16px survivor.
    const view = applyMerges(allTokens.map((token) => ({ token })), [
      { survivorId: "ext_023", mergedIds: ["fig_007"], mergedAt: "t" },
    ]).map((e) => e.token);
    const merged = deriveRoleCandidates(view, rawById);
    expect(topOf(merged, "space/md")).toMatchObject({
      tokenId: "ext_023",
      source: "authored-name",
    });
  });
});

describe("determinism", () => {
  it("same tokens in any order ⇒ identical candidates", () => {
    const serialize = (tokens: StyleSnapToken[]) =>
      JSON.stringify([...deriveRoleCandidates(tokens, rawById).entries()].sort());
    expect(serialize([...allTokens].reverse())).toBe(serialize(allTokens));
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

  it("namePlaceholder matches token type (never color/ for fonts)", () => {
    expect(namePlaceholder("color")).toBe("color/brand-blue");
    expect(namePlaceholder("typography")).toBe("type/inter-16-400");
    expect(namePlaceholder("spacing")).toBe("space/md");
    expect(namePlaceholder("border-radius")).toBe("radius/md");
    expect(namePlaceholder("border-width")).toBe("border-width/default");
    expect(namePlaceholder("shadow")).toBe("shadow/card-elevation");
    expect(namePlaceholder("shadow", { effectKind: "backdrop-blur" })).toBe("effect/backdrop-blur");
    expect(namePlaceholder("shadow", { effectKind: "inset" })).toBe("shadow/inset-depth");
    expect(namePlaceholder("gradient")).toBe("gradient/hero");
    for (const type of [
      "color",
      "gradient",
      "typography",
      "spacing",
      "border-radius",
      "border-width",
      "shadow",
    ] as const) {
      expect(validateSlashName(namePlaceholder(type)), type).toBeNull();
    }
  });
});
