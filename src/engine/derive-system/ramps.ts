// Phase 10a — foundation ramps (PRD Appendix C.7). Geometric spacing ramp on
// the 4px grid, radius ×0.5/×1/×2, shadow geometry ramp reusing the captured
// shadow color. Captured values claim their slot; only empty slots derive.

import type { ShadowValue } from "../../contract/types";

const snap4 = (v: number) => Math.max(4, Math.round(v / 4) * 4);

/** space/xs … space/2xl values from the base: b/2, b, b×1.5, b×2, b×3, b×4. */
export function deriveSpacingRamp(base: number): Array<{ role: string; value: number }> {
  const multipliers = [0.5, 1, 1.5, 2, 3, 4];
  const slots = ["space/xs", "space/sm", "space/md", "space/lg", "space/xl", "space/2xl"];
  const values: number[] = [];
  for (const m of multipliers) {
    const v = snap4(base * m);
    // The grid snap can collide (e.g. base 4 → 4,4,8…); keep the ramp strictly
    // increasing so every slot stays distinct.
    values.push(values.length > 0 && v <= values[values.length - 1] ? values[values.length - 1] + 4 : v);
  }
  return slots.map((role, i) => ({ role, value: values[i] }));
}

/** radius sm/md/lg from the captured base: ×0.5, ×1, ×2 (rounded to px). */
export function deriveRadiusRamp(base: number): Array<{ role: string; value: number }> {
  return [
    { role: "radius/sm", value: Math.max(1, Math.round(base * 0.5)) },
    { role: "radius/md", value: Math.round(base) },
    { role: "radius/lg", value: Math.round(base * 2) },
  ];
}

/** C.7 shadow geometry ramp; color/opacity reuse the captured shadow (or ink @ 8%). */
export function deriveShadowRamp(
  color: string,
  opacity: number,
): Array<{ role: string; value: ShadowValue }> {
  const layer = (offsetY: number, blur: number, spread: number): ShadowValue => [
    { inset: false, offsetX: 0, offsetY, blur, spread, color, opacity },
  ];
  return [
    { role: "shadow/sm", value: layer(1, 2, 0) },
    { role: "shadow/md", value: layer(4, 8, -2) },
    { role: "shadow/lg", value: layer(12, 24, -4) },
  ];
}
