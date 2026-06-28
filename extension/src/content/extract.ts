// CSS → StyleSnap token extraction.
// Given a DOM element, read its computed style and map the meaningful values onto
// StyleSnapToken objects matching docs/types.ts. Capture-only: no naming, no dedupe.

import type {
  StyleSnapToken,
  ColorToken,
  TypographyToken,
  SpacingToken,
  BorderRadiusToken,
  BorderWidthToken,
  ShadowToken,
} from "../shared/types";

let counter = 0;
const nextId = () => `token_${(++counter).toString().padStart(3, "0")}`;

/** A short, human-readable source label for an element, e.g. "button.cta" or "h1". */
export function describeSource(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  return `${tag}${id}${cls}`;
}

/** Convert any CSS color (rgb/rgba) to { hex, opacity }. Returns null if transparent. */
function parseColor(input: string): { hex: string; opacity: number } | null {
  const m = input.match(
    /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)/i
  );
  if (!m) return null;
  const [r, g, b] = [m[1], m[2], m[3]].map(Number);
  const opacity = m[4] === undefined ? 1 : Number(m[4]);
  if (opacity === 0) return null; // fully transparent — nothing to grab
  const hex =
    "#" +
    [r, g, b]
      .map((n) => n.toString(16).padStart(2, "0"))
      .join("")
      .toUpperCase();
  return { hex, opacity };
}

const px = (v: string): number | null => {
  const n = parseFloat(v);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
};

function base(source: string) {
  return { id: nextId(), source, name: null, merged: false };
}

/** Parse a single CSS box-shadow into a ShadowValue. Handles the common form. */
function parseShadow(input: string) {
  if (!input || input === "none") return null;
  const color = parseColor(input);
  const nums = input.match(/-?\d+(\.\d+)?px/g)?.map((s) => parseFloat(s)) ?? [];
  if (nums.length < 2 || !color) return null;
  const [offsetX, offsetY, blur = 0, spread = 0] = nums;
  return {
    offsetX,
    offsetY,
    blur,
    spread,
    color: color.hex,
    opacity: color.opacity,
  };
}

/**
 * Extract all meaningful tokens from one element's computed style.
 * Skips defaults/transparent values so we never produce an empty/noise token.
 */
export function extractTokens(el: Element): StyleSnapToken[] {
  const cs = getComputedStyle(el);
  const source = describeSource(el);
  const tokens: StyleSnapToken[] = [];

  // Color — prefer a non-transparent background, else text color.
  const bg = parseColor(cs.backgroundColor);
  const fg = parseColor(cs.color);
  const picked = bg ?? fg;
  if (picked) {
    const t: ColorToken = {
      ...base(source),
      type: "color",
      value: picked.hex,
      opacity: picked.opacity,
    };
    tokens.push(t);
  }

  // Typography — only if the element directly holds text.
  if (el.textContent && el.textContent.trim().length > 0) {
    const t: TypographyToken = {
      ...base(source),
      type: "typography",
      value: {
        fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        fontSize: px(cs.fontSize) ?? 16,
        fontWeight: parseInt(cs.fontWeight, 10) || 400,
        lineHeight:
          cs.lineHeight === "normal"
            ? 1.2
            : Math.round(((px(cs.lineHeight) ?? 0) / (px(cs.fontSize) ?? 16)) * 100) /
              100,
      },
    };
    tokens.push(t);
  }

  // Spacing — use padding when present (most token-worthy spacing signal).
  const pad = px(cs.paddingTop);
  if (pad && pad > 0) {
    const t: SpacingToken = { ...base(source), type: "spacing", value: pad };
    tokens.push(t);
  }

  // Border radius
  const radius = px(cs.borderTopLeftRadius);
  if (radius && radius > 0) {
    const t: BorderRadiusToken = {
      ...base(source),
      type: "border-radius",
      value: radius,
    };
    tokens.push(t);
  }

  // Border width
  const bw = px(cs.borderTopWidth);
  if (bw && bw > 0 && cs.borderTopStyle !== "none") {
    const t: BorderWidthToken = {
      ...base(source),
      type: "border-width",
      value: bw,
    };
    tokens.push(t);
  }

  // Shadow
  const shadow = parseShadow(cs.boxShadow);
  if (shadow) {
    const t: ShadowToken = { ...base(source), type: "shadow", value: shadow };
    tokens.push(t);
  }

  return tokens;
}

/** One-line preview for the inspector chip while hovering. */
export function previewLabel(el: Element): string {
  const tokens = extractTokens(el);
  if (tokens.length === 0) return "Nothing to grab here";
  return tokens
    .map((t) => {
      switch (t.type) {
        case "color":
          return t.value;
        case "typography":
          return `${t.value.fontSize}px ${t.value.fontFamily} ${t.value.fontWeight}`;
        case "spacing":
          return `pad ${t.value}`;
        case "border-radius":
          return `r ${t.value}`;
        case "border-width":
          return `bw ${t.value}`;
        case "shadow":
          return "shadow";
      }
    })
    .join(" · ");
}
