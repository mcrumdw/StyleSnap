// Merge CaptureFoundations from one or more import metas (schema 2.1).
import type { CaptureFoundations, CaptureMotionHint, StyleSnapMeta } from "../../contract/types";

function uniqueSorted(nums: number[]): number[] {
  return [...new Set(nums.filter((n) => Number.isFinite(n)))].sort((a, b) => a - b);
}

function mergeMotion(lists: CaptureMotionHint[][]): CaptureMotionHint[] {
  const seen = new Set<string>();
  const out: CaptureMotionHint[] = [];
  for (const list of lists) {
    for (const m of list) {
      const key = `${m.durationMs}|${m.easing}|${m.property ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(m);
    }
  }
  return out.slice(0, 16);
}

/** Union foundations across capture metas (import order preserved for motion). */
export function mergeCaptureFoundations(
  captures: ReadonlyArray<StyleSnapMeta>,
): CaptureFoundations | undefined {
  const breakpoints: number[] = [];
  const zIndex: number[] = [];
  const maxWidths: number[] = [];
  const motionLists: CaptureMotionHint[][] = [];
  let spacingBase: number | undefined;

  for (const meta of captures) {
    const f = meta.foundations;
    if (!f) continue;
    if (f.breakpointsPx) breakpoints.push(...f.breakpointsPx);
    if (f.zIndex) zIndex.push(...f.zIndex);
    if (f.contentMaxWidthsPx) maxWidths.push(...f.contentMaxWidthsPx);
    if (f.motion) motionLists.push(f.motion);
    if (f.spacingBasePx !== undefined && spacingBase === undefined) {
      spacingBase = f.spacingBasePx;
    }
  }

  const out: CaptureFoundations = {};
  const bp = uniqueSorted(breakpoints);
  if (bp.length) out.breakpointsPx = bp;
  const zi = uniqueSorted(zIndex);
  if (zi.length) out.zIndex = zi;
  const mw = uniqueSorted(maxWidths);
  if (mw.length) out.contentMaxWidthsPx = mw;
  const motion = mergeMotion(motionLists);
  if (motion.length) out.motion = motion;
  if (spacingBase !== undefined) out.spacingBasePx = spacingBase;

  return Object.keys(out).length > 0 ? out : undefined;
}

/** Prefill System-notes Layout / Motion from foundations when user left them empty. */
export function notesFromFoundations(foundations: CaptureFoundations | undefined): {
  layout?: string;
  motion?: string;
} {
  if (!foundations) return {};
  const layoutParts: string[] = [];
  if (foundations.contentMaxWidthsPx?.length) {
    layoutParts.push(
      `Content max-widths: ${foundations.contentMaxWidthsPx.map((n) => `${n}px`).join(", ")}.`,
    );
  }
  if (foundations.breakpointsPx?.length) {
    layoutParts.push(
      `Breakpoints: ${foundations.breakpointsPx.map((n) => `${n}px`).join(", ")}.`,
    );
  }
  if (foundations.spacingBasePx) {
    layoutParts.push(`Spacing grid ~${foundations.spacingBasePx}px.`);
  }

  const motionParts: string[] = [];
  if (foundations.motion?.length) {
    const defaults = foundations.motion
      .slice(0, 4)
      .map((m) => `${m.durationMs}ms ${m.easing}${m.property ? ` (${m.property})` : ""}`)
      .join("; ");
    motionParts.push(`Captured transitions: ${defaults}.`);
  }

  return {
    layout: layoutParts.length ? layoutParts.join(" ") : undefined,
    motion: motionParts.length ? motionParts.join(" ") : undefined,
  };
}
