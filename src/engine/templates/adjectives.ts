// FR-19b — adjective vocabulary for per-field snippet matching.
// User picks up to five; each snippet carries trait weights on this set.

export const ADJECTIVES = [
  "energetic",
  "calm",
  "playful",
  "serious",
  "bold",
  "minimal",
  "elegant",
  "warm",
  "technical",
  "friendly",
  "luxurious",
  "edgy",
  "smooth",
  "trustworthy",
  "confident",
  "organic",
  "expressive",
  "nostalgic",
  "refined",
] as const;

export type Adjective = (typeof ADJECTIVES)[number];

export const MAX_ADJECTIVES = 5;

/** One-liners for the picker UI. */
export const ADJECTIVE_HINTS: Record<Adjective, string> = {
  energetic: "high tempo, saturated, lively",
  calm: "quiet, unhurried, low contrast",
  playful: "rounded, bouncy, a wink in the copy",
  serious: "businesslike, restrained, no jokes",
  bold: "heavy weights, hard edges, strong statements",
  minimal: "few elements, lots of air, nothing extra",
  elegant: "refined, editorial, considered details",
  warm: "cozy hues, soft surfaces, human tone",
  technical: "precise, monospaced, engineering-flavored",
  friendly: "approachable, forgiving, plain words",
  luxurious: "rich, dark, indulgent materials",
  edgy: "unconventional, sharp, a little loud",
  smooth: "fluid motion, soft gradients, easing everywhere",
  trustworthy: "steady, conventional, no surprises",
  confident: "direct, assertive, generous scale",
  organic: "natural curves, earthy palette, hand-touched",
  expressive: "maximal color, oversized type, loud personality",
  nostalgic: "retro cues, warm grain, familiar forms",
  refined: "polished restraint, tight spacing, quiet luxury",
};

export function isAdjective(value: string): value is Adjective {
  return (ADJECTIVES as readonly string[]).includes(value);
}
