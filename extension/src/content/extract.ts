// CSS → StyleSnap token extraction (schema v2.1, token-centric).
//
// One element (one click) produces a flat list of StyleSnapToken, each tagged
// with the same captureId and a best-effort `context` object (cssProperty,
// element, ariaRole, selector, state, authoredName, layout) so the Webtool can
// DERIVE semantic roles and emit coherent design.md. See docs/DECISIONS.md §2.4
// and docs/types.ts.

import type {
  StyleSnapToken,
  TokenContext,
  CaptureState,
  CaptureLayout,
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
 * Best-effort authoredName: CSS custom property used by the property, else a
 * utility class matching the CSS property (e.g. Tailwind "bg-blue-500").
 */
function authoredNameFor(
  el: Element,
  cssProperty: string,
  declared?: string | null,
): string | undefined {
  const fromVar = declared?.match(/var\(\s*(--[a-zA-Z0-9-_]+)/)?.[1];
  if (fromVar) return fromVar;

  if (typeof el.className !== "string") return undefined;
  const classes = el.className.trim().split(/\s+/);
  const prefix =
    cssProperty === "color"
      ? "text-"
      : cssProperty.startsWith("background")
        ? "bg-"
        : cssProperty.startsWith("border")
          ? "border-"
          : cssProperty.startsWith("padding")
            ? "p-"
            : cssProperty.startsWith("margin")
              ? "m-"
              : cssProperty === "gap" || cssProperty === "row-gap" || cssProperty === "column-gap"
                ? "gap-"
                : null;
  if (!prefix) return undefined;
  return classes.find((c) => c.startsWith(prefix) && /\d|[a-z]+-[a-z]+/.test(c));
}

function declaredValue(el: Element, cssProperty: string): string | null {
  if (!(el instanceof HTMLElement)) return null;
  const inline = el.style.getPropertyValue(cssProperty);
  if (inline) return inline;
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue; // cross-origin
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        try {
          if (!el.matches(rule.selectorText)) continue;
        } catch {
          continue;
        }
        const v = rule.style.getPropertyValue(cssProperty);
        if (v) return v;
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

// ── color parsing ──────────────────────────────────────────────────

let colorProbe: HTMLSpanElement | null = null;

/** Convert any CSS color to normalized 6-digit hex + opacity. */
function parseColor(input: string): { hex: string; opacity: number } | null {
  if (!input || input === "transparent" || input === "none") return null;
  const m = input.match(
    /rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+))?\s*\)/i,
  );
  if (m) {
    const [r, g, b] = [m[1], m[2], m[3]].map((n) => Math.round(Number(n)));
    const opacity = m[4] === undefined ? 1 : Number(m[4]);
    if (opacity === 0) return null;
    const hex =
      "#" +
      [r, g, b]
        .map((n) => Math.max(0, Math.min(255, n)).toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase();
    return { hex, opacity };
  }
  // Modern formats (oklch, color(srgb…), hsl, hex, named) — normalize via probe.
  if (!colorProbe) {
    colorProbe = document.createElement("span");
    colorProbe.style.display = "none";
    document.documentElement.appendChild(colorProbe);
  }
  colorProbe.style.color = "";
  colorProbe.style.color = input;
  const computed = getComputedStyle(colorProbe).color;
  if (computed === input || !computed) return null;
  return parseColor(computed);
}

const px = (v: string): number | null => {
  if (!v || v === "auto" || v === "none" || v === "normal") return null;
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

function readLayout(cs: CSSStyleDeclaration): CaptureLayout | undefined {
  const display = cs.display;
  if (!display || display === "none") return undefined;
  const layout: CaptureLayout = { display };
  if (display === "flex" || display === "inline-flex") {
    layout.flexDirection = cs.flexDirection;
    layout.justifyContent = cs.justifyContent;
    layout.alignItems = cs.alignItems;
  }
  if (display === "grid" || display === "inline-grid") {
    layout.gridTemplateColumns = cs.gridTemplateColumns;
    layout.justifyContent = cs.justifyContent;
    layout.alignItems = cs.alignItems;
  }
  const maxW = px(cs.maxWidth);
  if (maxW && maxW > 0) layout.maxWidthPx = maxW;
  const gap = px(cs.gap) ?? px(cs.rowGap);
  if (gap && gap > 0) layout.gapPx = gap;
  return layout;
}

function baseFields(
  captureId: string,
  source: string,
  context: TokenContext,
) {
  return {
    id: nextTokenId(),
    captureId,
    source,
    name: null,
    occurrences: 1,
    merged: false,
    context,
  };
}

function pushSpacing(
  tokens: StyleSnapToken[],
  captureId: string,
  source: string,
  baseCtx: Omit<TokenContext, "cssProperty" | "authoredName" | "state">,
  cssProperty: string,
  value: number | null,
  state: CaptureState,
  el: Element,
) {
  if (value === null || value === 0) return;
  // Margins may be negative in the wild — keep them; padding/gap only if > 0.
  if (!cssProperty.startsWith("margin") && value < 0) return;
  const authoredName = authoredNameFor(el, cssProperty, declaredValue(el, cssProperty));
  const t: SpacingToken = {
    ...baseFields(captureId, source, {
      ...baseCtx,
      cssProperty,
      state,
      authoredName,
    }),
    type: "spacing",
    value,
  };
  tokens.push(t);
}

function extractFromComputed(
  el: Element,
  captureId: string,
  source: string,
  cs: CSSStyleDeclaration,
  state: CaptureState,
  layout: CaptureLayout | undefined,
  tokens: StyleSnapToken[],
) {
  const selector = describeSelector(el);
  const element = el.tagName.toLowerCase();
  const ariaRole = el.getAttribute("role") ?? undefined;
  const baseCtx = { element, ariaRole, selector, layout };

  const ctx = (cssProperty: string): TokenContext => ({
    ...baseCtx,
    cssProperty,
    state,
    authoredName: authoredNameFor(el, cssProperty, declaredValue(el, cssProperty)),
  });

  const gradient = parseGradient(cs.backgroundImage);
  if (gradient && state === "default") {
    const t: GradientToken = {
      ...baseFields(captureId, source, ctx("background-image")),
      type: "gradient",
      value: gradient,
    };
    tokens.push(t);
  }

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

  const isHeading = /^h[1-6]$/.test(element);
  const hasText = !!el.textContent && el.textContent.trim().length > 0;
  if (hasText || isHeading) {
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

    if (state === "default") {
      const t: TypographyToken = {
        ...baseFields(captureId, source, { ...baseCtx, state }),
        type: "typography",
        value: {
          fontFamily: cs.fontFamily.split(",")[0].replace(/["']/g, "").trim(),
          fontStack: cs.fontFamily
            .split(",")
            .map((f) => f.replace(/["']/g, "").trim())
            .filter(Boolean),
          fontSize: Math.round(px(cs.fontSize) ?? 16),
          fontWeight: parseInt(cs.fontWeight, 10) || 400,
          fontStyle: cs.fontStyle === "italic" ? "italic" : "normal",
          lineHeight:
            cs.lineHeight === "normal"
              ? 1.2
              : Math.round(
                  ((px(cs.lineHeight) ?? 0) / (px(cs.fontSize) ?? 16)) * 100,
                ) / 100,
          letterSpacing:
            cs.letterSpacing === "normal"
              ? undefined
              : (px(cs.letterSpacing) ?? undefined),
          textTransform:
            cs.textTransform === "none"
              ? undefined
              : (cs.textTransform as TypographyToken["value"]["textTransform"]),
        },
      };
      tokens.push(t);
    }
  }

  // Outline / focus ring (especially useful for state=focus)
  const outlineW = px(cs.outlineWidth);
  if (outlineW && outlineW > 0 && cs.outlineStyle !== "none") {
    const oc = parseColor(cs.outlineColor);
    if (oc) {
      const t: ColorToken = {
        ...baseFields(captureId, source, ctx("outline-color")),
        type: "color",
        value: oc.hex,
        opacity: oc.opacity,
      };
      tokens.push(t);
    }
    const t: BorderWidthToken = {
      ...baseFields(captureId, source, {
        ...ctx("outline-width"),
        authoredName: undefined,
      }),
      type: "border-width",
      value: outlineW,
    };
    tokens.push(t);
  }

  if (state === "default") {
    const sides = ["Top", "Right", "Bottom", "Left"] as const;
    for (const side of sides) {
      const prop = `border${side}Width` as keyof CSSStyleDeclaration;
      const styleProp = `border${side}Style` as keyof CSSStyleDeclaration;
      const colorProp = `border${side}Color` as keyof CSSStyleDeclaration;
      const bw = px(String(cs[prop]));
      const style = String(cs[styleProp]);
      if (bw && bw > 0 && style !== "none") {
        const bc = parseColor(String(cs[colorProp]));
        if (bc && side === "Top") {
          const t: ColorToken = {
            ...baseFields(captureId, source, ctx("border-color")),
            type: "color",
            value: bc.hex,
            opacity: bc.opacity,
          };
          tokens.push(t);
        }
        const cssName =
          side === "Top"
            ? "border-width"
            : (`border-${side.toLowerCase()}-width` as string);
        // Deduplicate equal widths: only emit asymmetric extras
        if (side === "Top" || bw !== px(cs.borderTopWidth)) {
          const t: BorderWidthToken = {
            ...baseFields(captureId, source, {
              ...ctx(cssName),
              authoredName: undefined,
            }),
            type: "border-width",
            value: bw,
          };
          tokens.push(t);
        }
      }
    }

    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "padding-top",
      px(cs.paddingTop),
      state,
      el,
    );
    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "padding-right",
      px(cs.paddingRight),
      state,
      el,
    );
    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "padding-bottom",
      px(cs.paddingBottom),
      state,
      el,
    );
    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "padding-left",
      px(cs.paddingLeft),
      state,
      el,
    );
    // Collapse equal paddings to a single "padding" token for cleaner sketches
    const pads = [
      px(cs.paddingTop),
      px(cs.paddingRight),
      px(cs.paddingBottom),
      px(cs.paddingLeft),
    ].filter((v): v is number => v !== null && v > 0);
    if (pads.length === 4 && pads.every((v) => v === pads[0])) {
      // Remove the four side tokens we just added and emit one padding
      for (let i = tokens.length - 1; i >= 0; i--) {
        const t = tokens[i];
        if (
          t.type === "spacing" &&
          t.captureId === captureId &&
          t.context?.cssProperty?.startsWith("padding-")
        ) {
          tokens.splice(i, 1);
        }
      }
      pushSpacing(tokens, captureId, source, baseCtx, "padding", pads[0], state, el);
    }

    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "margin-top",
      px(cs.marginTop),
      state,
      el,
    );
    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "margin-right",
      px(cs.marginRight),
      state,
      el,
    );
    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "margin-bottom",
      px(cs.marginBottom),
      state,
      el,
    );
    pushSpacing(
      tokens,
      captureId,
      source,
      baseCtx,
      "margin-left",
      px(cs.marginLeft),
      state,
      el,
    );

    const rowGap = px(cs.rowGap);
    const colGap = px(cs.columnGap);
    if (rowGap && colGap && rowGap === colGap) {
      pushSpacing(tokens, captureId, source, baseCtx, "gap", rowGap, state, el);
    } else {
      pushSpacing(tokens, captureId, source, baseCtx, "row-gap", rowGap, state, el);
      pushSpacing(
        tokens,
        captureId,
        source,
        baseCtx,
        "column-gap",
        colGap,
        state,
        el,
      );
    }

    const corners = [
      px(cs.borderTopLeftRadius),
      px(cs.borderTopRightRadius),
      px(cs.borderBottomRightRadius),
      px(cs.borderBottomLeftRadius),
    ];
    const defined = corners.filter((v): v is number => v !== null && v > 0);
    if (defined.length > 0) {
      if (defined.every((v) => v === defined[0])) {
        const t: BorderRadiusToken = {
          ...baseFields(captureId, source, ctx("border-radius")),
          type: "border-radius",
          value: defined[0],
        };
        tokens.push(t);
      } else {
        const names = [
          "border-top-left-radius",
          "border-top-right-radius",
          "border-bottom-right-radius",
          "border-bottom-left-radius",
        ];
        corners.forEach((v, i) => {
          if (v && v > 0) {
            const t: BorderRadiusToken = {
              ...baseFields(captureId, source, ctx(names[i])),
              type: "border-radius",
              value: v,
            };
            tokens.push(t);
          }
        });
      }
    }

    if (cs.boxShadow && cs.boxShadow !== "none") {
      const layers = splitTopLevel(cs.boxShadow)
        .map(parseShadowLayer)
        .filter((l): l is ShadowLayer => l !== null);
      if (layers.length > 0) {
        const t: ShadowToken = {
          ...baseFields(captureId, source, ctx("box-shadow")),
          type: "shadow",
          value: layers,
        };
        tokens.push(t);
      }
    }

    if (cs.textShadow && cs.textShadow !== "none") {
      const layers = splitTopLevel(cs.textShadow)
        .map(parseShadowLayer)
        .filter((l): l is ShadowLayer => l !== null);
      if (layers.length > 0) {
        const t: ShadowToken = {
          ...baseFields(captureId, source, ctx("text-shadow")),
          type: "shadow",
          value: layers,
        };
        tokens.push(t);
      }
    }
  }
}

