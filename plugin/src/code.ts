// StyleSnap Figma Plugin — sandbox code (runs inside Figma, no DOM access).
// Talks to the panel UI (src/ui.html) via postMessage.

import type { StyleSnapExport, StyleSnapToken } from "../../docs/types";
import type { FigmaHandoff } from "../../docs/figma-handoff";
import { parseStyleSnapExport } from "../../docs/schema";
import { extractTokens } from "./extract";
import { createAssets, readFigmaHandoff } from "./create";

// One row in the import preview: what would be created in Figma.
export interface ImportPreviewEntry {
  kind:
    | "paint-style"
    | "text-style"
    | "effect-style"
    | "variable"
    | "variable-primitive"
    | "variable-semantic";
  name: string;
  valueLabel: string;
}

type UiMessage =
  | { type: "extract-tokens" }
  | { type: "validate-import"; json: string }
  | { type: "create-import"; json: string }
  | { type: "notify"; message: string };

type PluginMessage =
  | { type: "selection-changed"; hasSelection: boolean }
  | { type: "extraction-result"; payload: StyleSnapExport }
  | { type: "extraction-empty" }
  | {
      type: "import-preview";
      entries: ImportPreviewEntry[];
      skippedUnnamed: number;
      versionWarning?: string;
      handoffWarning?: string;
    }
  | { type: "import-invalid"; error: string; details: string[] }
  | {
      type: "create-done";
      created: number;
      skipped: number;
      errors: string[];
      warning?: string;
    };

figma.showUI(__html__, { width: 340, height: 560 });

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
      return null;
  }
}

function previewFromHandoff(handoff: FigmaHandoff): ImportPreviewEntry[] {
  const entries: ImportPreviewEntry[] = [];
  for (const p of handoff.collections.primitives) {
    entries.push({
      kind: "variable-primitive",
      name: p.name,
      valueLabel:
        p.type === "COLOR"
          ? `${p.value}${p.opacity !== undefined && p.opacity < 1 ? ` @ ${Math.round(p.opacity * 100)}%` : ""}`
          : `${p.value}px`,
    });
  }
  for (const s of handoff.collections.semantic) {
    entries.push({
      kind: "variable-semantic",
      name: s.name,
      valueLabel: `→ ${s.aliasOf}`,
    });
  }
  for (const p of handoff.styles.paint) {
    entries.push({
      kind: "paint-style",
      name: p.name,
      valueLabel:
        p.kind === "gradient"
          ? `${p.value.kind} gradient`
          : p.bindVariableName
            ? `bound → ${p.bindVariableName}`
            : (p.hex ?? "solid"),
    });
  }
  for (const t of handoff.styles.text) {
    entries.push({
      kind: "text-style",
      name: t.name,
      valueLabel: `${t.value.fontFamily} ${t.value.fontSize}px`,
    });
  }
  for (const e of handoff.styles.effect) {
    entries.push({
      kind: "effect-style",
      name: e.name,
      valueLabel:
        e.kind === "backdrop-blur" ? `blur ${e.blurPx ?? 0}px` : `${e.kind} · ${e.layers.length} layer(s)`,
    });
  }
  return entries;
}

function parseRawJson(json: string): unknown {
  try {
    return JSON.parse(json);
  } catch {
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
      const raw = parseRawJson(msg.json);
      const handoff = readFigmaHandoff(raw);
      let entries: ImportPreviewEntry[] = [];
      let skippedUnnamed = 0;
      let handoffWarning: string | undefined;
      if (handoff) {
        entries = previewFromHandoff(handoff);
      } else {
        // Avoid the substring "import (" — Figma's SES sandbox regex-rejects it.
        handoffWarning =
          "No figmaHandoff in JSON — legacy path: paint styles + spacing vars. Re-export from StyleSnap for full two-tier.";
        for (const token of result.data.tokens) {
          const entry = toPreviewEntry(token);
          if (entry) entries.push(entry);
          else if (token.name === null) skippedUnnamed++;
        }
      }
      postToUi({
        type: "import-preview",
        entries,
        skippedUnnamed,
        versionWarning: result.versionWarning,
        handoffWarning,
      });
      return;
    }
    case "create-import": {
      const result = parseStyleSnapExport(msg.json);
      if (!result.ok) {
        postToUi({ type: "import-invalid", error: result.error, details: result.details });
        return;
      }
      const handoff = readFigmaHandoff(parseRawJson(msg.json));
      const summary = await createAssets(result.data, handoff);
      postToUi({ type: "create-done", ...summary });
      if (summary.created > 0) {
        figma.notify(`StyleSnap: ${summary.created} styles/variables created`);
      }
      if (summary.warning) {
        figma.notify(summary.warning, { timeout: 5000 });
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
