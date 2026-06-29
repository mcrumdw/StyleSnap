// StyleSnap — Shared Token Types
// Single source of truth for all three codebases (Figma Plugin, Webtool, Browser Extension)
// docs/types.ts

// ─────────────────────────────────────────
// Token Types
// ─────────────────────────────────────────

export type TokenType =
  | "color"
  | "typography"
  | "spacing"
  | "border-radius"
  | "border-width"
  | "shadow";

// ─────────────────────────────────────────
// Token Values
// ─────────────────────────────────────────

export type ColorValue = string; // hex, e.g. "#FF46AF"

export interface TypographyValue {
  fontFamily: string;
  fontSize: number;    // px
  fontWeight: number;  // e.g. 400, 600, 700
  lineHeight: number;  // unitless ratio, e.g. 1.5
}

export type SpacingValue = number;      // px
export type BorderRadiusValue = number; // px
export type BorderWidthValue = number;  // px

export interface ShadowValue {
  offsetX: number;  // px
  offsetY: number;  // px
  blur: number;     // px
  spread: number;   // px
  color: string;    // hex
  opacity: number;  // 0–1
}

// ─────────────────────────────────────────
// Base Token
// ─────────────────────────────────────────

interface BaseToken {
  id: string;          // unique, e.g. "token_001"
  source: string;      // Figma layer name, e.g. "Button/Primary"
  name: string | null; // assigned by user in Webtool, null until named
  merged: boolean;     // true if this token was merged from a duplicate
}

// ─────────────────────────────────────────
// Token Variants (discriminated union)
// ─────────────────────────────────────────

export interface ColorToken extends BaseToken {
  type: "color";
  value: ColorValue;
  opacity: number; // 0–1, default 1
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
  | TypographyToken
  | SpacingToken
  | BorderRadiusToken
  | BorderWidthToken
  | ShadowToken;

// ─────────────────────────────────────────
// Captured Element (element-centric grouping)
// ─────────────────────────────────────────
//
// Each element the user selects (in the extension) or each component/layer
// (in the Figma plugin) is one CapturedElement. It carries a semantic role
// and the tokens that were extracted from that element — so the Webtool knows
// how many elements were picked, what each one is, and which tokens belong to
// which element, and can build a coherent system from that.

export type ElementRole =
  | "button"
  | "card"
  | "menu"
  | "input"
  | "heading"
  | "text"
  | "badge"
  | "container"
  | "image"
  | "link"
  | "icon"
  | "other";

export interface CapturedElement {
  id: string;                 // unique, e.g. "el_001"
  role: ElementRole;          // what kind of element this is (user-confirmable)
  label: string;              // human-readable source, e.g. "nav.main" or "Button/Primary"
  tokens: StyleSnapToken[];   // the tokens extracted from THIS element only
}

// ─────────────────────────────────────────
// Root Export (the full JSON structure)
// ─────────────────────────────────────────

export interface StyleSnapMeta {
  source: "figma" | "browser-extension";
  exportedAt: string;   // ISO 8601, e.g. "2026-06-28T10:00:00Z"
  figmaFile?: string;   // only present when source is "figma"
  pageUrl?: string;     // only present when source is "browser-extension"
  version: string;      // schema version, e.g. "1.0"
}

export interface StyleSnapExport {
  meta: StyleSnapMeta;
  elements: CapturedElement[];   // element-centric: count = elements.length
}