/** Collect :hover / :focus-visible declarations that match this element. */
function pseudoOverrides(
  el: Element,
  pseudo: "hover" | "focus-visible" | "focus",
): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  const suffix = `:${pseudo}`;
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSStyleRule)) continue;
        const sel = rule.selectorText;
        if (!sel || !sel.includes(suffix)) continue;
        const base = sel
          .split(",")
          .map((s) => s.trim())
          .filter((s) => s.endsWith(suffix))
          .map((s) => s.slice(0, -suffix.length).trim() || "*");
        let matches = false;
        for (const b of base) {
          try {
            if (el.matches(b)) {
              matches = true;
              break;
            }
          } catch {
            /* invalid selector */
          }
        }
        if (!matches) continue;
        for (const prop of [
          "background-color",
          "color",
          "border-color",
          "outline-color",
          "outline-width",
          "box-shadow",
        ]) {
          const v = rule.style.getPropertyValue(prop);
          if (v) out[prop] = v;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return out;
}

function applyOverrides(
  cs: CSSStyleDeclaration,
  overrides: Partial<Record<string, string>>,
): CSSStyleDeclaration {
  // Return a thin proxy that reads overrides first.
  return new Proxy(cs, {
    get(target, prop, receiver) {
      if (typeof prop === "string") {
        const cssKey = prop.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
        if (overrides[cssKey] !== undefined) return overrides[cssKey];
        // camelCase access like backgroundColor
        const kebab = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
        if (overrides[kebab] !== undefined) return overrides[kebab];
      }
      const value = Reflect.get(target, prop, receiver);
      return typeof value === "function" ? value.bind(target) : value;
    },
  }) as CSSStyleDeclaration;
}

