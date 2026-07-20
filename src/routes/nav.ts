import type { TokenType } from "../contract/types";

/** Map a semantic role id to the app-shell route that edits it. */
export function routeForRole(role: string): string {
  const focus = `?focus=${encodeURIComponent(role)}`;
  if (role.startsWith("color/")) return `/tokens/colors${focus}`;
  if (role.startsWith("type/")) return `/tokens/typography${focus}`;
  if (role.startsWith("space/")) return `/tokens/spacing${focus}`;
  if (role.startsWith("radius/")) return `/tokens/radius${focus}`;
  if (role.startsWith("border-width/")) return `/tokens/borders${focus}`;
  if (
    role.startsWith("shadow/") ||
    role.startsWith("effect/") ||
    role.startsWith("blur/")
  ) {
    return `/tokens/effects${focus}`;
  }
  return `/tokens/colors`;
}

/** Gap "Add token" — land on the right category page and open the manual form. */
export function routeForAddToken(preset: {
  tokenType: TokenType;
  role?: string;
}): { pathname: string; state: { addTokenPreset: typeof preset } } {
  if (preset.role) {
    return { pathname: routeForRole(preset.role), state: { addTokenPreset: preset } };
  }
  const byType: Partial<Record<TokenType, string>> = {
    color: "/tokens/colors",
    gradient: "/tokens/colors",
    typography: "/tokens/typography",
    spacing: "/tokens/spacing",
    "border-radius": "/tokens/radius",
    "border-width": "/tokens/borders",
    shadow: "/tokens/effects",
  };
  return {
    pathname: byType[preset.tokenType] ?? "/tokens/colors",
    state: { addTokenPreset: preset },
  };
}
