import { describe, expect, it } from "vitest";
import {
  buildCustomRole,
  inferCustomRoles,
  isAllowedCustomRole,
  isCanonicalRole,
  normalizeRolePath,
  rolePrefixForType,
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
