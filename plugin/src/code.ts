// StyleSnap Figma Plugin — sandbox code (runs inside Figma, no DOM access).
// Talks to the panel UI (src/ui.html) via postMessage.

import type { StyleSnapExport } from "../../docs/types";

// Messages UI → sandbox
type UiMessage =
  | { type: "extract-tokens" }
  | { type: "notify"; message: string };

// Messages sandbox → UI
type PluginMessage =
  | { type: "selection-changed"; hasSelection: boolean }
  | { type: "extraction-result"; payload: StyleSnapExport }
  | { type: "extraction-empty" };

figma.showUI(__html__, { width: 320, height: 480, themeColors: true });

function postToUi(msg: PluginMessage) {
  figma.ui.postMessage(msg);
}

function notifySelection() {
  postToUi({
    type: "selection-changed",
    hasSelection: figma.currentPage.selection.length > 0,
  });
}

figma.on("selectionchange", notifySelection);
notifySelection();

figma.ui.onmessage = (msg: UiMessage) => {
  switch (msg.type) {
    case "extract-tokens": {
      // Task 2 (extraction engine) fills this in. For now the scaffold
      // returns an empty, schema-valid export so the round-trip is testable.
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        postToUi({ type: "extraction-empty" });
        return;
      }
      const payload: StyleSnapExport = {
        meta: {
          source: "figma",
          exportedAt: new Date().toISOString(),
          figmaFile: figma.root.name,
          version: "2.0",
        },
        tokens: [],
      };
      postToUi({ type: "extraction-result", payload });
      break;
    }
    case "notify":
      figma.notify(msg.message);
      break;
  }
};
