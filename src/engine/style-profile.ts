// FR-19b extension — mood family biases derivation knobs (type ratio, harmony,
// radius scale, shadow character). Captured anchors stay canonical; only empty
// derived slots feel the profile (DECISIONS §2.17).

import type { Harmony, TypeRatio } from "./derive-system";
import type { Family } from "./templates/families";

export type ShadowStyle = "soft" | "hard" | "minimal";

export interface StyleProfile {
  family: Family;
  typeRatio: TypeRatio;
  harmony: Harmony;
  /** Multiplier on derived radius ramp values (captured radii unchanged). */
  radiusScale: number;
  shadowStyle: ShadowStyle;
}

const PROFILES: Record<Family, StyleProfile> = {
  "calm-saas": {
    family: "calm-saas",
    typeRatio: 1.25,
    harmony: "analogous",
    radiusScale: 1,
    shadowStyle: "soft",
  },
  neobrutalist: {
    family: "neobrutalist",
    typeRatio: 1.2,
    harmony: "complementary",
    radiusScale: 0.75,
    shadowStyle: "hard",
  },
  editorial: {
    family: "editorial",
    typeRatio: 1.333,
    harmony: "split-complementary",
    radiusScale: 1,
    shadowStyle: "soft",
  },
  playful: {
    family: "playful",
    typeRatio: 1.25,
    harmony: "analogous",
    radiusScale: 1.2,
    shadowStyle: "soft",
  },
  technical: {
    family: "technical",
    typeRatio: 1.2,
    harmony: "complementary",
    radiusScale: 0.85,
    shadowStyle: "minimal",
  },
  "warm-friendly": {
    family: "warm-friendly",
    typeRatio: 1.25,
    harmony: "analogous",
    radiusScale: 1.15,
    shadowStyle: "soft",
  },
  luxury: {
    family: "luxury",
    typeRatio: 1.333,
    harmony: "split-complementary",
    radiusScale: 1.1,
    shadowStyle: "soft",
  },
  "fluid-motion": {
    family: "fluid-motion",
    typeRatio: 1.25,
    harmony: "analogous",
    radiusScale: 1.15,
    shadowStyle: "soft",
  },
  "trustworthy-steady": {
    family: "trustworthy-steady",
    typeRatio: 1.25,
    harmony: "analogous",
    radiusScale: 1,
    shadowStyle: "soft",
  },
  "confident-direct": {
    family: "confident-direct",
    typeRatio: 1.2,
    harmony: "complementary",
    radiusScale: 0.9,
    shadowStyle: "hard",
  },
  "expressive-maximal": {
    family: "expressive-maximal",
    typeRatio: 1.333,
    harmony: "complementary",
    radiusScale: 1.2,
    shadowStyle: "hard",
  },
  "retro-nostalgic": {
    family: "retro-nostalgic",
    typeRatio: 1.25,
    harmony: "split-complementary",
    radiusScale: 1,
    shadowStyle: "hard",
  },
};

export function styleProfileFromFamily(family: Family): StyleProfile {
  return PROFILES[family];
}

/** Scale a derived radius (px), minimum 1. */
export function scaleRadius(value: number, scale: number): number {
  return Math.max(1, Math.round(value * scale));
}
