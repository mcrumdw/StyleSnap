// CSS → StyleSnap token extraction (schema v2.0, token-centric).
//
// One element (one click) produces a flat list of StyleSnapToken, each tagged
// with the same captureId and a best-effort `context` object (cssProperty,
// element, ariaRole, selector, state, authoredName) so the Webtool can DERIVE
// semantic roles instead of guessing. See docs/DECISIONS.md §2.4 and
// docs/types.ts (the shared contract).

import type {
  StyleSnapToken,
  TokenContext,
  ColorToken,
  GradientToken,
  GradientStop,
  TypographyToken,
  SpacingToken,
  BorderRadiusToken,
  BorderWidthToken,
  ShadowToken,
  ShadowLayer,
} from "../shared/types";

let tokenCounter = 0;
const nextTokenId = () => `ext_${(++tokenCounter).toString().padStart(3, "0")}`;

/** A short, human-readable source label for an element, e.g. "a.btn-primary". */
export function describeSource(el: Element): string {
  const tag = el.tagName.toLowerCase();
  const id = el.id ? `#${el.id}` : "";
  const cls =
    typeof el.className === "string" && el.className.trim()
      ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".")
      : "";
  return `${tag}${id}${cls}`;
}

/** A CSS selector fragment for context.selector (best effort). */
function describeSelector(el: Element): string | undefined {
  if (el.id) return `#${el.id}`;
  if (typeof el.className === "string" && el.className.trim())
    return "." + el.className.trim().split(/\s+/)[0];
  return undefined;
}

/**
 * Best-effort authoredName from a utility class matching the CSS property —
 * the strongest role signal when present (e.g. Tailwind "bg-blue-500").
 */
function authoredNameFor(el: Element, cssProperty: string): string | undefined {
  if (typeof el.className !== "string") return undefined;
  const classes = el.className.trim().split(/\s+/);
  const prefix =
    cssProperty === "color"
      ? "text-"
      : cssProperty.startsWith("background")
        ? "bg-"
        : cssProperty.startsWith("border")
          ? "border-"
          : null;
  if (!prefix) return undefined;
  return classes.find((c) => c.startsWith(prefix) && /\d|[a-z]+-[a-z]+/.test(c));
}

// ── low-level parsing ──────────────────────────────────────────────

/** Convert any CSS color (rgb/rgba) to normalized 6-digit hex + opacity. */
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

