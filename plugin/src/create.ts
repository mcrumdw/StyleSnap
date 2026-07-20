// StyleSnap — asset creation (Task 5 / §2.66).
// Prefer figmaHandoff (two-tier Variables + Styles). Fall back to legacy
// flat mapping when the JSON has no handoff block.

import type {
  StyleSnapExport,
  GradientValue,
  TypographyValue,
  ShadowValue,
} from "../../docs/types";
import type { FigmaHandoff } from "../../docs/figma-handoff";

export interface CreateResult {
  created: number;
  skipped: number;
  errors: string[];
  /** Soft warning when importing pre-handoff JSON. */
  warning?: string;
}

const COLLECTION_PRIMITIVES = "StyleSnap / Primitives";
const COLLECTION_SEMANTIC = "StyleSnap / Semantic";
/** Legacy single collection — still used by fallback path. */
const VARIABLE_COLLECTION_LEGACY = "StyleSnap";

function sanitizeVariableName(name: string): string {
  return name.replace(/\./g, "-");
}

function hexToRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function hexToRgba(hex: string, opacity: number): RGBA {
  return { ...hexToRgb(hex), a: opacity };
}

function gradientPaint(g: GradientValue): GradientPaint {
  const type =
    g.kind === "linear"
      ? "GRADIENT_LINEAR"
      : g.kind === "radial"
        ? "GRADIENT_RADIAL"
        : "GRADIENT_ANGULAR";

  const rad = ((g.angle ?? 0) * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const gradientTransform: Transform = [
    [cos, sin, 0.5 - 0.5 * cos - 0.5 * sin],
    [-sin, cos, 0.5 + 0.5 * sin - 0.5 * cos],
  ];

  return {
    type,
    gradientTransform,
    gradientStops: g.stops.map((s) => ({
      position: s.position,
      color: { ...hexToRgb(s.color), a: s.opacity },
    })),
  };
}

const WEIGHT_STYLES: Record<number, string[]> = {
  100: ["Thin", "Hairline"],
  200: ["ExtraLight", "Extra Light", "UltraLight"],
  300: ["Light"],
  400: ["Regular", "Normal"],
  500: ["Medium"],
  600: ["SemiBold", "Semi Bold", "DemiBold"],
  700: ["Bold"],
  800: ["ExtraBold", "Extra Bold", "UltraBold"],
  900: ["Black", "Heavy"],
};

async function loadFont(t: TypographyValue): Promise<FontName | null> {
  const candidates = (WEIGHT_STYLES[t.fontWeight] ?? ["Regular"]).slice();
  if (t.fontStyle === "italic") {
    const italics = candidates.map((c) => (c === "Regular" ? "Italic" : `${c} Italic`));
    candidates.splice(0, candidates.length, ...italics);
  }
  for (const style of candidates) {
    const fontName: FontName = { family: t.fontFamily, style };
    try {
      await figma.loadFontAsync(fontName);
      return fontName;
    } catch {
      // try next
    }
  }
  return null;
}

async function applyTextStyle(style: TextStyle, value: TypographyValue): Promise<string | null> {
  const fontName = await loadFont(value);
  if (!fontName) {
    return `font "${value.fontFamily}" (weight ${value.fontWeight}) is not available in Figma`;
  }
  style.fontName = fontName;
  style.fontSize = value.fontSize;
  style.lineHeight = { unit: "PERCENT", value: value.lineHeight * 100 };
  if (value.letterSpacing !== undefined) {
    style.letterSpacing = { unit: "PIXELS", value: value.letterSpacing };
  }
  if (value.textTransform && value.textTransform !== "none") {
    style.textCase =
      value.textTransform === "uppercase"
        ? "UPPER"
        : value.textTransform === "lowercase"
          ? "LOWER"
          : "TITLE";
  }
  return null;
}

function shadowLayersToEffects(layers: ShadowValue, inset: boolean): Effect[] {
  return layers.map((l) => ({
    type: inset || l.inset ? "INNER_SHADOW" : "DROP_SHADOW",
    color: hexToRgba(l.color, l.opacity),
    offset: { x: l.offsetX, y: l.offsetY },
    radius: l.blur,
    spread: l.spread,
    visible: true,
    blendMode: "NORMAL",
  }));
}

async function ensureNamedCollection(
  name: string,
  existingNames: Set<string>,
): Promise<VariableCollection> {
  const all = await figma.variables.getLocalVariableCollectionsAsync();
  let collection = all.find((c) => c.name === name) ?? null;
  if (collection) {
    for (const id of collection.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id);
      if (v) existingNames.add(v.name);
    }
  } else {
    collection = figma.variables.createVariableCollection(name);
  }
  return collection;
}

