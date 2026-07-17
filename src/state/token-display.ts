// Human-facing labels + CSS helpers for token previews (captured values = data).

import type { GradientValue, ShadowLayer, ShadowValue, StyleSnapToken } from "../contract/types";

export function cssColor(hex: string, opacity: number): string {
  if (opacity >= 1) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export function cssGradient(value: GradientValue): string {
  const stops = value.stops
    .map((s) => `${cssColor(s.color, s.opacity)} ${s.position * 100}%`)
    .join(", ");
  switch (value.kind) {
    case "linear":
      return `linear-gradient(${value.angle ?? 180}deg, ${stops})`;
    case "radial":
      return `radial-gradient(circle, ${stops})`;
    case "conic":
      return `conic-gradient(${stops})`;
  }
}

export function cssShadow(value: ShadowValue): string {
  return value
    .map(
      (l) =>
        `${l.inset ? "inset " : ""}${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.spread}px ${cssColor(l.color, l.opacity)}`,
    )
    .join(", ");
}

const pct = (opacity: number) => `${Math.round(opacity * 100)}%`;

function describeOffset(l: ShadowLayer): string | null {
  const x = l.offsetX;
  const y = l.offsetY;
  if (x === 0 && y === 0) return null;
  const parts: string[] = [];
  if (Math.abs(y) >= 1) parts.push(`${Math.abs(y)}px ${y > 0 ? "down" : "up"}`);
  if (Math.abs(x) >= 1) parts.push(`${Math.abs(x)}px ${x > 0 ? "right" : "left"}`);
  return parts.join(", ");
}

function describeBlur(l: ShadowLayer): string {
  if (l.blur >= 20) return "very soft blur";
  if (l.blur >= 10) return "soft blur";
  if (l.blur >= 4) return "medium blur";
  if (l.blur > 0) return "tight blur";
  return "no blur";
}

function describeSpread(l: ShadowLayer): string | null {
  if (l.spread === 0) return null;
  if (l.spread < 0) return "tighter edge";
  return "spread wider";
}

function shadowInkSummary(value: ShadowValue): string {
  const hexes = [...new Set(value.map((l) => l.color))];
  if (hexes.length !== 1) return "mixed shadow colors";
  const opacities = value.map((l) => l.opacity);
  const min = Math.min(...opacities);
  const max = Math.max(...opacities);
  if (min === max) return min < 1 ? `${hexes[0]} at ${pct(min)}` : hexes[0];
  return `${hexes[0]} at ${pct(min)}–${pct(max)}`;
}

export function describeShadowLayer(l: ShadowLayer): string {
  const kind = l.inset ? "Inner shadow" : "Drop shadow";
  const offset = describeOffset(l);
  const spread = describeSpread(l);
  return [kind, offset, describeBlur(l), spread, shadowInkSummary([l])].filter(Boolean).join(" · ");
}

export function describeShadowValue(value: ShadowValue): string {
  if (value.length === 0) return "No shadow";
  const ink = shadowInkSummary(value);
  if (value.length === 1) {
    const layer = describeShadowLayer(value[0]);
    // ink already on layer line
    return layer;
  }
  const kinds = [...new Set(value.map((l) => (l.inset ? "inner" : "drop")))];
  const kindWord = kinds.length > 1 ? "Mixed" : kinds[0] === "inner" ? "Inner" : "Drop";
  const maxY = Math.max(...value.map((l) => l.offsetY));
  const maxBlur = Math.max(...value.map((l) => l.blur));
  return `${kindWord} shadow · ${value.length} layers · ${maxY}px down · ${maxBlur}px blur · ${ink}`;
}

/** sm/md/lg slot meaning for effect rows. */
export function shadowRoleHint(role: string): string | undefined {
  if (role === "shadow/sm") return "Subtle — chips, inputs";
  if (role === "shadow/md") return "Cards & panels";
  if (role === "shadow/lg") return "Modals & overlays";
  return undefined;
}

/** Resolved captured roles for decorating token previews — never StyleSnap app chrome. */
export interface TokenPreviewContext {
  surfaceCard: string;
  surfacePage: string;
  textPrimary: string;
  actionPrimary: string;
  borderDefault: string;
  cardRadiusPx: number;
}

const PREVIEW_NEUTRALS = {
  surfaceCard: "#FFFFFF",
  surfacePage: "#F4F4F5",
  textPrimary: "#18181B",
  actionPrimary: "#71717A",
  borderDefault: "#D4D4D8",
} as const;

export const EMPTY_PREVIEW_CONTEXT: TokenPreviewContext = { ...PREVIEW_NEUTRALS, cardRadiusPx: 4 };

const CHECKER_LIGHT = PREVIEW_NEUTRALS.surfaceCard;
/** StyleSnap strip backdrop (DESIGN.md state-disabled-bg) — not captured surface/page. */
const STRIP_BACKDROP = "#ECEAF2";

function parseHexRgb(hex: string): [number, number, number] | null {
  if (!hex.startsWith("#") || hex.length < 7) return null;
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const rgb = parseHexRgb(hex);
  if (!rgb) return 0;
  const lin = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function contrastRatio(foreground: string, background: string): number {
  const l1 = relativeLuminance(foreground) + 0.05;
  const l2 = relativeLuminance(background) + 0.05;
  return l1 > l2 ? l1 / l2 : l2 / l1;
}

function isLowContrast(foreground: string, background: string, minRatio = 1.35): boolean {
  return contrastRatio(foreground, background) < minRatio;
}

/** Border stroke for width previews — falls back when captured border ink is too faint to see. */
export function previewBorderStrokeColor(ctx: TokenPreviewContext): string {
  if (
    isLowContrast(ctx.borderDefault, ctx.surfaceCard) &&
    isLowContrast(ctx.borderDefault, ctx.surfacePage) &&
    isLowContrast(ctx.borderDefault, CHECKER_LIGHT) &&
    isLowContrast(ctx.borderDefault, STRIP_BACKDROP)
  ) {
    return ctx.textPrimary;
  }
  return ctx.borderDefault;
}

export type RoleTokenMap = ReadonlyMap<string, StyleSnapToken>;

function roleColor(map: RoleTokenMap, roles: string[]): string | undefined {
  for (const role of roles) {
    const token = map.get(role);
    if (token?.type === "color") return cssColor(token.value, token.opacity);
  }
  return undefined;
}

/** Build preview chrome from assigned roles in the current draft (DECISIONS §2.19). */
export function buildPreviewContext(roleTokens: RoleTokenMap): TokenPreviewContext {
  const radius =
    roleTokens.get("radius/md") ??
    roleTokens.get("radius/sm") ??
    roleTokens.get("radius/lg");
  return {
    surfaceCard:
      roleColor(roleTokens, ["color/surface/card", "color/surface/page"]) ??
      PREVIEW_NEUTRALS.surfaceCard,
    surfacePage:
      roleColor(roleTokens, ["color/surface/page", "color/surface/card"]) ??
      PREVIEW_NEUTRALS.surfacePage,
    textPrimary:
      roleColor(roleTokens, ["color/text/primary", "color/text/muted"]) ??
      PREVIEW_NEUTRALS.textPrimary,
    actionPrimary:
      roleColor(roleTokens, ["color/action/primary"]) ?? PREVIEW_NEUTRALS.actionPrimary,
    borderDefault:
      roleColor(roleTokens, ["color/border/default"]) ?? PREVIEW_NEUTRALS.borderDefault,
    cardRadiusPx: radius?.type === "border-radius" ? radius.value : 4,
  };
}

/** Plain-language subtitle for role rows — non-experts first, technical detail in title/tooltip. */
export function humanValueLabel(token: StyleSnapToken, role?: string): string {
  switch (token.type) {
    case "color":
      return token.opacity < 1
        ? `Color ${token.value} at ${pct(token.opacity)} opacity`
        : `Solid color ${token.value}`;
    case "gradient": {
      const v = token.value;
      const angle = v.kind === "linear" && v.angle !== undefined ? ` at ${v.angle}°` : "";
      return `${v.kind} gradient${angle} · ${v.stops.length} stops`;
    }
    case "typography": {
      const v = token.value;
      const style = v.fontStyle === "italic" ? " italic" : "";
      return `${v.fontSize}px ${v.fontFamily}${style} · weight ${v.fontWeight}`;
    }
    case "spacing":
      return `${token.value}px gap or padding`;
    case "border-radius":
      return `${token.value}px corner rounding`;
    case "border-width":
      return `${token.value}px border stroke`;
    case "shadow": {
      const base = describeShadowValue(token.value);
      const hint = role ? shadowRoleHint(role) : undefined;
      return hint ? `${base} — ${hint}` : base;
    }
  }
}
