// Re-export the single source of truth so extension code imports from one place.
// Do NOT redefine token shapes here — edit ../../docs/types.ts instead.
export * from "../../../docs/types";

import type { CaptureFoundations, StyleSnapToken } from "../../../docs/types";

// One click on the page = one "capture": a group of tokens that share a
// captureId (v2.0 schema — the Webtool uses captureId to reconstruct the
// element/component the tokens came from).
export interface Capture {
  captureId: string; // "cap-1"
  source: string; // element descriptor / selector
  tokens: StyleSnapToken[]; // tokens extracted from this element (flat)
  /** Phase 3 — shared when pattern-pick captures element + parent. */
  patternId?: string;
}

// Messages exchanged between content script, background, and side panel.
export type PickerMessage =
  | { kind: "picker/setActive"; active: boolean; patternMode?: boolean }
  | { kind: "picker/setPatternMode"; enabled: boolean }
  | { kind: "picker/captured"; capture: Capture; pageUrl: string }
  | { kind: "picker/state"; active: boolean }
  | { kind: "picker/scanFoundations" }
  | { kind: "picker/foundations"; foundations: CaptureFoundations };
