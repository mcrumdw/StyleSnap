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

const MAX_DEPTH = 6;

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

// One styled run inside a text node. getStyledTextSegments guarantees every
// field below is concrete (never figma.mixed) within a single segment.
interface TextSegment {
  characters: string;
  fontName: FontName;
  fontSize: number;
  fontWeight: number;
  lineHeight: LineHeight;
  letterSpacing: LetterSpacing;
  textCase: TextCase;
  textStyleId: string;
}

// Figma occasionally reports fontWeight 0 (e.g. some variable fonts) — not a
// valid design-token weight, which the shared schema pins to 100–900. Fall back
// to regular for anything below 100; clamp the top end.
function normalizeWeight(w: number): number {
  if (!Number.isFinite(w) || w < 100) return 400;
  return Math.min(900, Math.round(w));
}

function segmentToTypography(seg: TextSegment): TypographyValue {
  const rawSize = seg.fontSize;
  const fontSize = round2(rawSize); // Figma yields floats like 14.3999 after scaling

  // Normalize Figma lineHeight to a unitless ratio.
  const lh = seg.lineHeight;
  const lineHeight =
    lh.unit === "PERCENT"
      ? round2(lh.value / 100)
      : lh.unit === "PIXELS"
        ? round2(lh.value / rawSize)
        : 1.2; // AUTO — Figma's default is ~1.2

  const value: TypographyValue = {
    fontFamily: seg.fontName.family,
    fontSize,
    fontWeight: normalizeWeight(seg.fontWeight),
    lineHeight,
  };

  if (seg.fontName.style.toLowerCase().includes("italic")) {
    value.fontStyle = "italic";
  }

  const ls = seg.letterSpacing;
  const px = ls.unit === "PIXELS" ? ls.value : (ls.value / 100) * fontSize;
  if (px !== 0) value.letterSpacing = round2(px);

  if (seg.textCase === "UPPER") value.textTransform = "uppercase";
  else if (seg.textCase === "LOWER") value.textTransform = "lowercase";
  else if (seg.textCase === "TITLE") value.textTransform = "capitalize";

  return value;
}

// A text node can mix several styles (e.g. bold words inside a paragraph).
// Split it into distinct styled runs so each real text style becomes its own
// token, instead of skipping the whole node. Runs with identical style within
// the node collapse; whitespace-only runs are ignored.
function extractTypographySegments(
  node: TextNode,
): Array<{ value: TypographyValue; styleId: string | null }> {
  const segments = node.getStyledTextSegments([
    "fontName",
    "fontSize",
    "fontWeight",
    "lineHeight",
    "letterSpacing",
    "textCase",
    "textStyleId",
  ]);

  const seen = new Map<string, { value: TypographyValue; styleId: string | null }>();
  for (const seg of segments) {
    if (seg.characters.trim() === "") continue; // skip spaces/newlines between runs
    const value = segmentToTypography(seg as TextSegment);
    const key = JSON.stringify(value);
    if (!seen.has(key)) {
      const styleId =
        typeof seg.textStyleId === "string" && seg.textStyleId !== "" ? seg.textStyleId : null;
      seen.set(key, { value, styleId });
    }
  }
  return [...seen.values()];
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

  // color + gradient from strokes — a ring/border hue lives here, not in fills
  // (e.g. a coral progress ring is an ellipse with a coloured stroke, so its
  // colour would be dropped if we only read fills).
  if ("strokes" in node && Array.isArray(node.strokes)) {
    const authoredName = await styleName("strokeStyleId" in node ? node.strokeStyleId : "");
    for (const paint of node.strokes as readonly Paint[]) {
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

  // typography — split mixed-style text into its distinct styled runs
  if (node.type === "TEXT") {
    for (const { value, styleId } of extractTypographySegments(node)) {
      out.push({
        type: "typography",
        value,
        source,
        captureId,
        authoredName: await styleName(styleId ?? ""),
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
    ];
    // With space-between, itemSpacing holds the COMPUTED gap (depends on frame
    // width, not on a design decision) — a layout artifact, not a token.
    if (node.primaryAxisAlignItems !== "SPACE_BETWEEN") {
      spacings.push(node.itemSpacing);
    }
    for (const s of spacings) {
      if (typeof s === "number" && s > 0) {
        out.push({ type: "spacing", value: round2(s), source, captureId });
      }
    }
  }

  // border-radius
  if ("cornerRadius" in node && typeof node.cornerRadius === "number" && node.cornerRadius > 0) {
    out.push({ type: "border-radius", value: round2(node.cornerRadius), source, captureId });
  }

  // border-width (only when the node actually has a visible stroke)
  if (
    "strokeWeight" in node &&
    typeof node.strokeWeight === "number" &&
    node.strokeWeight > 0 &&
    "strokes" in node &&
    (node.strokes as readonly Paint[]).some((s) => s.visible !== false)
  ) {
    out.push({ type: "border-width", value: round2(node.strokeWeight), source, captureId });
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
