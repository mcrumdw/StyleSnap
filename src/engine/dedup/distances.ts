// PRD Appendix A.2 / A.4 / A.5 — per-type distance functions.
//
// Color is a real perceptual distance (ΔEOK in OKLab, via culori). The
// discrete types (typography, shadow, gradient) map their rules onto the
// shared leader clustering with sentinel distances: DUP_D (duplicate),
// SIM_D (similar), Infinity (unrelated) against fixed thresholds.

import { differenceEuclidean } from "culori";
import type {
  ColorToken,
  GradientToken,
  ShadowToken,
  StyleSnapToken,
  TypographyToken,
  TypographyValue,
} from "../../contract/types";

// Sentinel scheme for the non-continuous types.
export const DUP_D = 0;
export const SIM_D = 0.5;
export const DUP_T = 0.25;
export const SIM_T = 0.75;

// ─────────────────────────────────────────
// A.2 Color — ΔEOK, never across differing opacity (ε 0.01)
// ─────────────────────────────────────────

const dEOK = differenceEuclidean("oklab");

export const OPACITY_EPSILON = 0.01;

export function colorDeltaEOK(hexA: string, hexB: string): number {
  return dEOK(hexA, hexB);
}

export function colorDistance(a: StyleSnapToken, b: StyleSnapToken): number {
  const ca = a as ColorToken;
  const cb = b as ColorToken;
  if (Math.abs(ca.opacity - cb.opacity) > OPACITY_EPSILON) return Infinity;
  return colorDeltaEOK(ca.value, cb.value);
}

// ─────────────────────────────────────────
// A.3 tolerance — shared by numeric clustering and the typography size rule
// ─────────────────────────────────────────

/** Hybrid absolute+relative tolerance; border-width gets a 0.5px floor. */
export function numericTol(value: number, factor: number, floor = 1): number {
  return Math.max(floor, Math.round(0.05 * factor * value));
}

/** Spacing similar floor — 2px so 8/9–style near-misses cluster (§2.62). */
export const SPACING_SIM_FLOOR = 2;

// ─────────────────────────────────────────
// A.4 Typography — normalize → composite key (incl. lineHeight)
// ─────────────────────────────────────────

interface NormalizedType {
  family: string;
  size: number;
  weight: number;
  style: string;
  letterSpacing: number;
  textTransform: string;
  lineHeight: number;
}

export function normalizeTypography(v: TypographyValue): NormalizedType {
  return {
    family: (v.fontStack?.[0] ?? v.fontFamily).toLowerCase().replace(/["']/g, "").trim(),
    size: Math.round(v.fontSize),
    weight: v.fontWeight,
    style: v.fontStyle ?? "normal",
    letterSpacing: v.letterSpacing ?? 0,
    textTransform: v.textTransform ?? "none",
    lineHeight: Math.round(v.lineHeight * 20) / 20, // 0.05 steps: 1.4999 ≡ 1.5
  };
}

export function typographyDupKey(v: TypographyValue): string {
  const n = normalizeTypography(v);
  return [n.family, n.size, n.weight, n.style, n.letterSpacing, n.textTransform, n.lineHeight].join("|");
}

export function typographyDistance(factor: number) {
  return (a: StyleSnapToken, b: StyleSnapToken): number => {
    const na = normalizeTypography((a as TypographyToken).value);
    const nb = normalizeTypography((b as TypographyToken).value);

    const sameApartFromSizeAndLineHeight =
      na.family === nb.family &&
      na.weight === nb.weight &&
      na.style === nb.style &&
      na.letterSpacing === nb.letterSpacing &&
      na.textTransform === nb.textTransform;

    if (!sameApartFromSizeAndLineHeight) return Infinity;

    const sameSize = na.size === nb.size;
    const sameLineHeight = na.lineHeight === nb.lineHeight;

    // Identical composite key ⇒ duplicate.
    if (sameSize && sameLineHeight) return DUP_D;
    // Identical key except lineHeight ⇒ similar, never auto-merged (the
    // merge dialog surfaces the conflict — "suggestive, never destructive").
    if (sameSize) return SIM_D;
    // Same face, size within tol ⇒ similar (reveals a type scale). A tracked
    // uppercase label never lands here: letterSpacing/textTransform gate above.
    if (sameLineHeight && Math.abs(na.size - nb.size) <= numericTol(Math.max(na.size, nb.size), factor)) {
      return SIM_D;
    }
    return Infinity;
  };
}

// ─────────────────────────────────────────
// A.5 Shadow — per-layer field epsilons
// ─────────────────────────────────────────

export function shadowDistance(factor: number) {
  return (a: StyleSnapToken, b: StyleSnapToken): number => {
    const la = (a as ShadowToken).value;
    const lb = (b as ShadowToken).value;
    if (la.length !== lb.length) return Infinity;

    let dup = true;
    let sim = true;
    for (let i = 0; i < la.length; i++) {
      const x = la[i];
      const y = lb[i];
      if (x.inset !== y.inset) return Infinity; // inset pattern must match
      const geometry = Math.max(
        Math.abs(x.offsetX - y.offsetX),
        Math.abs(x.offsetY - y.offsetY),
        Math.abs(x.blur - y.blur),
        Math.abs(x.spread - y.spread),
      );
      const color = colorDeltaEOK(x.color, y.color);
      const opacity = Math.abs(x.opacity - y.opacity);
      if (!(geometry <= 1 * factor && color <= 0.02 * factor && opacity <= 0.02 * factor)) dup = false;
      if (!(geometry <= 2 * factor && color <= 0.05 * factor && opacity <= 0.05 * factor)) sim = false;
    }
    return dup ? DUP_D : sim ? SIM_D : Infinity;
  };
}

// ─────────────────────────────────────────
// A.5 Gradient — conservative: duplicate or nothing (manual review otherwise)
// ─────────────────────────────────────────

export function gradientDistance(factor: number) {
  return (a: StyleSnapToken, b: StyleSnapToken): number => {
    const ga = (a as GradientToken).value;
    const gb = (b as GradientToken).value;
    if (ga.kind !== gb.kind || ga.stops.length !== gb.stops.length) return Infinity;
    if (ga.kind === "linear" && Math.abs((ga.angle ?? 180) - (gb.angle ?? 180)) > 3 * factor) {
      return Infinity;
    }
    for (let i = 0; i < ga.stops.length; i++) {
      const x = ga.stops[i];
      const y = gb.stops[i];
      if (
        colorDeltaEOK(x.color, y.color) > 0.02 * factor ||
        Math.abs(x.position - y.position) > 0.02 * factor ||
        Math.abs(x.opacity - y.opacity) > OPACITY_EPSILON
      ) {
        return Infinity;
      }
    }
    return DUP_D;
  };
}