/** Split a comma list at top level only (ignores commas inside parentheses). */
function splitTopLevel(input: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = "";
  for (const ch of input) {
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (ch === "," && depth === 0) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

/** Parse one CSS box-shadow layer. */
function parseShadowLayer(layer: string): ShadowLayer | null {
  const inset = /\binset\b/.test(layer);
  const color = parseColor(layer);
  if (!color) return null;
  const nums = layer.match(/-?\d+(\.\d+)?px/g)?.map((s) => parseFloat(s)) ?? [];
  if (nums.length < 2) return null;
  const [offsetX, offsetY, blur = 0, spread = 0] = nums;
  return {
    inset,
    offsetX,
    offsetY,
    blur: Math.max(0, blur),
    spread,
    color: color.hex,
    opacity: color.opacity,
  };
}

/** Parse a CSS linear/radial gradient into a GradientValue. */
function parseGradient(input: string): GradientToken["value"] | null {
  if (!input || input === "none") return null;
  const kind = /radial-gradient/.test(input)
    ? "radial"
    : /conic-gradient/.test(input)
      ? "conic"
      : /linear-gradient/.test(input)
        ? "linear"
        : null;
  if (!kind) return null;
  const inner = input.slice(input.indexOf("(") + 1, input.lastIndexOf(")"));
  const parts = splitTopLevel(inner);
  let angle: number | undefined;
  if (kind === "linear" && /deg/.test(parts[0])) {
    angle = parseFloat(parts[0]);
    parts.shift();
  }
  const stops: GradientStop[] = [];
  parts.forEach((p, i) => {
    const color = parseColor(p);
    if (!color) return;
    const posMatch = p.match(/([\d.]+)%/);
    const position = posMatch
      ? Number(posMatch[1]) / 100
      : i / Math.max(1, parts.length - 1);
    stops.push({ color: color.hex, opacity: color.opacity, position });
  });
  if (stops.length < 2) return null;
  return kind === "linear" ? { kind, angle, stops } : { kind, stops };
}

// ── token builders ─────────────────────────────────────────────────

function baseFields(captureId: string, source: string, context: TokenContext) {
  return {
    id: nextTokenId(),
    captureId,
    source,
    name: null,
    occurrences: 1, // single-element capture; the Webtool aggregates frequency
    merged: false,
    context,
  };
}

/**
 * Extract all meaningful tokens from one element's computed style.
 * Returns a flat StyleSnapToken[] all sharing the given captureId.
 */
export function extractTokens(el: Element, captureId: string): StyleSnapToken[] {
  const cs = getComputedStyle(el);
  const source = describeSource(el);
  const selector = describeSelector(el);
  const element = el.tagName.toLowerCase();
  const ariaRole = el.getAttribute("role") ?? undefined;
  const tokens: StyleSnapToken[] = [];

  const ctx = (cssProperty: string): TokenContext => ({
    cssProperty,
    element,
    ariaRole,
    selector,
    state: "default",
    authoredName: authoredNameFor(el, cssProperty),
  });

  // Gradient background (takes precedence over solid bg when present)
  const gradient = parseGradient(cs.backgroundImage);
  if (gradient) {
    const t: GradientToken = {
      ...baseFields(captureId, source, ctx("background-image")),
      type: "gradient",
      value: gradient,
    };
    tokens.push(t);
  }

  // Background color
  const bg = parseColor(cs.backgroundColor);
  if (bg) {
    const t: ColorToken = {
      ...baseFields(captureId, source, ctx("background-color")),
      type: "color",
      value: bg.hex,
      opacity: bg.opacity,
    };
    tokens.push(t);
  }

  // Text color (only if the element directly holds text)
  const hasText = !!el.textContent && el.textContent.trim().length > 0;
  if (hasText) {
    const fg = parseColor(cs.color);
    if (fg) {
      const t: ColorToken = {
        ...baseFields(captureId, source, ctx("color")),
        type: "color",
        value: fg.hex,
        opacity: fg.opacity,
      };
      tokens.push(t);
    }

    const t: TypographyToken = {
      ...baseFields(captureId, source, { element, ariaRole, selector }),
      type: "typography",
      value: {
        fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
        fontStack: cs.fontFamily
          .split(",")
          .map((f) => f.replace(/["']/g, "").trim())
          .filter(Boolean),
        fontSize: px(cs.fontSize) ?? 16,
        fontWeight: parseInt(cs.fontWeight, 10) || 400,
        fontStyle: cs.fontStyle === "italic" ? "italic" : "normal",
        lineHeight:
          cs.lineHeight === "normal"
            ? 1.2
            : Math.round(((px(cs.lineHeight) ?? 0) / (px(cs.fontSize) ?? 16)) * 100) /
              100,
        letterSpacing:
          cs.letterSpacing === "normal" ? undefined : px(cs.letterSpacing) ?? undefined,
        textTransform:
          cs.textTransform === "none"
            ? undefined
            : (cs.textTransform as TypographyToken["value"]["textTransform"]),
      },
    };
    tokens.push(t);
  }

  // Border color + width (only if a visible border exists)
  const bw = px(cs.borderTopWidth);
  if (bw && bw > 0 && cs.borderTopStyle !== "none") {
    const bc = parseColor(cs.borderTopColor);
    if (bc) {
      const t: ColorToken = {
        ...baseFields(captureId, source, ctx("border-color")),
        type: "color",
        value: bc.hex,
        opacity: bc.opacity,
      };
      tokens.push(t);
    }
    const t: BorderWidthToken = {
      ...baseFields(captureId, source, { ...ctx("border-width"), authoredName: undefined }),
      type: "border-width",
      value: bw,
    };
    tokens.push(t);
  }

  // Spacing — padding & gap (most token-worthy)
  const pad = px(cs.paddingTop);
  if (pad && pad > 0) {
    const t: SpacingToken = {
      ...baseFields(captureId, source, { cssProperty: "padding", element, selector }),
      type: "spacing",
      value: pad,
    };
    tokens.push(t);
  }
  const gap = px(cs.gap);
  if (gap && gap > 0) {
    const t: SpacingToken = {
      ...baseFields(captureId, source, { cssProperty: "gap", element, selector }),
      type: "spacing",
      value: gap,
    };
    tokens.push(t);
  }

  // Border radius
  const radius = px(cs.borderTopLeftRadius);
  if (radius && radius > 0) {
    const t: BorderRadiusToken = {
      ...baseFields(captureId, source, { cssProperty: "border-radius", element, selector }),
      type: "border-radius",
      value: radius,
    };
    tokens.push(t);
  }

  // Shadow (may be several stacked layers)
  if (cs.boxShadow && cs.boxShadow !== "none") {
    const layers = splitTopLevel(cs.boxShadow)
      .map(parseShadowLayer)
      .filter((l): l is ShadowLayer => l !== null);
    if (layers.length > 0) {
      const t: ShadowToken = {
        ...baseFields(captureId, source, { cssProperty: "box-shadow", element, selector }),
        type: "shadow",
        value: layers,
      };
      tokens.push(t);
    }
  }

  return tokens;
}

/** One-line preview for the inspector chip while hovering. */
export function previewLabel(el: Element): string {
  // Hover preview must not consume real ids — save/restore the counter.
  // Zeroing it (previous bug) made every subsequent capture restart at
  // ext_001, colliding across captures and silently dropping colors in the
  // webtool (Map keyed by id).
  const saved = tokenCounter;
  const tokens = extractTokens(el, "preview");
  tokenCounter = saved;
  if (tokens.length === 0) return "Nothing to grab here";
  return tokens
    .map((t) => {
      switch (t.type) {
        case "color":
          return t.value;
        case "gradient":
          return `${t.value.kind} gradient`;
        case "typography":
          return `${t.value.fontSize}px ${t.value.fontFamily} ${t.value.fontWeight}`;
        case "spacing":
          return `${t.context?.cssProperty ?? "space"} ${t.value}`;
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
