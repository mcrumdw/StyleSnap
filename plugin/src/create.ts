// StyleSnap — asset creation (Task 5).
// Turns a cleaned StyleSnapExport into real Figma assets:
//   color/gradient → Paint Styles, typography → Text Styles,
//   spacing/border-radius/border-width → Variables in a "StyleSnap" collection.
// Existing names are skipped, never overwritten (PRD §3 Flow 2).

import type {
  StyleSnapExport,
  StyleSnapToken,
  GradientValue,
  TypographyValue,
} from "../../docs/types";

export interface CreateResult {
  created: number;
  skipped: number; // name already existed (or token unnamed)
  errors: string[];
}

const VARIABLE_COLLECTION = "StyleSnap";

// Figma rejects "." in variable names (reserved for path syntax). The Webtool
// auto-names unreviewed primitives from their value ("space/5.59"), so
// sanitize defensively instead of failing the import.
function sanitizeVariableName(name: string): string {
  return name.replace(/\./g, "-");
}

// ── helpers ──────────────────────────────────────────────

function hexToRgb(hex: string): RGB {
  return {
    r: parseInt(hex.slice(1, 3), 16) / 255,
    g: parseInt(hex.slice(3, 5), 16) / 255,
    b: parseInt(hex.slice(5, 7), 16) / 255,
  };
}

function gradientPaint(g: GradientValue): GradientPaint {
  const type =
    g.kind === "linear"
      ? "GRADIENT_LINEAR"
      : g.kind === "radial"
        ? "GRADIENT_RADIAL"
        : "GRADIENT_ANGULAR";

  // Rotate the gradient axis around the tile center (0.5, 0.5).
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

// Figma identifies fonts by style NAME, not numeric weight. Try the usual
// names for a weight until one loads; fonts ship different subsets.
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
    // "Italic", "Bold Italic", "SemiBold Italic", …
    const italics = candidates.map((c) => (c === "Regular" ? "Italic" : `${c} Italic`));
    candidates.splice(0, candidates.length, ...italics);
  }
  for (const style of candidates) {
    const fontName: FontName = { family: t.fontFamily, style };
    try {
      await figma.loadFontAsync(fontName);
      return fontName;
    } catch {
      // try next candidate
    }
  }
  return null;
}

// ── creation ─────────────────────────────────────────────

export async function createAssets(data: StyleSnapExport): Promise<CreateResult> {
  const result: CreateResult = { created: 0, skipped: 0, errors: [] };

  const existingPaintNames = new Set(
    (await figma.getLocalPaintStylesAsync()).map((s) => s.name),
  );
  const existingTextNames = new Set(
    (await figma.getLocalTextStylesAsync()).map((s) => s.name),
  );

  // Find or create the StyleSnap variable collection.
  let collection: VariableCollection | null = null;
  const existingVariableNames = new Set<string>();

  async function ensureCollection(): Promise<VariableCollection> {
    if (collection) return collection;
    const all = await figma.variables.getLocalVariableCollectionsAsync();
    collection = all.find((c) => c.name === VARIABLE_COLLECTION) ?? null;
    if (collection) {
      for (const id of collection.variableIds) {
        const v = await figma.variables.getVariableByIdAsync(id);
        if (v) existingVariableNames.add(v.name);
      }
    } else {
      collection = figma.variables.createVariableCollection(VARIABLE_COLLECTION);
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
          const fontName = await loadFont(token.value);
          if (!fontName) {
            result.errors.push(
              `${name}: font "${token.value.fontFamily}" (weight ${token.value.fontWeight}) is not available in Figma`,
            );
            break;
          }
          const style = figma.createTextStyle();
          style.name = name;
          style.fontName = fontName;
          style.fontSize = token.value.fontSize;
          style.lineHeight = { unit: "PERCENT", value: token.value.lineHeight * 100 };
          if (token.value.letterSpacing !== undefined) {
            style.letterSpacing = { unit: "PIXELS", value: token.value.letterSpacing };
          }
          if (token.value.textTransform && token.value.textTransform !== "none") {
            style.textCase =
              token.value.textTransform === "uppercase"
                ? "UPPER"
                : token.value.textTransform === "lowercase"
                  ? "LOWER"
                  : "TITLE";
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
          // Composite value — not representable as a Variable; deferred to
          // Effect Styles in a later iteration (matches the import preview).
          result.skipped++;
          break;
      }
    } catch (e) {
      result.errors.push(`${name}: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  return result;
}
