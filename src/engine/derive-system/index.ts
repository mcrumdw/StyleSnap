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
import { harvestFeedbackColors, FEEDBACK_ROLE_PATHS } from "./feedback-harvest";
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
import { isBackdropBlurToken, isDropShadowToken, isInsetShadowToken } from "../effect-kinds";
import { isManualToken } from "../normalize";
import { deriveRoleCandidates } from "../roles";
import {
  COLOR_ROLES,
  SPACE_SEMANTIC_FROM_SCALE,
  SPACE_SCALE_ROLES,
  derivePageInsetPx,
} from "../roles/taxonomy";

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

/** Figma system recapture — tokens already named as Appendix B color roles. */
export function isSystemColorRecapture(tokens: readonly StyleSnapToken[]): boolean {
  let named = 0;
  for (const token of tokens) {
    if (token.type !== "color") continue;
    const path = (token.context?.authoredName ?? token.name ?? "").toLowerCase().trim();
    if (path.startsWith("color/") && path.split("/").filter(Boolean).length >= 3) named++;
  }
  // A full StyleSnap → Figma → web round-trip carries many role paths; sparse
  // selection extracts usually have zero. Threshold keeps browser snaps deriving.
  return named >= 5;
}

function rolePathOf(token: StyleSnapToken): string | undefined {
  const fromAuth = token.context?.authoredName?.toLowerCase().trim();
  if (fromAuth?.startsWith("color/")) return fromAuth;
  const fromName = token.name?.toLowerCase().trim();
  if (fromName?.startsWith("color/")) return fromName;
  return undefined;
}

/**
 * Prefer a captured interaction shade (context.state) over the ΔL formula —
 * same precedence as spacing "captured value claims the slot" (C.8).
 */
