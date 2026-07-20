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

/** When several radii were captured, map them onto sm/md/lg instead of leaving orphans. */
export function radiusSlotPlan(
  captured: Array<{ id: string; value: number }>,
): Array<{ role: string; value: number; tokenId?: string; method: string }> {
  const byValue = new Map<number, { id: string; value: number }>();
  for (const t of captured) {
    const prev = byValue.get(t.value);
    if (!prev || t.id < prev.id) byValue.set(t.value, t);
  }
  const unique = [...byValue.values()].sort((a, b) => a.value - b.value || (a.id < b.id ? -1 : 1));

  if (unique.length === 0) return [];
  if (unique.length === 1) {
    return deriveRadiusRamp(unique[0].value).map(({ role, value }) => ({
      role,
      value,
      tokenId: value === unique[0].value ? unique[0].id : undefined,
      method:
        value === unique[0].value
          ? "captured value claims the slot"
          : `radius ramp ×${value / unique[0].value}`,
    }));
  }

  const smallest = unique[0];
  const largest = unique[unique.length - 1];
  const middle = unique[Math.floor((unique.length - 1) / 2)];
  const smValue = Math.max(1, Math.round(smallest.value * 0.5));
  const smToken = captured.find((t) => t.value === smValue);

  return [
    {
      role: "radius/sm",
      value: smValue,
      tokenId: smToken?.id,
      method: smToken ? "captured value claims the slot" : `radius ramp ×0.5 from ${smallest.value}px`,
    },
    {
      role: "radius/md",
      value: smallest.value,
      tokenId: smallest.id,
      method: "captured (smaller radius)",
    },
    {
      role: "radius/lg",
      value: largest.value,
      tokenId: largest.id,
      method:
        largest.id === middle.id && unique.length > 2
          ? "captured (largest radius)"
          : unique.length === 2
            ? "captured (second radius)"
            : "captured (largest radius)",
    },
  ];
}

/** Rank a captured shadow by its largest layer geometry. */
export function shadowMagnitude(value: ShadowValue): number {
  return Math.max(...value.map((l) => l.offsetY + l.blur));
}

/**
 * Map 1–3 captured shadows onto sm/md/lg; synthesize missing steps.
 * Empty capture → no slots (§2.63): never invent elevation when the snap
 * had no drop shadows (borders/outlines often carry elevation instead).
 * `shadowStyle` biases geometry when synthesizing missing steps of a partial ramp.
 */
export function shadowSlotPlan(
  captured: Array<{ id: string; value: ShadowValue }>,
  shadowStyle: ShadowStyle = "soft",
): Array<{ role: string; value: ShadowValue; tokenId?: string; method: string }> {
  const sorted = [...captured].sort(
    (a, b) => shadowMagnitude(a.value) - shadowMagnitude(b.value) || (a.id < b.id ? -1 : 1),
  );

  if (sorted.length === 0) {
    return [];
  }

  if (sorted.length === 1) {
    const seed = sorted[0].value[0];
    const color = seed.color;
    const opacity = seed.opacity;
    const ramp = deriveShadowRamp(color, opacity, shadowStyle);
    const sm = ramp.find((s) => s.role === "shadow/sm")!;
    const lg = ramp.find((s) => s.role === "shadow/lg")!;
    return [
      { role: "shadow/sm", value: sm.value, method: `shadow ramp (sm, ${shadowStyle})` },
      {
        role: "shadow/md",
        value: sorted[0].value,
        tokenId: sorted[0].id,
        method: "captured card shadow",
      },
      { role: "shadow/lg", value: lg.value, method: `shadow ramp (lg, ${shadowStyle})` },
    ];
  }

  if (sorted.length === 2) {
    const heavy = sorted[1].value[0];
    const lg = deriveShadowRamp(heavy.color, heavy.opacity, shadowStyle).find(
      (s) => s.role === "shadow/lg",
    )!;
    return [
      {
        role: "shadow/sm",
        value: sorted[0].value,
        tokenId: sorted[0].id,
        method: "captured (lighter shadow)",
      },
      {
        role: "shadow/md",
        value: sorted[1].value,
        tokenId: sorted[1].id,
        method: "captured (heavier shadow)",
      },
      {
        role: "shadow/lg",
        value: lg.value,
        method: `shadow ramp (lg, ${shadowStyle})`,
      },
    ];
  }

  const pick = (index: number) => sorted[Math.min(index, sorted.length - 1)];
  return [
    { role: "shadow/sm", value: pick(0).value, tokenId: pick(0).id, method: "captured (smallest shadow)" },
    {
      role: "shadow/md",
      value: pick(Math.floor((sorted.length - 1) / 2)).value,
      tokenId: pick(Math.floor((sorted.length - 1) / 2)).id,
      method: "captured (mid shadow)",
    },
    { role: "shadow/lg", value: pick(sorted.length - 1).value, tokenId: pick(sorted.length - 1).id, method: "captured (largest shadow)" },
  ];
}

/** C.7 shadow geometry ramp; color/opacity reuse the captured shadow (or ink @ 8%). */
export type ShadowStyle = "soft" | "hard" | "minimal";

export function deriveShadowRamp(
  color: string,
  opacity: number,
  style: ShadowStyle = "soft",
): Array<{ role: string; value: ShadowValue }> {
  const layer = (offsetY: number, blur: number, spread: number): ShadowValue => [
    { inset: false, offsetX: 0, offsetY, blur, spread, color, opacity },
  ];
  if (style === "hard") {
    return [
      { role: "shadow/sm", value: layer(2, 0, 0) },
      { role: "shadow/md", value: layer(4, 0, 0) },
      { role: "shadow/lg", value: layer(6, 0, 0) },
    ];
  }
  if (style === "minimal") {
    const faint = Math.min(opacity, 0.06);
    return [
      { role: "shadow/sm", value: layer(1, 2, 0) },
      { role: "shadow/md", value: layer(2, 4, 0) },
      { role: "shadow/lg", value: layer(4, 8, -1) },
    ].map(({ role, value }) => ({
      role,
      value: value.map((l) => ({ ...l, opacity: faint })),
    }));
  }
  return [
    { role: "shadow/sm", value: layer(1, 2, 0) },
    { role: "shadow/md", value: layer(4, 8, -2) },
    { role: "shadow/lg", value: layer(12, 24, -4) },
  ];
}
