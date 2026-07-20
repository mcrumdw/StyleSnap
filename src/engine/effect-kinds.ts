import type { StyleSnapToken } from "../contract/types";

/** Manual backdrop-blur encoded as a shadow token (§2.14 / §2.28). */
export function isBackdropBlurToken(token: StyleSnapToken): boolean {
  if (token.type !== "shadow") return false;
  if (token.context?.cssProperty === "backdrop-filter") return true;
  return token.source === "manual entry:backdrop-blur" || token.source.endsWith(":backdrop-blur");
}

export function backdropBlurPx(token: StyleSnapToken): number {
  if (token.type !== "shadow") return 0;
  return token.value[0]?.blur ?? 0;
}
