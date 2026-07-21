// Text ↔ surface pairing — body ink must read on the page; inverse is for
// dark / brand / media fills (Roland Garros–style white-on-photo ≠ body).

import { AA_NORMAL_TEXT, contrastRatio, relativeLuminance } from "../export/accessibility";
import { oklchOf } from "./oklch";

/** Surfaces brighter than this are treated as light pages (WCAG-ish midpoint). */
export const LIGHT_SURFACE_LUMINANCE = 0.45;

export function isLightSurface(hex: string): boolean {
  return relativeLuminance(hex) >= LIGHT_SURFACE_LUMINANCE;
}

/** True when fg on bg meets AA for normal text (4.5:1). */
export function passesTextOnSurface(fgHex: string, bgHex: string): boolean {
  return contrastRatio(fgHex, bgHex) >= AA_NORMAL_TEXT;
}

/**
 * Dark / brand / contrasting section fill vs the page canvas.
 * Not the same hex as page; dark enough for inverse text, or chromatic band.
 */
export function isInverseSurfaceFill(hex: string, pageHex: string): boolean {
  if (hex.toUpperCase() === pageHex.toUpperCase()) return false;
  if (!isLightSurface(hex)) return true;
  const pageL = relativeLuminance(pageHex);
  const fillL = relativeLuminance(hex);
  if (fillL < pageL - 0.12 && passesTextOnSurface("#FFFFFF", hex)) return true;
  const { c } = oklchOf(hex);
  if (c >= 0.06 && fillL < pageL - 0.08 && passesTextOnSurface("#FFFFFF", hex)) return true;
  return false;
}

/**
 * Prefer a captured color that passes AA on the page surface.
 * Candidates are already ranked (authored-name / context / frequency).
 */
export function firstReadableOnSurface<T extends { value: string; opacity: number }>(
  candidates: readonly T[],
  surfaceHex: string,
): T | undefined {
  for (const token of candidates) {
    if (token.opacity < 0.5) continue;
    if (passesTextOnSurface(token.value, surfaceHex)) return token;
  }
  return undefined;
}

/**
 * Prefer a captured near-white / light ink that fails as body on a light page —
 * typical on-media / on-brand text.
 */
export function firstInverseCandidate<T extends { value: string; opacity: number }>(
  candidates: readonly T[],
  surfaceHex: string,
): T | undefined {
  if (!isLightSurface(surfaceHex)) {
    // Dark page → inverse is dark ink that fails on the dark page.
    for (const token of candidates) {
      if (token.opacity < 0.5) continue;
      if (!passesTextOnSurface(token.value, surfaceHex) && relativeLuminance(token.value) < 0.4) {
        return token;
      }
    }
    return undefined;
  }
  for (const token of candidates) {
    if (token.opacity < 0.5) continue;
    if (relativeLuminance(token.value) >= 0.75) return token;
  }
  return undefined;
}

/** Formula defaults when nothing captured fits. */
export function defaultInkForSurface(surfaceHex: string, neutralInk: string): string {
  return isLightSurface(surfaceHex) ? neutralInk : "#FFFFFF";
}

export function defaultInverseForSurface(surfaceHex: string, neutralInk: string): string {
  return isLightSurface(surfaceHex) ? "#FFFFFF" : neutralInk;
}

/**
 * Prefer captured inverse-surface fills (section bands), ranked candidates first.
 */
export function firstInverseSurfaceCandidate<T extends { value: string; opacity: number }>(
  candidates: readonly T[],
  pageHex: string,
): T | undefined {
  for (const token of candidates) {
    if (token.opacity < 0.5) continue;
    if (isInverseSurfaceFill(token.value, pageHex)) return token;
  }
  return undefined;
}
