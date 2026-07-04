// StyleSnap — token extraction engine (Task 2).
// Walks the current selection (max 3 levels deep), extracts all 7 token types
// and maps them to the shared transport format in docs/types.ts (v2.0).

import type {
  StyleSnapExport,
  StyleSnapToken,
  GradientValue,
  GradientStop,
  TypographyValue,
  ShadowValue,
  ShadowLayer,
  TokenContext,
} from "../../docs/types";

const MAX_DEPTH = 3;

// ── id helpers ───────────────────────────────────────────

let uidCounter = 0;
function uid(prefix: string): string {
  // Figma's sandbox has no crypto.randomUUID; timestamp + counter is unique enough.
  return `${prefix}_${Date.now().toString(36)}_${(uidCounter++).toString(36)}`;
}

// ── value helpers ────────────────────────────────────────

function toHex(color: RGB): string {
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
  // Direction of the gradient axis from the transform's first row.
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
          : null; // GRADIENT_DIAMOND has no CSS equivalent — skip
  if (!kind || paint.gradientStops.length < 2) return null;

  const stops: GradientStop[] = paint.gradientStops.map((s) => ({
    color: toHex(s.color),
    opacity: round2(s.color.a),
    position: round2(s.position),
  }));

  return kind === "linear"
    ? { kind, angle: gradientAngle(paint.gradientTransform), stops }
    : { kind, stops };
}

function mapTypography(node: TextNode): TypographyValue | null {
  // Mixed-style text (multiple fonts/sizes in one node) → skip; each range
  // would be its own token and that is out of MVP scope.
  if (
    node.fontName === figma.mixed ||
    node.fontSize === figma.mixed ||
    node.fontWeight === figma.mixed ||
    node.lineHeight === figma.mixed
  ) {
    return null;
  }

  const fontSize = node.fontSize as number;

  // Normalize Figma lineHeight to a unitless ratio.
  const lh = node.lineHeight as LineHeight;
  const lineHeight =
    lh.unit === "PERCENT"
      ? round2(lh.value / 100)
      : lh.unit === "PIXELS"
        ? round2(lh.value / fontSize)
        : 1.2; // AUTO — Figma's default is ~1.2

  const value: TypographyValue = {
    fontFamily: (node.fontName as FontName).family,
    fontSize,
    fontWeight: node.fontWeight as number,
    lineHeight,
  };

  if ((node.fontName as FontName).style.toLowerCase().includes("italic")) {
    value.fontStyle = "italic";
  }

  if (node.letterSpacing !== figma.mixed) {
    const ls = node.letterSpacing as LetterSpacing;
    const px = ls.unit === "PIXELS" ? ls.value : (ls.value / 100) * fontSize;
    if (px !== 0) value.letterSpacing = round2(px);
  }

  if (node.textCase !== figma.mixed && node.textCase !== "ORIGINAL") {
    value.textTransform =
      node.textCase === "UPPER"
        ? "uppercase"
        : node.textCase === "LOWER"
          ? "lowercase"
          : "capitalize";
  }

  return value;
}

function mapShadows(effects: readonly Effect[]): ShadowValue | null {
  const layers: ShadowLayer[] = [];
  for (const e of effects) {
    if (!e.visible) continue;
    if (e.type !== "DROP_SHADOW" && e.type !== "INNER_SHADOW") continue;
    layers.push({
      inset: e.type === "INNER_SHADOW",
      offsetX: round2(e.offset.x),
      offsetY: round2(e.offset.y),
      blur: round2(e.radius),
      spread: round2(e.spread ?? 0),
      color: toHex(e.color),
      opacity: round2(e.color.a),
    });
  }
  return layers.length > 0 ? layers : null;
}

// ── extraction ───────────────────────────────────────────

interface RawCapture {
  type: StyleSnapToken["type"];
  value: unknown;
  opacity?: number; // color only
  source: string;
  captureId: string;
  authoredName?: string;
}

async function styleName(styleId: string | typeof figma.mixed | ""): Promise<string | undefined> {
  if (typeof styleId !== "string" || styleId === "") return undefined;
  try {
    const style = await figma.getStyleByIdAsync(styleId);
    return style?.name;
  } catch {
    return undefined;
  }
}

