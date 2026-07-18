// Scale intelligence learned from a capture — UI insight strips + design.md.
// Pure helpers; Appendix B roles stay the only semantic vocabulary.

import type { StyleSnapToken, TypographyToken } from "../contract/types";

export interface SpacingInsight {
  /** Greatest common divisor of distinct spacing values (capped insight). */
  baseUnit: number | null;
  values: number[];
  unassigned: Array<{ value: number; occurrences: number }>;
  summary: string;
}

export interface RadiusInsight {
  profile: "sharp" | "soft" | "mixed" | "empty";
  values: number[];
  unassigned: Array<{ value: number; occurrences: number }>;
  summary: string;
}

export interface TypeInsight {
  families: string[];
  bodySize: number | null;
  ratio: number | null;
  summary: string;
}

function gcd(a: number, b: number): number {
  let x = Math.abs(Math.round(a));
  let y = Math.abs(Math.round(b));
  while (y) {
    const t = y;
    y = x % y;
    x = t;
  }
  return x;
}

function gcdOf(values: number[]): number | null {
  const ints = [...new Set(values.map((v) => Math.round(v)).filter((v) => v > 0))];
  if (ints.length === 0) return null;
  return ints.reduce((acc, v) => gcd(acc, v));
}

/** Spacing values not assigned to any space/* role. */
export function spacingInsight(
  tokens: StyleSnapToken[],
  assignments: Record<string, string> | Map<string, string>,
): SpacingInsight {
  const assignedIds = new Set<string>();
  const entries = assignments instanceof Map ? assignments.entries() : Object.entries(assignments);
  for (const [role, id] of entries) {
    if (role.startsWith("space/")) assignedIds.add(id);
  }

  const spacing = tokens.filter((t): t is StyleSnapToken & { type: "spacing"; value: number } => t.type === "spacing");
  const values = [...new Set(spacing.map((t) => t.value))].sort((a, b) => a - b);
  const baseUnit = gcdOf(values);

  const unassignedMap = new Map<number, number>();
  for (const t of spacing) {
    if (t.id.startsWith("derived_")) continue;
    if (assignedIds.has(t.id)) continue;
    unassignedMap.set(t.value, (unassignedMap.get(t.value) ?? 0) + t.occurrences);
  }
  const unassigned = [...unassignedMap.entries()]
    .map(([value, occurrences]) => ({ value, occurrences }))
    .sort((a, b) => a.value - b.value);

  const parts: string[] = [];
  if (baseUnit && baseUnit >= 2) parts.push(`Base ~${baseUnit}px`);
  if (values.length > 0) parts.push(`${values.length} distinct step${values.length === 1 ? "" : "s"}`);
  if (unassigned.length > 0) {
    const sample = unassigned
      .slice(0, 2)
      .map((u) => `${u.value}px (${u.occurrences}×)`)
      .join(", ");
    parts.push(`unassigned ${sample}${unassigned.length > 2 ? "…" : ""}`);
  }

  return {
    baseUnit,
    values,
    unassigned,
    summary: parts.length > 0 ? parts.join(" · ") : "No spacing captured yet",
  };
}

export function radiusInsight(
  tokens: StyleSnapToken[],
  assignments: Record<string, string> | Map<string, string>,
): RadiusInsight {
  const assignedIds = new Set<string>();
  const entries = assignments instanceof Map ? assignments.entries() : Object.entries(assignments);
  for (const [role, id] of entries) {
    if (role.startsWith("radius/")) assignedIds.add(id);
  }

  const radii = tokens.filter(
    (t): t is StyleSnapToken & { type: "border-radius"; value: number } => t.type === "border-radius",
  );
  const values = [...new Set(radii.map((t) => t.value))].sort((a, b) => a - b);

  let profile: RadiusInsight["profile"] = "empty";
  if (values.length > 0) {
    const max = Math.max(...values);
    const soft = values.filter((v) => v >= 12).length;
    const sharp = values.filter((v) => v <= 4).length;
    if (max >= 999 || values.some((v) => v >= 999)) profile = "soft";
    else if (soft > 0 && sharp > 0) profile = "mixed";
    else if (soft > 0 || max >= 12) profile = "soft";
    else profile = "sharp";
  }

  const unassignedMap = new Map<number, number>();
  for (const t of radii) {
    if (t.id.startsWith("derived_")) continue;
    if (assignedIds.has(t.id)) continue;
    unassignedMap.set(t.value, (unassignedMap.get(t.value) ?? 0) + t.occurrences);
  }
  const unassigned = [...unassignedMap.entries()]
    .map(([value, occurrences]) => ({ value, occurrences }))
    .sort((a, b) => a.value - b.value);

  const profileLabel =
    profile === "sharp"
      ? "Sharp corners"
      : profile === "soft"
        ? "Soft / rounded"
        : profile === "mixed"
          ? "Mixed sharp & soft"
          : "No radius captured";

  const parts = [profileLabel];
  if (unassigned.length > 0) {
    parts.push(
      `unassigned ${unassigned
        .slice(0, 2)
        .map((u) => `${u.value}px`)
        .join(", ")}`,
    );
  }

  return { profile, values, unassigned, summary: parts.join(" · ") };
}

export function typeInsight(
  tokens: StyleSnapToken[],
  bodyTypographyId: string | undefined,
  typeRatio: number | undefined,
): TypeInsight {
  const typeTokens = tokens.filter(
    (t): t is TypographyToken => t.type === "typography" && !t.id.startsWith("derived_"),
  );
  const families = [...new Set(typeTokens.map((t) => t.value.fontFamily))].sort((a, b) =>
    a.localeCompare(b),
  );
  const body = bodyTypographyId
    ? typeTokens.find((t) => t.id === bodyTypographyId)
    : typeTokens.find((t) => t.value.fontSize >= 14 && t.value.fontSize <= 18);
  const bodySize = body?.value.fontSize ?? null;
  const ratio = typeRatio ?? null;

  const parts: string[] = [];
  if (families.length === 1) parts.push(`Font: ${families[0]}`);
  else if (families.length > 1) parts.push(`${families.length} families`);
  if (bodySize) parts.push(`body ${bodySize}px`);
  if (ratio) parts.push(`scale ×${ratio}`);
  if (typeTokens.some((t) => t.value.textTransform === "uppercase")) {
    parts.push("includes tracked/uppercase labels");
  }

  return {
    families,
    bodySize,
    ratio,
    summary: parts.length > 0 ? parts.join(" · ") : "No typography captured yet",
  };
}
