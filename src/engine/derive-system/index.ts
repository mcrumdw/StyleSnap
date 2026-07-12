// Phase 10a — derivation-first completion (PRD FR-19 + Appendix C,
// DECISIONS §2.7). The app auto-drafts every derivable gap from three
// anchors, like solving a puzzle from its corner pieces. Pure and
// deterministic: same anchors, same output. Derived values are PROPOSALS —
// badged, provenance-marked, never overwriting a captured value or a user
// edit (precedence: captured > edited > derived, C.8).

import type {
  StyleSnapToken,
  TypographyToken,
} from "../../contract/types";
import { detectAnchors, type AnchorOverrides, type Anchors } from "./anchors";
import {
  deriveAccent,
  deriveFeedback,
  deriveLinkColor,
  deriveNeutrals,
  deriveStates,
  harmonyFromPrimary,
  tuneFillForWhiteText,
  type AccentSuggestion,
  type Harmony,
} from "./color";
import { DEFAULT_TYPE_RATIO, deriveMono, deriveTypeScale, type TypeRatio } from "./type";
import {
  deriveSpacingRamp,
  radiusSlotPlan,
  shadowSlotPlan,
  type ShadowStyle,
} from "./ramps";
import { scaleRadius, type StyleProfile } from "../style-profile";

export type { AccentSuggestion, Harmony } from "./color";
export { harmonyFromPrimary } from "./color";
export type { Anchors, AnchorOverrides } from "./anchors";
export type { TypeRatio } from "./type";
export { DEFAULT_TYPE_RATIO } from "./type";
export { styleProfileFromFamily, scaleRadius } from "../style-profile";
export type { StyleProfile, ShadowStyle as StyleShadowStyle } from "../style-profile";

export interface DeriveInput {
  /** The cluster-canonical view: confirmed merges applied, open clusters collapsed to canonicals. */
  tokens: StyleSnapToken[];
  /** Raw tokens by id — lets anchors read absorbed contexts. */
  rawById?: ReadonlyMap<string, StyleSnapToken>;
  /** Roles already filled by captured/user assignments — never derived over. */
  assignments: ReadonlyMap<string, string>;
  overrides?: AnchorOverrides;
  typeRatio?: TypeRatio;
  /** User-picked accent harmony (C.5) — updates secondary live. */
  accentHarmony?: Harmony;
  /** FR-19b style family — biases derived radius + shadow ramps. */
  styleProfile?: Pick<StyleProfile, "radiusScale" | "shadowStyle">;
}

export interface DerivedFill {
  role: string;
  /**
   * The token filling the slot: an EXISTING captured token (anchor claims,
   * method "anchor"/"captured") or a synthetic one (id `derived_…`,
   * source "derived").
   */
  token: StyleSnapToken;
  /** Anchor the value was derived from (token id or "convention"). */
  derivedFrom: string;
  /** Human-readable formula, e.g. "hover (ΔL −0.06)". */
  method: string;
}

export interface DeriveResult {
  anchors: Anchors;
  /** Fills for every role the assignments left empty, taxonomy-ordered by construction. */
  fills: DerivedFill[];
  /** C.5 — null when the capture already has a second hue. */
  accent: AccentSuggestion | null;
  derivedCount: number;
}

function syntheticColor(role: string, hex: string): StyleSnapToken {
  return {
    id: `derived_${role.replace(/\//g, "_")}`,
    captureId: "derived",
    source: "derived",
    name: null,
    occurrences: 1,
    merged: false,
    type: "color",
    value: hex,
    opacity: 1,
  };
}

