// Page-level foundations scan (schema 2.1) — breakpoints, motion, z-index,
// content max-widths, spacing base. Also samples the page background as a
// color token so surface/page can seed from Scan (§2.72).

import type {
  CaptureFoundations,
  CaptureMotionHint,
  ColorToken,
  StyleSnapToken,
} from "../shared/types";

function uniqueSorted(nums: number[]): number[] {
  return [...new Set(nums.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

function collectBreakpoints(): number[] {
  const found: number[] = [];
  const re = /\((?:min|max)-width:\s*([\d.]+)(px|em|rem)\)/gi;
  try {
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      for (const rule of Array.from(rules)) {
        if (!(rule instanceof CSSMediaRule)) continue;
        let m: RegExpExecArray | null;
        const media = rule.media.mediaText;
        re.lastIndex = 0;
        while ((m = re.exec(media))) {
          let px = parseFloat(m[1]);
          if (m[2] === "em" || m[2] === "rem") px *= 16;
          if (px >= 320 && px <= 4000) found.push(Math.round(px));
        }
      }
    }
  } catch {
    /* ignore */
  }
  return uniqueSorted(found);
}

function collectMotion(): CaptureMotionHint[] {
  const hints: CaptureMotionHint[] = [];
  const seen = new Set<string>();
  const push = (durationMs: number, easing: string, property?: string) => {
    if (!Number.isFinite(durationMs) || durationMs <= 0) return;
    const key = `${durationMs}|${easing}|${property ?? ""}`;
    if (seen.has(key)) return;
    seen.add(key);
    hints.push({ durationMs: Math.round(durationMs), easing, property });
  };

  const walk = (el: Element) => {
    const cs = getComputedStyle(el);
    const dur = cs.transitionDuration?.split(",")[0]?.trim() ?? "0s";
    const ease = cs.transitionTimingFunction?.split(",")[0]?.trim() ?? "ease";
    const prop = cs.transitionProperty?.split(",")[0]?.trim();
    let ms = 0;
    if (dur.endsWith("ms")) ms = parseFloat(dur);
    else if (dur.endsWith("s")) ms = parseFloat(dur) * 1000;
    if (ms > 0 && prop && prop !== "none") {
      push(ms, ease || "ease", prop === "all" ? undefined : prop);
    }
  };

  // Sample interactive + landmark elements — not the whole DOM.
  const sample = document.querySelectorAll(
    "button, a, input, [role='button'], .card, [class*='btn'], main, header, nav",
  );
  sample.forEach((el) => walk(el));
  return hints.slice(0, 12);
}

function collectZIndex(): number[] {
  const found: number[] = [];
  const sample = document.querySelectorAll(
    "header, nav, footer, dialog, [role='dialog'], [class*='modal'], [class*='toast'], [class*='dropdown'], [style*='z-index']",
  );
  sample.forEach((el) => {
    const z = getComputedStyle(el).zIndex;
    if (z && z !== "auto") {
      const n = parseInt(z, 10);
      if (Number.isFinite(n) && n !== 0) found.push(n);
    }
  });
  return uniqueSorted(found).slice(0, 16);
}

function collectMaxWidths(): number[] {
  const found: number[] = [];
  const sample = document.querySelectorAll(
    "main, [class*='container'], [class*='content'], [class*='wrapper'], article, section",
  );
  sample.forEach((el) => {
    const mw = getComputedStyle(el).maxWidth;
    if (!mw || mw === "none") return;
    const n = parseFloat(mw);
    if (Number.isFinite(n) && n >= 320 && n <= 2400) found.push(Math.round(n));
  });
  return uniqueSorted(found).slice(0, 8);
}

function detectSpacingBase(): number | undefined {
  const counts = new Map<number, number>();
  const sample = document.querySelectorAll("button, a, .card, [class*='card'], main *");
  let checked = 0;
  for (const el of Array.from(sample)) {
    if (checked > 80) break;
    const cs = getComputedStyle(el);
    for (const v of [cs.paddingTop, cs.gap, cs.marginBottom]) {
      const n = parseFloat(v);
      if (!Number.isFinite(n) || n <= 0) continue;
      const snapped = Math.round(n);
      if (snapped % 4 === 0 && snapped <= 96) {
        counts.set(4, (counts.get(4) ?? 0) + 1);
      } else if (snapped % 8 === 0 && snapped <= 96) {
        counts.set(8, (counts.get(8) ?? 0) + 1);
      }
      checked++;
    }
  }
  if ((counts.get(4) ?? 0) >= (counts.get(8) ?? 0) && (counts.get(4) ?? 0) >= 3) return 4;
  if ((counts.get(8) ?? 0) >= 3) return 8;
  return undefined;
}

let colorProbe: HTMLSpanElement | null = null;

/** Normalize any CSS color to hex + opacity (local — keep foundations free of extract.ts). */
function parseColor(input: string): { hex: string; opacity: number } | null {
  if (!input || input === "none" || input === "transparent") return null;
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
  if (!colorProbe) {
    colorProbe = document.createElement("span");
    colorProbe.style.display = "none";
    document.documentElement.appendChild(colorProbe);
  }
  colorProbe.style.color = "";
  colorProbe.style.color = input;
  const computed = getComputedStyle(colorProbe).color;
  if (!computed || computed === input) return null;
  return parseColor(computed);
}

/**
 * Sample the real painted page fill — SPA roots often hold color while body
 * is transparent. Prefer the first opaque fill among scaffold candidates.
 */
export function samplePageBackground(): {
  hex: string;
  opacity: number;
  element: string;
  selector?: string;
} | null {
  const candidates: Element[] = [];
  const add = (el: Element | null | undefined) => {
    if (el && !candidates.includes(el)) candidates.push(el);
  };
  add(document.documentElement);
  add(document.body);
  add(document.querySelector("main"));
  add(document.querySelector("[role='main']"));
  for (const sel of ["#root", "#app", "#__next", "#__nuxt", "[data-reactroot]"]) {
    add(document.querySelector(sel));
  }

  for (const el of candidates) {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const bg = parseColor(cs.backgroundColor);
    if (!bg || bg.opacity < 0.5) continue;
    const tag = el.tagName.toLowerCase();
    const selector =
      el.id
        ? `#${el.id}`
        : typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/)[0]}`
          : undefined;
    return { hex: bg.hex, opacity: bg.opacity, element: tag, selector };
  }
  return null;
}

/** Color token for the scanned page background (added to the capture list). */
export function pageBackgroundToken(captureId: string, id = "ext_page_bg"): ColorToken {
  const sample = samplePageBackground();
  const hex = sample?.hex ?? "#FFFFFF";
  const opacity = sample?.opacity ?? 1;
  const element = sample?.element ?? "body";
  return {
    id,
    captureId,
    source: sample ? `${element}${sample.selector ?? ""}` : "body",
    name: null,
    occurrences: 1,
    merged: false,
    type: "color",
    value: hex,
    opacity,
    context: {
      cssProperty: "background-color",
      element,
      selector: sample?.selector,
      state: "default",
    },
  };
}

/**
 * First large dark/brand section band that differs from the page fill.
 * Feeds color/surface/inverse.
 */
export function sampleInverseSectionBackground(pageHex: string): {
  hex: string;
  opacity: number;
  element: string;
  selector?: string;
} | null {
  const page = pageHex.toUpperCase();
  const els = document.querySelectorAll(
    "section, footer, header, aside, [class*='hero'], [class*='banner'], [class*='promo']",
  );
  for (const el of Array.from(els).slice(0, 24)) {
    if (!(el instanceof HTMLElement)) continue;
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (r.width < 120 || r.height < 48) continue;
    const bg = parseColor(cs.backgroundColor);
    if (!bg || bg.opacity < 0.5) continue;
    if (bg.hex.toUpperCase() === page) continue;
    // Rough luminance: dark or mid-brand (not near-white).
    const n = parseInt(bg.hex.slice(1), 16);
    const lum =
      (0.2126 * ((n >> 16) & 0xff) +
        0.7152 * ((n >> 8) & 0xff) +
        0.0722 * (n & 0xff)) /
      255;
    if (lum >= 0.85) continue;
    const tag = el.tagName.toLowerCase();
    const selector =
      el.id
        ? `#${el.id}`
        : typeof el.className === "string" && el.className.trim()
          ? `.${el.className.trim().split(/\s+/)[0]}`
          : undefined;
    return { hex: bg.hex, opacity: bg.opacity, element: tag, selector };
  }
  return null;
}

