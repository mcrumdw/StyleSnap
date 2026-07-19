// StyleSnap — Shared Token Types
// Single source of truth for all three codebases (Figma Plugin, Webtool, Browser Extension)
// docs/types.ts
//
// Schema version: 2.1
//
// This is the RAW CAPTURE / TRANSPORT format. It intentionally only models
// primitive values + the context needed to derive semantic roles later.
// Semantic roles ("color.action.primary"), scales, and component definitions
// are built in the Webtool on top of this data — they do NOT live here.
//
// 2.1 (additive): optional meta.foundations (breakpoints / motion / z-index /
// content widths / spacing base) and optional context.layout for coherent
// design.md reproduction. 2.0 captures remain valid.

// ─────────────────────────────────────────
// Token Types
// ─────────────────────────────────────────

export type TokenType =
  | "color"
  | "gradient"        // NEW: web buttons/backgrounds are often gradients
  | "typography"
  | "spacing"
  | "border-radius"
  | "border-width"
  | "shadow";

// ─────────────────────────────────────────
// Token Values
// ─────────────────────────────────────────

// Always normalized to 6-digit hex on capture (convert rgb()/hsl()/named here).
// Alpha is NEVER baked into the hex — it lives in the token's `opacity` field
// so there is exactly one representation of transparency.
export type ColorValue = string; // e.g. "#FF46AF"

export interface GradientStop {
  color: ColorValue; // 6-digit hex
  opacity: number;   // 0–1
  position: number;  // 0–1 along the gradient axis
}

export interface GradientValue {
  kind: "linear" | "radial" | "conic";
  angle?: number;        // degrees — linear only
  stops: GradientStop[]; // 2+ stops, ordered by position
}

export interface TypographyValue {
  fontFamily: string;        // primary family, e.g. "Inter"
  fontStack?: string[];      // full CSS fallback stack, e.g. ["Inter", "system-ui", "sans-serif"]
  fontSize: number;          // px
  fontWeight: number;        // 100–900 (normalize "bold"/"normal" on capture)
  fontStyle?: "normal" | "italic";
  lineHeight: number;        // unitless ratio, e.g. 1.5 (convert from px if needed — lossy)
  letterSpacing?: number;    // px
  textTransform?: "none" | "uppercase" | "lowercase" | "capitalize";
}

export type SpacingValue = number;      // px
export type BorderRadiusValue = number; // px
export type BorderWidthValue = number;  // px

// A single box-shadow layer. CSS box-shadow can stack multiple layers and can
// be inset, so ShadowValue is an ARRAY of these.
export interface ShadowLayer {
  inset: boolean;   // NEW: inner vs drop shadow
  offsetX: number;  // px
  offsetY: number;  // px
  blur: number;     // px
  spread: number;   // px
  color: ColorValue; // hex
  opacity: number;  // 0–1
}

export type ShadowValue = ShadowLayer[]; // one or more stacked shadows

// ─────────────────────────────────────────
// Capture Context
// ─────────────────────────────────────────
// Best-effort metadata captured at extraction time so the Webtool can DERIVE
// semantic roles deterministically instead of purely predicting them.
// Any field may be absent (hashed class names, inline styles, etc.) — treat
// these as confidence-weighted hints, not guarantees.

export type CaptureState =
  | "default"
  | "hover"
  | "focus"
  | "active"
  | "disabled"
  | "visited";

/** Layout recipe for one captured element — feeds design.md Components / Layout. */
export interface CaptureLayout {
  display: string;
  flexDirection?: string;
  justifyContent?: string;
  alignItems?: string;
  gridTemplateColumns?: string;
  maxWidthPx?: number;
  gapPx?: number;
}

export interface TokenContext {
  cssProperty?: string;   // where the value was used: "background-color" | "color" | "border-color" ...
  element?: string;       // tag name, e.g. "button" | "h1" | "nav"
  ariaRole?: string;      // e.g. "alert" | "button" | "navigation"
  state?: CaptureState;   // pseudo-class the value came from
  selector?: string;      // CSS selector (browser extension)
  // The author's own name for this value — the strongest role signal when present:
  //   • CSS custom property:  "--color-primary"
  //   • utility class:        "bg-blue-500" / "text-red-600"
  //   • Figma Variable/Style: "color/action/primary"
  authoredName?: string;
  /** Optional layout recipe (browser extension v2.1). */
  layout?: CaptureLayout;
}

// ─────────────────────────────────────────
// Page-level foundations (browser scan / meta)
// ─────────────────────────────────────────

export interface CaptureMotionHint {
  durationMs: number;
  easing: string;
  property?: string;
}

/**
 * Optional page-level signals that fill design.md Foundations / Agent rules /
 * Layout & Motion notes. Absent on Figma captures and on 2.0 browser exports.
 */
export interface CaptureFoundations {
  breakpointsPx?: number[];
  motion?: CaptureMotionHint[];
  zIndex?: number[];
  contentMaxWidthsPx?: number[];
  spacingBasePx?: number;
}

// ─────────────────────────────────────────
// Base Token
// ─────────────────────────────────────────

interface BaseToken {
  id: string;            // GLOBALLY unique — UUID or source-prefixed ("ext_…", "fig_…")
                         // so merging multiple exports never collides.
  captureId: string;     // groups tokens captured from the SAME element/selection,
                         // so the Webtool can later reconstruct components.
  source: string;        // Figma: layer name ("Button/Primary").
                         // Extension: element descriptor / selector.
  name: string | null;   // user-assigned in Webtool, null until named.
  occurrences: number;   // how many times this value appeared — frequency signal
                         // for ranking primitives & suggesting roles.
  merged: boolean;       // true if duplicates were collapsed into this token.
  mergedFrom?: string[]; // ids of the duplicate tokens collapsed into this one.
  context?: TokenContext;
}

// ─────────────────────────────────────────
// Token Variants (discriminated union)
// ─────────────────────────────────────────

export interface ColorToken extends BaseToken {
  type: "color";
  value: ColorValue;
  opacity: number; // 0–1, default 1
}

export interface GradientToken extends BaseToken {
  type: "gradient";
  value: GradientValue;
}

export interface TypographyToken extends BaseToken {
  type: "typography";
  value: TypographyValue;
}

export interface SpacingToken extends BaseToken {
  type: "spacing";
  value: SpacingValue;
}

export interface BorderRadiusToken extends BaseToken {
  type: "border-radius";
  value: BorderRadiusValue;
}

export interface BorderWidthToken extends BaseToken {
  type: "border-width";
  value: BorderWidthValue;
}

export interface ShadowToken extends BaseToken {
  type: "shadow";
  value: ShadowValue;
}

// ─────────────────────────────────────────
// Union Type — use this everywhere
// ─────────────────────────────────────────

export type StyleSnapToken =
  | ColorToken
  | GradientToken
  | TypographyToken
  | SpacingToken
  | BorderRadiusToken
  | BorderWidthToken
  | ShadowToken;

// ─────────────────────────────────────────
// Root Export (the full JSON structure)
// ─────────────────────────────────────────

export interface StyleSnapMeta {
  source: "figma" | "browser-extension";
  exportedAt: string;   // ISO 8601, e.g. "2026-06-28T10:00:00Z"
  figmaFile?: string;   // only present when source is "figma"
  pageUrl?: string;     // only present when source is "browser-extension"
  version: string;      // schema version, e.g. "2.1"
  /** Page-level foundations from a browser scan (schema 2.1+). */
  foundations?: CaptureFoundations;
}

export interface StyleSnapExport {
  meta: StyleSnapMeta;
  tokens: StyleSnapToken[];
}
