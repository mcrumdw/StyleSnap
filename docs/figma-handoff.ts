// StyleSnap → Figma handoff contract (FR-26 / DECISIONS §2.66).
// Additive on cleaned JSON — envelope validation ignores these fields.
// Shared by the webtool export and the Figma plugin importer.
//
// Do not put this into types.ts (capture contract); this is export-only.

import type { GradientValue, ShadowValue, TypographyValue } from "./types";

export const FIGMA_HANDOFF_VERSION = "1.0" as const;

export type FigmaVariableResolvedType = "COLOR" | "FLOAT";

export interface FigmaPrimitiveVariable {
  name: string;
  type: FigmaVariableResolvedType;
  /** COLOR: 6-digit hex; FLOAT: px number. */
  value: string | number;
  /** 0–1 for COLOR; omit for FLOAT. */
  opacity?: number;
  tokenId: string;
}

export interface FigmaSemanticVariable {
  name: string;
  type: FigmaVariableResolvedType;
  /** Primitive variable name this aliases. */
  aliasOf: string;
  role: string;
  tokenId: string;
}

export interface FigmaPaintStyleSolid {
  name: string;
  kind: "solid";
  /** Semantic COLOR variable to bind (preferred). */
  bindVariableName?: string;
  /** Fallback when no bind. */
  hex?: string;
  opacity?: number;
  tokenId: string;
  role?: string;
}

export interface FigmaPaintStyleGradient {
  name: string;
  kind: "gradient";
  value: GradientValue;
  tokenId: string;
  role?: string;
}

export type FigmaPaintStyle = FigmaPaintStyleSolid | FigmaPaintStyleGradient;

export interface FigmaTextStyle {
  name: string;
  value: TypographyValue;
  tokenId: string;
  role?: string;
}

export interface FigmaEffectStyle {
  name: string;
  /** "drop" | "inset" | "backdrop-blur" */
  kind: "drop" | "inset" | "backdrop-blur";
  /** Drop / inset layers; empty for backdrop-blur. */
  layers: ShadowValue;
  /** Backdrop blur radius in px when kind is backdrop-blur. */
  blurPx?: number;
  tokenId: string;
  role?: string;
}

export interface FigmaHandoff {
  version: typeof FIGMA_HANDOFF_VERSION;
  collections: {
    primitives: FigmaPrimitiveVariable[];
    semantic: FigmaSemanticVariable[];
  };
  styles: {
    paint: FigmaPaintStyle[];
    text: FigmaTextStyle[];
    effect: FigmaEffectStyle[];
  };
}