export function inverseSurfaceToken(
  captureId: string,
  pageHex: string,
  id = "ext_inverse_surf",
): ColorToken | null {
  const sample = sampleInverseSectionBackground(pageHex);
  if (!sample) return null;
  return {
    id,
    captureId,
    source: `${sample.element}${sample.selector ?? ""}`,
    name: null,
    occurrences: 1,
    merged: false,
    type: "color",
    value: sample.hex,
    opacity: sample.opacity,
    context: {
      cssProperty: "background-color",
      element: sample.element,
      selector: sample.selector,
      state: "default",
    },
  };
}

/** Scan the current page for foundations used in design.md export. */
export function scanPageFoundations(): CaptureFoundations {
  const foundations: CaptureFoundations = {};
  const breakpointsPx = collectBreakpoints();
  if (breakpointsPx.length > 0) foundations.breakpointsPx = breakpointsPx;
  const motion = collectMotion();
  if (motion.length > 0) foundations.motion = motion;
  const zIndex = collectZIndex();
  if (zIndex.length > 0) foundations.zIndex = zIndex;
  const contentMaxWidthsPx = collectMaxWidths();
  if (contentMaxWidthsPx.length > 0) foundations.contentMaxWidthsPx = contentMaxWidthsPx;
  const spacingBasePx = detectSpacingBase();
  if (spacingBasePx !== undefined) foundations.spacingBasePx = spacingBasePx;
  return foundations;
}

/** Foundations + page / inverse surface tokens from a Scan page click. */
export function scanPageFoundationsWithSurface(): {
  foundations: CaptureFoundations;
  tokens: StyleSnapToken[];
} {
  const pageTok = pageBackgroundToken("cap-page-scan");
  const tokens: StyleSnapToken[] = [pageTok];
  const inverse = inverseSurfaceToken("cap-page-scan", pageTok.value, "ext_inverse_surf");
  if (inverse) tokens.push(inverse);
  return {
    foundations: scanPageFoundations(),
    tokens,
  };
}