/** Prefer figmaHandoff when present; otherwise legacy flat create. */
export async function createAssets(
  data: StyleSnapExport,
  handoff?: FigmaHandoff | null,
): Promise<CreateResult> {
  if (handoff && handoff.version === "1.0") {
    return createFromHandoff(handoff);
  }
  const legacy = await createLegacy(data);
  legacy.warning =
    "JSON has no figmaHandoff — using legacy import. Re-export from the latest StyleSnap web app for Variables + Styles two-tier.";
  return legacy;
}

async function createFromHandoff(handoff: FigmaHandoff): Promise<CreateResult> {
  const result: CreateResult = { created: 0, skipped: 0, errors: [] };

  const existingPaintNames = new Set(
    (await figma.getLocalPaintStylesAsync()).map((s) => s.name),
  );
  const existingTextNames = new Set(
    (await figma.getLocalTextStylesAsync()).map((s) => s.name),
  );
  const existingEffectNames = new Set(
    (await figma.getLocalEffectStylesAsync()).map((s) => s.name),
  );

  const primNames = new Set<string>();
  const semNames = new Set<string>();
  const primColl = await ensureNamedCollection(COLLECTION_PRIMITIVES, primNames);
  const semColl = await ensureNamedCollection(COLLECTION_SEMANTIC, semNames);

  const primByName = new Map<string, Variable>();

  // Pass 1 — primitives
  for (const entry of handoff.collections.primitives) {
    const name = sanitizeVariableName(entry.name);
    if (primNames.has(name)) {
      result.skipped++;
      continue;
    }
    try {
      const variable = figma.variables.createVariable(name, primColl, entry.type);
      if (entry.type === "COLOR" && typeof entry.value === "string") {
        variable.setValueForMode(
          primColl.defaultModeId,
          hexToRgba(entry.value, entry.opacity ?? 1),
        );
      } else if (entry.type === "FLOAT" && typeof entry.value === "number") {
        variable.setValueForMode(primColl.defaultModeId, entry.value);
      }
      primNames.add(name);
      primByName.set(entry.name, variable);
      primByName.set(name, variable);
      result.created++;
    } catch (e) {
      result.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Resolve existing primitives (skipped) into the name map for aliasing.
  for (const entry of handoff.collections.primitives) {
    if (primByName.has(entry.name)) continue;
    const name = sanitizeVariableName(entry.name);
    for (const id of primColl.variableIds) {
      const v = await figma.variables.getVariableByIdAsync(id);
      if (v && v.name === name) {
        primByName.set(entry.name, v);
        primByName.set(name, v);
        break;
      }
    }
  }

  const semByName = new Map<string, Variable>();

  // Pass 2 — semantic aliases
  for (const entry of handoff.collections.semantic) {
    const name = sanitizeVariableName(entry.name);
    if (semNames.has(name)) {
      for (const id of semColl.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (v && v.name === name) {
          semByName.set(entry.name, v);
          semByName.set(name, v);
          break;
        }
      }
      result.skipped++;
      continue;
    }
    const target =
      primByName.get(entry.aliasOf) ?? primByName.get(sanitizeVariableName(entry.aliasOf));
    if (!target) {
      result.errors.push(`${name}: missing primitive alias target "${entry.aliasOf}"`);
      continue;
    }
    try {
      const variable = figma.variables.createVariable(name, semColl, entry.type);
      variable.setValueForMode(
        semColl.defaultModeId,
        figma.variables.createVariableAlias(target),
      );
      semNames.add(name);
      semByName.set(entry.name, variable);
      semByName.set(name, variable);
      result.created++;
    } catch (e) {
      result.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Paint styles
  for (const entry of handoff.styles.paint) {
    if (existingPaintNames.has(entry.name)) {
      result.skipped++;
      continue;
    }
    try {
      const style = figma.createPaintStyle();
      style.name = entry.name;
      if (entry.kind === "gradient") {
        style.paints = [gradientPaint(entry.value)];
      } else {
        const bindName = entry.bindVariableName
          ? sanitizeVariableName(entry.bindVariableName)
          : undefined;
        const bindVar =
          (bindName ? semByName.get(entry.bindVariableName!) ?? semByName.get(bindName) : undefined) ??
          undefined;
        let paint: SolidPaint = {
          type: "SOLID",
          color: hexToRgb(entry.hex ?? "#000000"),
          opacity: entry.opacity ?? 1,
        };
        if (bindVar) {
          paint = figma.variables.setBoundVariableForPaint(paint, "color", bindVar);
        }
        style.paints = [paint];
      }
      existingPaintNames.add(entry.name);
      result.created++;
    } catch (e) {
      result.errors.push(`${entry.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Text styles
  for (const entry of handoff.styles.text) {
    if (existingTextNames.has(entry.name)) {
      result.skipped++;
      continue;
    }
    try {
      const style = figma.createTextStyle();
      style.name = entry.name;
      const err = await applyTextStyle(style, entry.value);
      if (err) {
        result.errors.push(`${entry.name}: ${err}`);
        continue;
      }
      existingTextNames.add(entry.name);
      result.created++;
    } catch (e) {
      result.errors.push(`${entry.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // Effect styles
  for (const entry of handoff.styles.effect) {
    if (existingEffectNames.has(entry.name)) {
      result.skipped++;
      continue;
    }
    try {
      const style = figma.createEffectStyle();
      style.name = entry.name;
      if (entry.kind === "backdrop-blur") {
        style.effects = [
          {
            type: "BACKGROUND_BLUR",
            blurType: "NORMAL",
            radius: entry.blurPx ?? 12,
            visible: true,
          },
        ];
      } else {
        style.effects = shadowLayersToEffects(entry.layers, entry.kind === "inset");
      }
      existingEffectNames.add(entry.name);
      result.created++;
    } catch (e) {
      result.errors.push(`${entry.name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

/** Pre-§2.66 path: colors → paint styles, numbers → one collection. */
async function createLegacy(data: StyleSnapExport): Promise<CreateResult> {
  const result: CreateResult = { created: 0, skipped: 0, errors: [] };

  const existingPaintNames = new Set(
    (await figma.getLocalPaintStylesAsync()).map((s) => s.name),
  );
  const existingTextNames = new Set(
    (await figma.getLocalTextStylesAsync()).map((s) => s.name),
  );

  let collection: VariableCollection | null = null;
  const existingVariableNames = new Set<string>();

  async function ensureCollection(): Promise<VariableCollection> {
    if (collection) return collection;
    const all = await figma.variables.getLocalVariableCollectionsAsync();
    collection = all.find((c) => c.name === VARIABLE_COLLECTION_LEGACY) ?? null;
    if (collection) {
      for (const id of collection.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (v) existingVariableNames.add(v.name);
      }
    } else {
      collection = figma.variables.createVariableCollection(VARIABLE_COLLECTION_LEGACY);
    }
    return collection;
  }

  for (const token of data.tokens) {
    if (token.name === null) {
      result.skipped++;
      continue;
    }
    const name = token.name;

    try {
      switch (token.type) {
        case "color": {
          if (existingPaintNames.has(name)) {
            result.skipped++;
            break;
          }
          const style = figma.createPaintStyle();
          style.name = name;
          style.paints = [
            { type: "SOLID", color: hexToRgb(token.value), opacity: token.opacity },
          ];
          existingPaintNames.add(name);
          result.created++;
          break;
        }

        case "gradient": {
          if (existingPaintNames.has(name)) {
            result.skipped++;
            break;
          }
          const style = figma.createPaintStyle();
          style.name = name;
          style.paints = [gradientPaint(token.value)];
          existingPaintNames.add(name);
          result.created++;
          break;
        }

        case "typography": {
          if (existingTextNames.has(name)) {
            result.skipped++;
            break;
          }
          const style = figma.createTextStyle();
          style.name = name;
          const err = await applyTextStyle(style, token.value);
          if (err) {
            result.errors.push(`${name}: ${err}`);
            break;
          }
          existingTextNames.add(name);
          result.created++;
          break;
        }

        case "spacing":
        case "border-radius":
        case "border-width": {
          const coll = await ensureCollection();
          const variableName = sanitizeVariableName(name);
          if (existingVariableNames.has(variableName)) {
            result.skipped++;
            break;
          }
          const variable = figma.variables.createVariable(variableName, coll, "FLOAT");
          variable.setValueForMode(coll.defaultModeId, token.value);
          existingVariableNames.add(variableName);
          result.created++;
          break;
        }

        case "shadow":
          result.skipped++;
          break;
      }
    } catch (e) {
      result.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}

/** Pull optional figmaHandoff from raw import JSON (envelope ignores it). */
export function readFigmaHandoff(raw: unknown): FigmaHandoff | null {
  if (!raw || typeof raw !== "object") return null;
  const handoff = (raw as { figmaHandoff?: unknown }).figmaHandoff;
  if (!handoff || typeof handoff !== "object") return null;
  const v = (handoff as { version?: unknown }).version;
  if (v !== "1.0") return null;
  return handoff as FigmaHandoff;
}