/**
 * Extract all meaningful tokens from one element's computed style.
 * Includes default + best-effort hover/focus/disabled state samples.
 */
export function extractTokens(el: Element, captureId: string): StyleSnapToken[] {
  const cs = getComputedStyle(el);
  const source = describeSource(el);
  const layout = readLayout(cs);
  const tokens: StyleSnapToken[] = [];

  extractFromComputed(el, captureId, source, cs, "default", layout, tokens);

  const hover = pseudoOverrides(el, "hover");
  if (Object.keys(hover).length > 0) {
    extractFromComputed(
      el,
      captureId,
      source,
      applyOverrides(cs, hover),
      "hover",
      layout,
      tokens,
    );
  }

  const focusVisible = pseudoOverrides(el, "focus-visible");
  const focusSimple = pseudoOverrides(el, "focus");
  const focus =
    Object.keys(focusVisible).length > 0 ? focusVisible : focusSimple;
  if (Object.keys(focus).length > 0) {
    extractFromComputed(
      el,
      captureId,
      source,
      applyOverrides(cs, focus),
      "focus",
      layout,
      tokens,
    );
  } else if (el instanceof HTMLElement) {
    // Focusable: temporarily focus and read outline (then restore)
    const focusable =
      el.tabIndex >= 0 ||
      ["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT"].includes(el.tagName);
    if (focusable) {
      const prev = document.activeElement as HTMLElement | null;
      try {
        el.focus({ preventScroll: true });
        const fcs = getComputedStyle(el);
        extractFromComputed(el, captureId, source, fcs, "focus", layout, tokens);
      } catch {
        /* not focusable */
      } finally {
        prev?.focus?.({ preventScroll: true });
        if (document.activeElement === el) el.blur();
      }
    }
  }

  const disabledAttr =
    el instanceof HTMLElement &&
    (el.hasAttribute("disabled") ||
      el.getAttribute("aria-disabled") === "true" ||
      (el instanceof HTMLInputElement && el.disabled) ||
      (el instanceof HTMLButtonElement && el.disabled));
  if (disabledAttr) {
    // Control is already disabled — sample colors with state=disabled.
    extractFromComputed(el, captureId, source, cs, "disabled", layout, tokens);
  }

  return tokens;
}

/** One-line preview for the inspector chip while hovering. */
export function previewLabel(el: Element): string {
  const saved = tokenCounter;
  const tokens = extractTokens(el, "preview");
  tokenCounter = saved;
  if (tokens.length === 0) return "Nothing to grab here";
  return tokens
    .filter((t) => !t.context?.state || t.context.state === "default")
    .slice(0, 6)
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
