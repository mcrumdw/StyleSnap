// Page-level foundations scan (schema 2.1) — breakpoints, motion, z-index,
// content max-widths, spacing base. Feeds meta.foundations → design.md.

import type { CaptureFoundations, CaptureMotionHint } from "../shared/types";

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
