import type { StyleSnapToken } from "../contract/types";

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

/** Manual backdrop-blur encoded as a shadow token (§2.14 / §2.28). */
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