export function deriveSystem(input: DeriveInput): DeriveResult {
  const { tokens, assignments } = input;
  const rawById = input.rawById ?? new Map();
  const anchors = detectAnchors(tokens, rawById, input.overrides);
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const fills: DerivedFill[] = [];
  const open = (role: string) => !assignments.has(role);
  const fill = (role: string, token: StyleSnapToken, derivedFrom: string, method: string) => {
    if (open(role)) fills.push({ role, token, derivedFrom, method });
  };

  // ── Colors (need a primary anchor) ──
  const primary = anchors.primaryColorId ? byId.get(anchors.primaryColorId) : undefined;
  let accent: AccentSuggestion | null = null;
  if (primary && primary.type === "color") {
    const from = primary.id;
    fill("color/action/primary", primary, from, "anchor (your primary color)");

    const states = deriveStates(primary.value);
    fill("color/action/primary-hover", syntheticColor("color/action/primary-hover", states.hover), from, "hover (ΔL −0.06)");
    fill("color/action/primary-active", syntheticColor("color/action/primary-active", states.active), from, "active (ΔL −0.12)");
    fill("color/border/focus", primary, from, "focus ring = primary");

    const neutrals = deriveNeutrals(primary.value);
    const linkHex = deriveLinkColor(primary.value, neutrals.surfacePage);
    if (linkHex.toLowerCase() === primary.value.toLowerCase()) {
      fill("color/text/link", primary, from, "link = brand primary");
    } else {
      fill(
        "color/text/link",
        syntheticColor("color/text/link", linkHex),
        from,
        "link (brand hue, AA-tuned for page surface)",
      );
    }

    const neutralMethod = (l: string) => `tinted neutral (brand hue, ${l})`;
    fill("color/text/primary", syntheticColor("color/text/primary", neutrals.textPrimary), from, neutralMethod("L 0.22"));
    fill("color/text/muted", syntheticColor("color/text/muted", neutrals.textMuted), from, neutralMethod("L 0.52"));
    fill("color/surface/page", syntheticColor("color/surface/page", neutrals.surfacePage), from, neutralMethod("L 0.985"));
    fill("color/surface/card", syntheticColor("color/surface/card", neutrals.surfaceCard), from, "white card surface");
    fill("color/border/default", syntheticColor("color/border/default", neutrals.border), from, neutralMethod("L 0.90"));

    const feedback = deriveFeedback(primary.value);
    for (const key of ["success", "warning", "error", "info"] as const) {
      fill(
        `color/feedback/${key}`,
        syntheticColor(`color/feedback/${key}`, feedback[key]),
        from,
        `feedback ${key} (conventional hue, brand chroma, AA-tuned)`,
      );
    }

    // Accent: suggestion only — NEVER pushed into fills (C.5). Gradient stops
    // count as captured hues (a second hue often lives only in a gradient).
    const capturedHexes = tokens.flatMap((t) => {
      if (t.type === "color" && t.opacity === 1) return [t.value];
      if (t.type === "gradient") return t.value.stops.map((s) => s.color);
      return [];
    });
    accent = deriveAccent(primary.value, capturedHexes);

    const harmonySuggestion = harmonyFromPrimary(primary.value);
    const secondaryAnchor = anchors.secondaryColorId
      ? byId.get(anchors.secondaryColorId)
      : undefined;
    const explicitHarmony = input.accentHarmony;
    if (
      secondaryAnchor &&
      secondaryAnchor.type === "color" &&
      explicitHarmony === undefined
    ) {
      fill(
        "color/action/secondary",
        secondaryAnchor,
        secondaryAnchor.id,
        "anchor (your secondary color)",
      );
    } else {
      const harmony = explicitHarmony ?? accent?.suggested ?? harmonySuggestion.suggested;
      const secondaryBase = harmonySuggestion.candidates[harmony];
      fill(
        "color/action/secondary",
        syntheticColor("color/action/secondary", tuneFillForWhiteText(secondaryBase)),
        from,
        `accent (${harmony} harmony, AA-tuned)`,
      );
    }
  }

  // ── Type scale (needs a body anchor) ──
  const body = anchors.bodyTypographyId ? byId.get(anchors.bodyTypographyId) : undefined;
  if (body && body.type === "typography") {
    const captured = tokens.filter((t): t is TypographyToken => t.type === "typography");
    const ratio = input.typeRatio ?? DEFAULT_TYPE_RATIO;
    for (const slot of deriveTypeScale(body, captured, ratio)) {
      if (slot.role === "type/body") {
        fill(slot.role, body, body.id, "anchor (your text style)");
        continue;
      }
      fill(
        slot.role,
        {
          id: `derived_${slot.role.replace(/\//g, "_")}`,
          captureId: "derived",
          source: "derived",
          name: null,
          occurrences: 1,
          merged: false,
          type: "typography",
          value: slot.value,
        },
        body.id,
        `type scale ${slot.method}`,
      );
    }
    fill(
      "type/mono",
      {
        id: "derived_type_mono",
        captureId: "derived",
        source: "derived",
        name: null,
        occurrences: 1,
        merged: false,
        type: "typography",
        value: deriveMono(body),
      },
      body.id,
      "mono stack from body anchor",
    );
  }

  // ── Foundations ──
  const numericToken = (
    role: string,
    type: "spacing" | "border-radius" | "border-width",
    value: number,
  ): StyleSnapToken => ({
    id: `derived_${role.replace(/\//g, "_")}`,
    captureId: "derived",
    source: "derived",
    name: null,
    occurrences: 1,
    merged: false,
    type,
    value,
  });

  if (anchors.baseSpacing !== undefined) {
    const from = anchors.baseSpacingId ?? "convention";
    for (const { role, value } of deriveSpacingRamp(anchors.baseSpacing)) {
      // Captured claims its slot: an existing captured token with this exact
      // value takes the fill instead of a synthetic twin.
      const captured = tokens.find((t) => t.type === "spacing" && t.value === value);
      fill(
        role,
        captured ?? numericToken(role, "spacing", value),
        from,
        captured ? "captured value claims the slot" : `spacing ramp from base ${anchors.baseSpacing}`,
      );
    }
  }

  const radii = tokens
    .filter((t): t is StyleSnapToken & { type: "border-radius"; value: number } => t.type === "border-radius")
    .sort((a, b) => b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1));
  if (radii.length > 0) {
    const fallbackFrom = radii[0].id;
    const radiusScale = input.styleProfile?.radiusScale ?? 1;
    for (const slot of radiusSlotPlan(radii.map((r) => ({ id: r.id, value: r.value })))) {
      const captured =
        (slot.tokenId ? byId.get(slot.tokenId) : undefined) ??
        tokens.find((t) => t.type === "border-radius" && t.value === slot.value);
      const derivedValue = slot.tokenId ? slot.value : scaleRadius(slot.value, radiusScale);
      const method =
        slot.tokenId || radiusScale === 1
          ? slot.method
          : `${slot.method} (style ×${radiusScale})`;
      fill(
        slot.role,
        captured ?? numericToken(slot.role, "border-radius", derivedValue),
        slot.tokenId ?? fallbackFrom,
        method,
      );
    }
  }

  const shadows = tokens
    .filter((t): t is StyleSnapToken & { type: "shadow" } => t.type === "shadow")
    .sort((a, b) => b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1));
  const inkHex = primary ? deriveNeutrals((primary as { value: string }).value).textPrimary : "#111111";
  const shadowSeed =
    shadows[0] !== undefined
      ? { color: shadows[0].value[0].color, opacity: shadows[0].value[0].opacity, from: shadows[0].id }
      : { color: inkHex, opacity: 0.08, from: "convention" };
  const shadowStyle: ShadowStyle = input.styleProfile?.shadowStyle ?? "soft";
  for (const slot of shadowSlotPlan(
    shadows.map((s) => ({ id: s.id, value: s.value })),
    shadowSeed.color,
    shadowSeed.opacity,
    shadowStyle,
  )) {
    fill(
      slot.role,
      slot.tokenId && byId.get(slot.tokenId)
        ? (byId.get(slot.tokenId) as StyleSnapToken)
        : {
            id: `derived_${slot.role.replace(/\//g, "_")}`,
            captureId: "derived",
            source: "derived",
            name: null,
            occurrences: 1,
            merged: false,
            type: "shadow",
            value: slot.value,
          },
      slot.tokenId ?? shadowSeed.from,
      slot.method,
    );
  }

  const capturedWidth = tokens.find((t) => t.type === "border-width");
  fill(
    "border-width/default",
    capturedWidth ?? numericToken("border-width/default", "border-width", 1),
    capturedWidth?.id ?? "convention",
    capturedWidth ? "captured value claims the slot" : "convention (1px hairline)",
  );

  // Claim captured foundation values sitting near a derived slot (e.g. 10px → space/sm 12).
  const snap4 = (v: number) => Math.max(4, Math.round(v / 4) * 4);
  for (const token of tokens) {
    if (token.type !== "spacing" && token.type !== "border-radius") continue;
    if (fills.some((f) => f.token.id === token.id)) continue;
    const prefix = token.type === "spacing" ? "space/" : "radius/";
    const near = fills
      .filter((f) => f.role.startsWith(prefix))
      .map((f) => ({
        fill: f,
        dist: Math.abs((f.token.value as number) - (token.type === "spacing" ? snap4(token.value) : token.value)),
      }))
      .sort((a, b) => a.dist - b.dist || (a.fill.role < b.fill.role ? -1 : 1))[0];
    if (!near || near.dist > 4) continue;
    if (!near.fill.token.id.startsWith("derived_")) continue;
    near.fill.token = token;
    near.fill.method = "captured value claims the nearest slot";
  }

  return {
    anchors,
    fills,
    accent,
    // The confession strip counts real derivations — anchor claims and
    // captured-value slot claims aren't "derived values".
    derivedCount: fills.filter((f) => f.token.id.startsWith("derived_")).length,
  };
}
