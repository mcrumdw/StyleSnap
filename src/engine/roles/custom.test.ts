import { describe, expect, it } from "vitest";
import {
  buildCustomRole,
  inferCustomRoles,
  isAllowedCustomRole,
  isCanonicalRole,
  isEffectsCategoryRole,
  normalizeRolePath,
  rolePrefixForType,
  tokenTypeFromRole,
} from "./custom";

describe("custom roles (§2.30)", () => {
  it("normalizes paths to kebab slash-nested segments", () => {
    expect(normalizeRolePath(" Table Cell ")).toBe("table-cell");
    expect(normalizeRolePath("border/card")).toBe("border/card");
    expect(normalizeRolePath("Bad Path!")).toBeNull();
  });

  it("builds type-prefixed roles and rejects Appendix B collisions", () => {
    expect(buildCustomRole("border-width", "card")).toBe("border-width/card");
    expect(buildCustomRole("border-width", "table cell")).toBe("border-width/table-cell");
    expect(buildCustomRole("color", "border/card")).toBe("color/border/card");
    expect(buildCustomRole("border-width", "default")).toBeNull();
    expect(buildCustomRole("color", "text/primary")).toBeNull();
    expect(buildCustomRole("spacing", "page")).toBeNull(); // §2.47 canonical
    expect(rolePrefixForType("gradient")).toBeNull();
  });

  it("allows customs only under the matching type prefix", () => {
    expect(isCanonicalRole("border-width/default")).toBe(true);
    expect(isAllowedCustomRole("border-width/card", "border-width")).toBe(true);
    expect(isAllowedCustomRole("border-width/card", "color")).toBe(false);
    expect(isAllowedCustomRole("color/border/card", "color")).toBe(true);
  });

  it("infers customs from assignments for draft migration", () => {
    expect(
      inferCustomRoles({
        "border-width/default": "a",
        "border-width/card": "b",
        "color/border/table-cell": "c",
      }),
    ).toEqual(["border-width/card", "color/border/table-cell"]);
  });
});

describe("effect / blur custom roles (§2.46)", () => {
  it("builds backdrop-blur roles under effect/ or blur/, not shadow/", () => {
    expect(buildCustomRole("shadow", "backdrop-blur")).toBe("shadow/backdrop-blur");
    expect(buildCustomRole("shadow", "blur1", "effect/")).toBe("effect/blur1");
    expect(buildCustomRole("shadow", "blur1", "blur/")).toBe("blur/blur1");
    expect(buildCustomRole("shadow", "blur1", "color/")).toBeNull();
  });

  it("allows effect/ and blur/ as shadow-typed customs", () => {
    expect(isAllowedCustomRole("effect/backdrop-blur", "shadow")).toBe(true);
    expect(isAllowedCustomRole("blur/blur1", "shadow")).toBe(true);
    expect(isAllowedCustomRole("shadow/card-lift", "shadow")).toBe(true);
    expect(isAllowedCustomRole("blur/backdrop", "shadow")).toBe(false); // canonical §2.50
    expect(isAllowedCustomRole("blur/blur1", "color")).toBe(false);
    expect(isEffectsCategoryRole("blur/blur1")).toBe(true);
    expect(isEffectsCategoryRole("effect/glass")).toBe(true);
    expect(isEffectsCategoryRole("shadow/md")).toBe(true);
    expect(isEffectsCategoryRole("blur/backdrop")).toBe(true);
    expect(isEffectsCategoryRole("space/md")).toBe(false);
  });

  it("maps effect/ and blur/ roles back to shadow token type", () => {
    expect(tokenTypeFromRole("effect/blur1")).toBe("shadow");
    expect(tokenTypeFromRole("blur/blur1")).toBe("shadow");
    expect(
      inferCustomRoles({
        "shadow/md": "a",
        "blur/blur1": "b",
        "effect/glass": "c",
      }),
    ).toEqual(["blur/blur1", "effect/glass"]);
  });
});