async function captureNode(node: SceneNode, out: RawCapture[]): Promise<void> {
  const captureId = uid("cap");
  const source = node.name;

  // color + gradient from fills
  if ("fills" in node && node.fills !== figma.mixed) {
    const authoredName = await styleName("fillStyleId" in node ? node.fillStyleId : "");
    for (const paint of node.fills as readonly Paint[]) {
      if (paint.visible === false) continue;
      if (paint.type === "SOLID") {
        out.push({
          type: "color",
          value: toHex(paint.color),
          opacity: round2(paint.opacity ?? 1),
          source,
          captureId,
          authoredName,
        });
      } else if (paint.type.startsWith("GRADIENT")) {
        const g = mapGradient(paint as GradientPaint);
        if (g) out.push({ type: "gradient", value: g, source, captureId, authoredName });
      }
    }
  }

  // typography
  if (node.type === "TEXT") {
    const t = mapTypography(node);
    if (t) {
      out.push({
        type: "typography",
        value: t,
        source,
        captureId,
        authoredName: await styleName(node.textStyleId),
      });
    }
  }

  // spacing from auto-layout
  if ("layoutMode" in node && node.layoutMode !== "NONE") {
    const spacings = [
      node.paddingTop,
      node.paddingRight,
      node.paddingBottom,
      node.paddingLeft,
      node.itemSpacing,
    ];
    for (const s of spacings) {
      if (typeof s === "number" && s > 0) {
        out.push({ type: "spacing", value: s, source, captureId });
      }
    }
  }

  // border-radius
  if ("cornerRadius" in node && typeof node.cornerRadius === "number" && node.cornerRadius > 0) {
    out.push({ type: "border-radius", value: node.cornerRadius, source, captureId });
  }

  // border-width (only when the node actually has a visible stroke)
  if (
    "strokeWeight" in node &&
    typeof node.strokeWeight === "number" &&
    node.strokeWeight > 0 &&
    "strokes" in node &&
    (node.strokes as readonly Paint[]).some((s) => s.visible !== false)
  ) {
    out.push({ type: "border-width", value: node.strokeWeight, source, captureId });
  }

  // shadow
  if ("effects" in node) {
    const shadows = mapShadows(node.effects);
    if (shadows) {
      out.push({
        type: "shadow",
        value: shadows,
        source,
        captureId,
        authoredName: await styleName(node.effectStyleId),
      });
    }
  }
}

async function walk(node: SceneNode, depth: number, out: RawCapture[]): Promise<void> {
  if (!node.visible) return;
  await captureNode(node, out);
  if (depth >= MAX_DEPTH) return;
  if ("children" in node) {
    for (const child of node.children) {
      await walk(child, depth + 1, out);
    }
  }
}

// ── dedup + assembly ─────────────────────────────────────

function dedupKey(c: RawCapture): string {
  return `${c.type}:${JSON.stringify(c.value)}:${c.opacity ?? ""}`;
}

function toToken(c: RawCapture, occurrences: number): StyleSnapToken {
  const context: TokenContext | undefined = c.authoredName
    ? { authoredName: c.authoredName }
    : undefined;

  const base = {
    id: uid("fig"),
    captureId: c.captureId,
    source: c.source,
    name: null,
    occurrences,
    merged: false,
    ...(context ? { context } : {}),
  };

  switch (c.type) {
    case "color":
      return { ...base, type: "color", value: c.value as string, opacity: c.opacity ?? 1 };
    case "gradient":
      return { ...base, type: "gradient", value: c.value as GradientValue };
    case "typography":
      return { ...base, type: "typography", value: c.value as TypographyValue };
    case "spacing":
      return { ...base, type: "spacing", value: c.value as number };
    case "border-radius":
      return { ...base, type: "border-radius", value: c.value as number };
    case "border-width":
      return { ...base, type: "border-width", value: c.value as number };
    case "shadow":
      return { ...base, type: "shadow", value: c.value as ShadowValue };
  }
}

export async function extractTokens(
  selection: readonly SceneNode[],
): Promise<StyleSnapExport> {
  const captures: RawCapture[] = [];
  for (const node of selection) {
    await walk(node, 0, captures);
  }

  // Deduplicate identical value+type; first capture wins, count occurrences.
  // An authoredName from any duplicate is kept — it is the strongest signal.
  const groups = new Map<string, { first: RawCapture; count: number }>();
  for (const c of captures) {
    const key = dedupKey(c);
    const existing = groups.get(key);
    if (existing) {
      existing.count++;
      if (!existing.first.authoredName && c.authoredName) {
        existing.first.authoredName = c.authoredName;
      }
    } else {
      groups.set(key, { first: c, count: 1 });
    }
  }

  const tokens = [...groups.values()].map((g) => toToken(g.first, g.count));

  return {
    meta: {
      source: "figma",
      exportedAt: new Date().toISOString(),
      figmaFile: figma.root.name,
      version: "2.0",
    },
    tokens,
  };
}