function capturedInteractionColor(
  tokens: StyleSnapToken[],
  rawById: ReadonlyMap<string, StyleSnapToken>,
  state: "hover" | "active",
): StyleSnapToken | undefined {
  const paintScore = (prop: string | undefined) => {
    if (prop === "background-color" || prop === "background-image") return 3;
    if (prop === "fill" || prop === "stroke" || prop === "stop-color") return 2;
    if (prop === "border-color" || prop === "outline-color") return 1;
    return 0;
  };
  const matches = tokens.filter((t) => {
    if (t.type !== "color" || t.opacity < 0.5) return false;
    const raw = rawById.get(t.id) ?? t;
    return raw.context?.state === state;
  });
  matches.sort((a, b) => {
    const ra = rawById.get(a.id) ?? a;
    const rb = rawById.get(b.id) ?? b;
    return (
      paintScore(rb.context?.cssProperty) - paintScore(ra.context?.cssProperty) ||
      b.occurrences - a.occurrences ||
      (a.id < b.id ? -1 : 1)
    );
  });
  return matches[0];
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
  const captureOnlyColors = isSystemColorRecapture(tokens);
  if (primary && primary.type === "color") {
    const from = primary.id;
    fill("color/action/primary", primary, from, "anchor (your primary color)");

    const colorCandidates = deriveRoleCandidates(tokens, rawById);
    const claimCaptured = (role: string, method: string) => {
      const cand = colorCandidates.get(role)?.[0];
      const captured = cand ? byId.get(cand.tokenId) : undefined;
      if (captured && captured.type === "color" && !captured.id.startsWith("derived_")) {
        fill(role, captured, captured.id, method);
        return true;
      }
      // Direct match on token name / authoredName (recapture may skip candidate ranking).
      for (const token of tokens) {
        if (token.type !== "color" || token.id.startsWith("derived_")) continue;
        if (rolePathOf(token) === role) {
          fill(role, token, token.id, method);
          return true;
        }
      }
      return false;
    };

    const claimColor = (
      role: string,
      fallback: StyleSnapToken,
      derivedFrom: string,
      formulaMethod: string,
      capturedMethod: string,
    ) => {
      if (claimCaptured(role, capturedMethod)) return;
      if (!captureOnlyColors) fill(role, fallback, derivedFrom, formulaMethod);
    };

    const states = deriveStates(primary.value);
    const hoverCaptured = capturedInteractionColor(tokens, rawById, "hover");
    if (hoverCaptured) {
      fill("color/action/primary-hover", hoverCaptured, hoverCaptured.id, "captured :hover state");
    } else if (!claimCaptured("color/action/primary-hover", "captured hover color")) {
      if (!captureOnlyColors) {
        fill(
          "color/action/primary-hover",
          syntheticColor("color/action/primary-hover", states.hover),
          from,
          "hover (ΔL −0.06)",
        );
      }
    }
    const activeCaptured = capturedInteractionColor(tokens, rawById, "active");
    if (activeCaptured) {
      fill(
        "color/action/primary-active",
        activeCaptured,
        activeCaptured.id,
        "captured :active state",
      );
    } else if (!claimCaptured("color/action/primary-active", "captured active color")) {
      if (!captureOnlyColors) {
        fill(
          "color/action/primary-active",
          syntheticColor("color/action/primary-active", states.active),
          from,
          "active (ΔL −0.12)",
        );
      }
    }

    // Focus ring: prefer explicit capture, else primary (still from capture).
    if (!claimCaptured("color/border/focus", "captured focus color")) {
      fill("color/border/focus", primary, from, "focus ring = primary");
    }

    const neutrals = deriveNeutrals(primary.value);

    const linkHex = deriveLinkColor(primary.value, neutrals.surfacePage);
    if (linkHex.toLowerCase() === primary.value.toLowerCase()) {
      fill("color/text/link", primary, from, "link = brand primary");
    } else {
      claimColor(
        "color/text/link",
        syntheticColor("color/text/link", linkHex),
        from,
        "link (brand hue, AA-tuned for page surface)",
        "captured link color",
      );
    }

    const neutralMethod = (l: string) => `tinted neutral (brand hue, ${l})`;
    claimColor(
      "color/text/primary",
      syntheticColor("color/text/primary", neutrals.textPrimary),
      from,
      neutralMethod("L 0.22"),
      "captured text color",
    );
    claimColor(
      "color/text/muted",
      syntheticColor("color/text/muted", neutrals.textMuted),
      from,
      neutralMethod("L 0.52"),
      "captured muted text",
    );
    claimColor(
      "color/surface/page",
      syntheticColor("color/surface/page", neutrals.surfacePage),
      from,
      neutralMethod("L 0.985"),
      "captured page background",
    );
    claimColor(
      "color/surface/card",
      syntheticColor("color/surface/card", neutrals.surfaceCard),
      from,
      "white card surface",
      "captured card background",
    );
    claimColor(
      "color/border/default",
      syntheticColor("color/border/default", neutrals.border),
      from,
      neutralMethod("L 0.90"),
      "captured border color",
    );

    const harvested = harvestFeedbackColors(tokens, assignments, primary.value, rawById);
    for (const { role, token, method } of harvested) {
      fill(FEEDBACK_ROLE_PATHS[role], token, token.id, method);
    }

    for (const key of ["success", "warning", "error", "info"] as const) {
      claimCaptured(FEEDBACK_ROLE_PATHS[key], "captured feedback (authored name)");
    }

    if (!captureOnlyColors) {
      const feedback = deriveFeedback(primary.value);
      for (const key of ["success", "warning", "error", "info"] as const) {
        fill(
          `color/feedback/${key}`,
          syntheticColor(`color/feedback/${key}`, feedback[key]),
          from,
          `feedback ${key} (conventional hue, brand chroma, AA-tuned)`,
        );
      }
    }

    // Sweep remaining Appendix B color roles from capture names (overlay, inverse, …).
    for (const def of COLOR_ROLES) {
      claimCaptured(def.role, "captured color (authored name)");
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
    // Opt-in only (§2.38 / §2.41): never fill from auto-detected secondary.
    // User must set accentHarmony or explicitly override secondaryColorId.
    const userSecondaryId = input.overrides?.secondaryColorId;
    const secondaryAnchor = userSecondaryId ? byId.get(userSecondaryId) : undefined;
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
    } else if (explicitHarmony !== undefined && !captureOnlyColors) {
      const secondaryBase = harmonySuggestion.candidates[explicitHarmony];
      fill(
        "color/action/secondary",
        syntheticColor("color/action/secondary", tuneFillForWhiteText(secondaryBase)),
        from,
        `accent (${explicitHarmony} harmony, AA-tuned)`,
      );
    } else {
      claimCaptured("color/action/secondary", "captured secondary color");
    }
  }

  // ── Type scale (needs a body anchor) ──
  const body = anchors.bodyTypographyId ? byId.get(anchors.bodyTypographyId) : undefined;
  if (body && body.type === "typography") {
    const captured = tokens.filter((t): t is TypographyToken => t.type === "typography");
    const ratio = input.typeRatio ?? DEFAULT_TYPE_RATIO;

    // A captured font that maps to a heading/display slot by its context
    // (`<h1>` ≥ 40px → display, `<h1..h3>` → heading) or its authoredName
    // CLAIMS that slot — so a distinct hero or heading typeface from the snap
    // is used verbatim, not replaced by a derived size of the body font. Only
    // the still-empty slots derive. Reuses the tested role-derivation rules.
    const typeCandidates = deriveRoleCandidates(tokens, rawById);
    const capturedForType = (role: string): TypographyToken | undefined => {
      for (const cand of typeCandidates.get(role) ?? []) {
        const tok = byId.get(cand.tokenId);
        if (
          tok &&
          tok.type === "typography" &&
          !tok.id.startsWith("derived_") &&
          tok.id !== body.id
        ) {
          return tok;
        }
      }
      return undefined;
    };
    const claimHint = (tok: TypographyToken): string => {
      const authored = tok.context?.authoredName;
      if (authored) return `captured, authored "${authored}"`;
      const el = tok.context?.element;
      return el ? `captured on <${el}>` : "captured font";
    };

    for (const slot of deriveTypeScale(body, captured, ratio)) {
      if (slot.role === "type/body") {
        fill(slot.role, body, body.id, "anchor (your text style)");
        continue;
      }
      const claimed = capturedForType(slot.role);
      if (claimed) {
        fill(slot.role, claimed, claimed.id, claimHint(claimed));
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
    .filter((t): t is StyleSnapToken & { type: "shadow" } => isDropShadowToken(t))
    .sort((a, b) => b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1));
  const shadowStyle: ShadowStyle = input.styleProfile?.shadowStyle ?? "soft";
  for (const slot of shadowSlotPlan(
    shadows.map((s) => ({ id: s.id, value: s.value })),
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
      slot.tokenId ?? "convention",
      slot.method,
    );
  }

  // Effect semantics (§2.50 / §2.63 / §2.64) — elevation only when drop
  // shadows were captured (empty → leave slots open). Inset / blur: seed from
  // snap only — never treat Add-token manuals as "from capture".
  if (open("shadow/inset")) {
    const inset = tokens
      .filter((t) => isInsetShadowToken(t) && !isManualToken(t))
      .sort((a, b) => b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1))[0];
    if (inset) fill("shadow/inset", inset, inset.id, "captured inset shadow");
  }
  if (open("blur/backdrop")) {
    const blur = tokens
      .filter((t) => isBackdropBlurToken(t) && !isManualToken(t))
      .sort((a, b) => b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1))[0];
    if (blur) fill("blur/backdrop", blur, blur.id, "captured backdrop blur");
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
    const near = fills
      .filter((f) =>
        token.type === "spacing"
          ? SPACE_SCALE_ROLES.has(f.role)
          : f.role.startsWith("radius/"),
      )
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

  // Semantic spacing jobs ← scale steps (§2.47 / §2.49), after near-slot.
  // Prefer live fills; fall back to already-assigned scale slots.
  const resolveScaleToken = (
    scaleRole: string,
  ): { token: StyleSnapToken; derivedFrom: string } | undefined => {
    const source = fills.find((f) => f.role === scaleRole);
    if (source) return { token: source.token, derivedFrom: source.derivedFrom };
    const assignedId = assignments.get(scaleRole);
    const token = assignedId ? byId.get(assignedId) : undefined;
    if (token) return { token, derivedFrom: assignedId! };
    return undefined;
  };

  // space/page = clamp(2 × space/xl, 32, 160) — not a direct alias of xl.
  if (open("space/page")) {
    const xl = resolveScaleToken("space/xl");
    if (xl && typeof xl.token.value === "number") {
      const value = derivePageInsetPx(xl.token.value);
      const captured = tokens.find((t) => t.type === "spacing" && t.value === value);
      fill(
        "space/page",
        captured ?? numericToken("space/page", "spacing", value),
        xl.derivedFrom,
        `2× space/xl (${xl.token.value}→${value}px), clamped 32–160`,
      );
    }
  }

  for (const { role, from: scaleRoles } of SPACE_SEMANTIC_FROM_SCALE) {
    if (!open(role)) continue;
    for (const scaleRole of scaleRoles) {
      const source = resolveScaleToken(scaleRole);
      if (!source) continue;
      fill(role, source.token, source.derivedFrom, `from scale (${scaleRole})`);
      break;
    }
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
