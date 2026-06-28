// Re-export the single source of truth so extension code imports from one place.
// Do NOT redefine token shapes here — edit ../../docs/types.ts instead.
export * from "../../../docs/types";

// Messages exchanged between content script, background, and side panel.
import type { StyleSnapToken } from "../../../docs/types";

export type PickerMessage =
  | { kind: "picker/setActive"; active: boolean }
  | { kind: "picker/captured"; tokens: StyleSnapToken[]; pageUrl: string }
  | { kind: "picker/state"; active: boolean };
