// StyleSnap — export local Variables + Styles back as a capture JSON (§2.67).
// Paste into the web app as a new capture (names + values from Figma).
//
// Semantic / style accordion paths must survive: keep every distinct role name
// (`color/feedback/warning`, `type/body`, `shadow/md`) even when values match.
// Only drop non-role hex/primitive duplicates of those values.

import type {
  StyleSnapExport,
  StyleSnapToken,
  GradientValue,
  TypographyValue,
  ShadowValue,
  ShadowLayer,
  TokenContext,
  TokenType,
} from "../../docs/types";

const COLLECTION_PRIMITIVES = "StyleSnap / Primitives";
const COLLECTION_SEMANTIC = "StyleSnap / Semantic";

/** Slash prefixes that map to StyleSnap system roles (Appendix B). */
const ROLE_PREFIXES = [
  "color/",
  "type/",
  "space/",
  "radius/",
  "border-width/",
  "shadow/",
  "blur/",
  "effect/",
  "gradient/",
] as const;

let uidCounter = 0;
function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
}

function toHex(color: RGB | RGBA): string {
  const c = (v: number) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${c(color.r)}${c(color.g)}${c(color.b)}`.toUpperCase();
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function gradientAngle(t: Transform): number {
  const deg = (Math.atan2(t[0][1], t[0][0]) * 180) / Math.PI;
  return Math.round((deg + 360) % 360);
}

function mapGradient(paint: GradientPaint): GradientValue | null {
  const kind =
    paint.type === "GRADIENT_LINEAR"
      ? "linear"
      : paint.type === "GRADIENT_RADIAL"
        ? "radial"
        : paint.type === "GRADIENT_ANGULAR"
          ? "conic"
          : null;
  if (!kind || paint.gradientStops.length < 2) return null;
  const stops = paint.gradientStops.map((s) => ({
    color: toHex(s.color),
    opacity: round2(s.color.a),
    position: round2(s.position),
  }));
  return kind === "linear"
    ? { kind, angle: gradientAngle(paint.gradientTransform), stops }
    : { kind, stops };
}

function floatTokenType(name: string): "spacing" | "border-radius" | "border-width" {
  const n = name.toLowerCase();
  if (n.startsWith("radius/") || n.includes("radius")) return "border-radius";
  if (n.startsWith("border-width/") || n.includes("border-width") || n.includes("stroke")) {
    return "border-width";
  }
  return "spacing";
}

function looksLikeSystemRole(name: string): boolean {
  const n = name.toLowerCase();
  return ROLE_PREFIXES.some((p) => n.startsWith(p));
}

/** Trim Figma style/variable names; keep full slash accordion paths. */
function normalizeSlashName(raw: string): string {
  return raw
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join("/");
}

function tokenRoleName(token: StyleSnapToken): string {
  return normalizeSlashName(token.context?.authoredName ?? token.name ?? "");
}

function baseFields(
  name: string,
  source: string,
  captureId: string,
): Pick<
  StyleSnapToken,
  "id" | "captureId" | "source" | "name" | "occurrences" | "merged" | "context"
> {
  const path = normalizeSlashName(name);
  const context: TokenContext = { authoredName: path };
  return {
    id: uid("fig"),
    captureId,
    source,
    name: path,
    occurrences: 1,
    merged: false,
    context,
  };
}

function isAlias(v: VariableValue): v is VariableAlias {
  return typeof v === "object" && v !== null && "type" in v && v.type === "VARIABLE_ALIAS";
}

async function resolveVariableConcrete(
  variable: Variable,
  modeId: string,
  depth = 0,
): Promise<{ resolvedType: "COLOR" | "FLOAT"; value: RGBA | number } | null> {
  if (depth > 12) return null;
  const raw = variable.valuesByMode[modeId];
  if (raw === undefined) return null;

  if (isAlias(raw)) {
    const target = await figma.variables.getVariableByIdAsync(raw.id);
    if (!target) return null;
    const coll = await figma.variables.getVariableCollectionByIdAsync(target.variableCollectionId);
    if (!coll) return null;
    return resolveVariableConcrete(target, coll.defaultModeId, depth + 1);
  }

  if (variable.resolvedType === "COLOR" && typeof raw === "object" && "r" in raw) {
    const rgba = raw as RGB | RGBA;
    const a = "a" in rgba ? rgba.a : 1;
    return { resolvedType: "COLOR", value: { r: rgba.r, g: rgba.g, b: rgba.b, a } };
  }
  if (variable.resolvedType === "FLOAT" && typeof raw === "number") {
    return { resolvedType: "FLOAT", value: raw };
  }
  return null;
}

function valueKey(token: StyleSnapToken): string {
  switch (token.type) {
    case "color":
      return `color:${token.value.toUpperCase()}:${token.opacity}`;
    case "spacing":
    case "border-radius":
    case "border-width":
      return `${token.type}:${token.value}`;
    case "typography":
      return `typography:${JSON.stringify(token.value)}`;
    case "shadow":
      return `shadow:${JSON.stringify(token.value)}`;
    case "gradient":
      return `gradient:${JSON.stringify(token.value)}`;
  }
}

/**
 * Keep every distinct system-role path (Color / Type / Effect accordion names).
 * Drop only non-role duplicates of a value already covered by a role-named token
 * (e.g. hex primitive `color/9f6b26` when `color/feedback/warning` exists).
 */
function preferSemanticNames(tokens: StyleSnapToken[]): StyleSnapToken[] {
  const byRolePath = new Map<string, StyleSnapToken>();
  const nonRole: StyleSnapToken[] = [];

  for (const token of tokens) {
    const path = tokenRoleName(token);
    if (path && looksLikeSystemRole(path)) {
      // Same role path twice (semantic var + paint style) — keep first / higher source.
      const existing = byRolePath.get(path);
      if (!existing) {
        byRolePath.set(path, token);
      } else {
        const preferNew =
          (token.source === COLLECTION_SEMANTIC && existing.source !== COLLECTION_SEMANTIC) ||
          (token.source.endsWith("Style") && existing.source === COLLECTION_PRIMITIVES);
        if (preferNew) byRolePath.set(path, token);
      }
    } else {
      nonRole.push(token);
    }
  }

  const roleCoveredValues = new Set([...byRolePath.values()].map(valueKey));
  const keptNonRole = new Map<string, StyleSnapToken>();
  for (const token of nonRole) {
    const key = valueKey(token);
    if (roleCoveredValues.has(key)) continue; // hex/primitive duplicate of a role
    if (!keptNonRole.has(key)) keptNonRole.set(key, token);
  }

  const out = [...byRolePath.values(), ...keptNonRole.values()];
  return out.sort((a, b) => {
    const aRole = looksLikeSystemRole(tokenRoleName(a)) ? 0 : 1;
    const bRole = looksLikeSystemRole(tokenRoleName(b)) ? 0 : 1;
    if (aRole !== bRole) return aRole - bRole;
    const an = tokenRoleName(a) || a.id;
    const bn = tokenRoleName(b) || b.id;
    return an < bn ? -1 : an > bn ? 1 : 0;
  });
}

async function tokensFromCollection(
  collectionName: string,
  captureId: string,
): Promise<{ tokens: StyleSnapToken[]; found: boolean }> {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  const collection = all.find((c) => c.name === collectionName);
  if (!collection) return { tokens: [], found: false };

  const tokens: StyleSnapToken[] = [];
  const modeId = collection.defaultModeId;

  for (const id of collection.variableIds) {
    const variable = await figma.variables.getVariableByIdAsync(id);
    if (!variable || variable.remote) continue;
    const resolved = await resolveVariableConcrete(variable, modeId);
    if (!resolved) continue;

    const name = variable.name;
    const base = baseFields(name, collectionName, captureId);

    if (resolved.resolvedType === "COLOR") {
      const rgba = resolved.value as RGBA;
      tokens.push({
        ...base,
        type: "color",
        value: toHex(rgba),
        opacity: round2(rgba.a),
      });
    } else {
      const n = round2(resolved.value as number);
      const type: TokenType = floatTokenType(name);
      if (type === "spacing") tokens.push({ ...base, type: "spacing", value: n });
      else if (type === "border-radius") tokens.push({ ...base, type: "border-radius", value: n });
      else tokens.push({ ...base, type: "border-width", value: n });
    }
  }

  return { tokens, found: true };
}

async function resolveSolidPaint(paint: SolidPaint): Promise<{ hex: string; opacity: number }> {
  const alias = paint.boundVariables?.color;
  if (alias && alias.type === "VARIABLE_ALIAS") {
    const variable = await figma.variables.getVariableByIdAsync(alias.id);
    if (variable) {
      const coll = await figma.variables.getVariableCollectionByIdAsync(variable.variableCollectionId);
      if (coll) {
        const resolved = await resolveVariableConcrete(variable, coll.defaultModeId);
        if (resolved?.resolvedType === "COLOR") {
          const rgba = resolved.value as RGBA;
          return { hex: toHex(rgba), opacity: round2(rgba.a) };
        }
      }
    }
  }
  return {
    hex: toHex(paint.color),
    opacity: round2(paint.opacity ?? 1),
  };
}

async function tokensFromPaintStyles(): Promise<StyleSnapToken[]> {
  const styles = await figma.getLocalPaintStylesAsync();
  const tokens: StyleSnapToken[] = [];

  for (const style of styles) {
    const paints = style.paints.filter((p) => p.visible !== false);
    if (paints.length === 0) continue;
    const paint = paints[0];
    const base = baseFields(style.name, "Paint Style", "fig-paint-styles");

    if (paint.type === "SOLID") {
      const { hex, opacity } = await resolveSolidPaint(paint);
      tokens.push({
        ...base,
        type: "color",
        value: hex,
        opacity,
      });
    } else if (
      paint.type === "GRADIENT_LINEAR" ||
      paint.type === "GRADIENT_RADIAL" ||
      paint.type === "GRADIENT_ANGULAR"
    ) {
      const g = mapGradient(paint);
      if (g) tokens.push({ ...base, type: "gradient", value: g });
    }
  }

  return tokens;
}

function textStyleToTypography(style: TextStyle): TypographyValue | null {
  const fontName = style.fontName;
  const fontSize = style.fontSize;
  if (typeof fontSize !== "number" || fontSize <= 0) return null;

  let lineHeight = 1.2;
  const lh = style.lineHeight;
  if (lh.unit === "PERCENT") lineHeight = round2(lh.value / 100);
  else if (lh.unit === "PIXELS" && fontSize > 0) lineHeight = round2(lh.value / fontSize);
  if (lineHeight <= 0) lineHeight = 1.2;

  const value: TypographyValue = {
    fontFamily: fontName.family,
    fontSize,
    fontWeight: 400,
    lineHeight,
  };

  const styleName = fontName.style.toLowerCase();
  if (styleName.includes("thin") || styleName.includes("hairline")) value.fontWeight = 100;
  else if (styleName.includes("extralight") || styleName.includes("ultralight")) value.fontWeight = 200;
  else if (styleName.includes("light")) value.fontWeight = 300;
  else if (styleName.includes("medium")) value.fontWeight = 500;
  else if (styleName.includes("semibold") || styleName.includes("demibold")) value.fontWeight = 600;
  else if (styleName.includes("bold") && !styleName.includes("extra")) value.fontWeight = 700;
  else if (styleName.includes("extrabold") || styleName.includes("ultrabold")) value.fontWeight = 800;
  else if (styleName.includes("black") || styleName.includes("heavy")) value.fontWeight = 900;
  else if (styleName.includes("regular") || styleName.includes("normal")) value.fontWeight = 400;

  if (styleName.includes("italic")) value.fontStyle = "italic";

  const ls = style.letterSpacing;
  const px = ls.unit === "PIXELS" ? ls.value : (ls.value / 100) * fontSize;
  if (px !== 0) value.letterSpacing = round2(px);

  const tc = style.textCase;
  if (tc === "UPPER") value.textTransform = "uppercase";
  else if (tc === "LOWER") value.textTransform = "lowercase";
  else if (tc === "TITLE") value.textTransform = "capitalize";

  return value;
}

async function tokensFromTextStyles(): Promise<StyleSnapToken[]> {
  const styles = await figma.getLocalTextStylesAsync();
  const tokens: StyleSnapToken[] = [];
  for (const style of styles) {
    const value = textStyleToTypography(style);
    if (!value) continue;
    tokens.push({
      ...baseFields(style.name, "Text Style", "fig-text-styles"),
      type: "typography",
      value,
    });
  }
  return tokens;
}

function effectsToShadow(effects: readonly Effect[]): {
  kind: "drop" | "inset" | "backdrop-blur";
  layers: ShadowValue;
} | null {
  const blurs = effects.filter(
    (e) =>
      e.visible !== false && (e.type === "BACKGROUND_BLUR" || e.type === "LAYER_BLUR"),
  ) as BlurEffect[];
  const shadows = effects.filter(
    (e) =>
      e.visible !== false && (e.type === "DROP_SHADOW" || e.type === "INNER_SHADOW"),
  ) as (DropShadowEffect | InnerShadowEffect)[];

  if (blurs.length > 0 && shadows.length === 0) {
    const radius = blurs[0].radius;
    const layer: ShadowLayer = {
      inset: false,
      offsetX: 0,
      offsetY: 0,
      blur: round2(radius),
      spread: 0,
      color: "#000000",
      opacity: 0,
    };
    return { kind: "backdrop-blur", layers: [layer] };
  }

  if (shadows.length === 0) return null;

  const layers: ShadowLayer[] = shadows.map((e) => ({
    inset: e.type === "INNER_SHADOW",
    offsetX: round2(e.offset.x),
    offsetY: round2(e.offset.y),
    blur: round2(e.radius),
    spread: round2(e.spread ?? 0),
    color: toHex(e.color),
    opacity: round2(e.color.a),
  }));

  const inset = layers.some((l) => l.inset);
  return { kind: inset ? "inset" : "drop", layers };
}

async function tokensFromEffectStyles(): Promise<StyleSnapToken[]> {
  const styles = await figma.getLocalEffectStylesAsync();
  const tokens: StyleSnapToken[] = [];
  for (const style of styles) {
    const mapped = effectsToShadow(style.effects);
    if (!mapped) continue;
    const base = baseFields(style.name, "Effect Style", "fig-effect-styles");
    const context: TokenContext = {
      ...base.context,
      ...(mapped.kind === "backdrop-blur" ? { cssProperty: "backdrop-filter" as const } : {}),
    };
    tokens.push({
      ...base,
      context,
      type: "shadow",
      value: mapped.layers,
    });
  }
  return tokens;
}

export interface SystemExportResult {
  payload: StyleSnapExport | null;
  /** Soft note when StyleSnap variable collections are missing. */
  warning?: string;
}

/**
 * Dump StyleSnap variable collections + all local styles as a capture envelope.
 * Semantic role names are preferred so the web can harvest/claim system roles.
 */
export async function exportSystemToCapture(): Promise<SystemExportResult> {
  uidCounter = 0;

  // Semantic first in the raw list (and win keepScore) so role paths survive.
  const sem = await tokensFromCollection(COLLECTION_SEMANTIC, "fig-vars-semantic");
  const prim = await tokensFromCollection(COLLECTION_PRIMITIVES, "fig-vars-primitives");

  const raw: StyleSnapToken[] = [
    ...sem.tokens,
    ...prim.tokens,
    ...(await tokensFromPaintStyles()),
    ...(await tokensFromTextStyles()),
    ...(await tokensFromEffectStyles()),
  ];

  const tokens = preferSemanticNames(raw);

  let warning: string | undefined;
  if (!prim.found && !sem.found) {
    warning =
      "No StyleSnap variable collections in this file — exporting local styles only. Create from StyleSnap JSON first for Variables.";
  } else if (!sem.found) {
    warning = `Missing "${COLLECTION_SEMANTIC}" — role names may not round-trip; exported primitives/styles only.`;
  } else if (!prim.found) {
    warning = `Missing "${COLLECTION_PRIMITIVES}" — exported semantic Variables + styles.`;
  }

  if (tokens.length === 0) {
    return { payload: null, warning };
  }

  return {
    payload: {
      meta: {
        source: "figma",
        exportedAt: new Date().toISOString(),
        figmaFile: figma.root.name,
        version: "2.1",
      },
      tokens,
    },
    warning,
  };
}
