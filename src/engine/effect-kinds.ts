import type { StyleSnapToken } from "../contract/types";

/** Appendix B elevation scale slots (§2.50) — drop shadows only. */
export const ELEVATION_ROLES = ["shadow/sm", "shadow/md", "shadow/lg"] as const;
export const ELEVATION_ROLE_SET = new Set<string>(ELEVATION_ROLES);

/** Zero-offset, zero-opacity encoding used for manual backdrop blur (§2.28). */
function isBackdropBlurEncoding(token: StyleSnapToken & { type: "shadow" }): boolean {
  const l = token.value[0];
  if (!l || l.inset) return false;
  return (
    l.offsetX === 0 &&
    l.offsetY === 0 &&
    l.spread === 0 &&
    l.opacity === 0 &&
    l.color.toUpperCase() === "#000000" &&
    l.blur > 0
  );
}

/** Manual / captured backdrop-blur encoded as a shadow token (§2.14 / §2.28 / §2.50). */
export function isBackdropBlurToken(token: StyleSnapToken): boolean {
  if (token.type !== "shadow") return false;
  if (token.context?.cssProperty === "backdrop-filter") return true;
  if (token.source === "manual entry:backdrop-blur" || token.source.endsWith(":backdrop-blur")) {
    return true;
  }
  // Markers can be lost on save-as-primitive — fall back to the encoding shape.
  return isBackdropBlurEncoding(token);
}

export function backdropBlurPx(token: StyleSnapToken): number {
  if (token.type !== "shadow") return 0;
  return token.value[0]?.blur ?? 0;
}

/** Inner box-shadow (any layer inset). Excludes backdrop blur. */
export function isInsetShadowToken(token: StyleSnapToken): boolean {
  if (token.type !== "shadow" || isBackdropBlurToken(token)) return false;
  return token.value.some((l) => l.inset);
}

/** Outer drop elevation — not blur, not inset, not text-shadow. */
export function isDropShadowToken(token: StyleSnapToken): boolean {
  if (token.type !== "shadow" || isBackdropBlurToken(token)) return false;
  if (token.context?.cssProperty === "text-shadow") return false;
  return !token.value.some((l) => l.inset);
}

export type EffectRoleKind = "elevation" | "inset" | "blur" | "shadow-custom";

export function effectRoleKind(role: string): EffectRoleKind | null {
  if (role.startsWith("effect/") || role.startsWith("blur/")) return "blur";
  if (role === "shadow/inset") return "inset";
  if (ELEVATION_ROLE_SET.has(role)) return "elevation";
  if (role.startsWith("shadow/")) return "shadow-custom";
  return null;
}

/** Whether a shadow-typed role may point at this token (§2.50). Non-effect roles always pass. */
export function roleCompatibleWithToken(role: string, token: StyleSnapToken): boolean {
  const kind = effectRoleKind(role);
  if (kind === null) return true;
  if (token.type !== "shadow") return false;
  if (kind === "blur") return isBackdropBlurToken(token);
  if (kind === "inset") return isInsetShadowToken(token);
  if (kind === "elevation") return isDropShadowToken(token);
  // Custom shadow/… — drop or inset, never blur.
  return !isBackdropBlurToken(token);
}
