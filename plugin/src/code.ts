// StyleSnap Figma Plugin — sandbox code (runs inside Figma, no DOM access).
// Talks to the panel UI (src/ui.html) via postMessage.

import type { StyleSnapExport, StyleSnapToken } from "../../docs/types";
import { parseStyleSnapExport } from "../../docs/schema";
import { extractTokens } from "./extract";
import { createAssets } from "./create";

// One row in the import preview: what would be created in Figma.
export interface ImportPreviewEntry {
  kind: "paint-style" | "text-style" | "variable";
  name: string;
  valueLabel: string;
}

// Messages UI → sandbox
type UiMessage =
  | { type: "extract-tokens" }
  | { type: "validate-import"; json: string }
  | { type: "create-import"; json: string }
  | { type: "notify"; message: string };

// Messages sandbox → UI
type PluginMessage =
  | { type: "selection-changed"; hasSelection: boolean }
  | { type: "extraction-result"; payload: StyleSnapExport }
  | { type: "extraction-empty" }
  | {
      type: "import-preview";
      entries: ImportPreviewEntry[];
      skippedUnnamed: number;
      versionWarning?: string;
    }
  | { type: "import-invalid"; error: string; details: string[] }
  | { type: "create-done"; created: number; skipped: number; errors: string[] };

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

// Maps a named token to the Figma asset the import would create (PRD §3 Flow 2):
// color/gradient → Paint Style, typography → Text Style, the rest → Variable.
function toPreviewEntry(t: StyleSnapToken): ImportPreviewEntry | null {
  if (t.name === null) return null;
  switch (t.type) {
    case "color":
      return {
        kind: "paint-style",
        name: t.name,
        valueLabel: t.value + (t.opacity < 1 ? ` @ ${Math.round(t.opacity * 100)}%` : ""),
      };
    case "gradient":
      return {
        kind: "paint-style",
        name: t.name,
        valueLabel: `${t.value.kind} gradient, ${t.value.stops.length} stops`,
      };
    case "typography":
      return {
        kind: "text-style",
        name: t.name,
        valueLabel: `${t.value.fontFamily} ${t.value.fontSize}px w${t.value.fontWeight}`,
      };
    case "spacing":
    case "border-radius":
    case "border-width":
      return { kind: "variable", name: t.name, valueLabel: `${t.value}px` };
    case "shadow":
      // Figma Variables cannot hold composite shadow values — deferred to
      // Effect Styles in a later iteration. Skipped for now (counted in UI).
      return null;
  }
}

figma.ui.onmessage = async (msg: UiMessage) => {
  switch (msg.type) {
    case "validate-import": {
      const result = parseStyleSnapExport(msg.json);
      if (!result.ok) {
        postToUi({ type: "import-invalid", error: result.error, details: result.details });
        return;
      }
      const entries: ImportPreviewEntry[] = [];
      let skippedUnnamed = 0;
      for (const token of result.data.tokens) {
        const entry = toPreviewEntry(token);
        if (entry) entries.push(entry);
        else if (token.name === null) skippedUnnamed++;
      }
      postToUi({
        type: "import-preview",
        entries,
        skippedUnnamed,
        versionWarning: result.versionWarning,
      });
      return;
    }
    case "create-import": {
      const result = parseStyleSnapExport(msg.json);
      if (!result.ok) {
        postToUi({ type: "import-invalid", error: result.error, details: result.details });
        return;
      }
      const summary = await createAssets(result.data);
      postToUi({ type: "create-done", ...summary });
      if (summary.created > 0) {
        figma.notify(`StyleSnap: ${summary.created} styles/variables created`);
      }
      return;
    }
    case "extract-tokens": {
      const selection = figma.currentPage.selection;
      if (selection.length === 0) {
        postToUi({ type: "extraction-empty" });
        return;
      }
      const payload: StyleSnapExport = await extractTokens(selection);
      if (payload.tokens.length === 0) {
        postToUi({ type: "extraction-empty" });
        return;
      }
      postToUi({ type: "extraction-result", payload });
      break;
    }
    case "notify":
      figma.notify(msg.message);
      break;
  }
};
