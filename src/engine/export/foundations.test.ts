import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseStyleSnapExport } from "../../contract/schema";
import { mergeCaptureFoundations, notesFromFoundations } from "./foundations";
import { generateDesignMd, type ExportInput } from "./index";
import type { StyleSnapToken } from "../../contract/types";

const fixture = (name: string) =>
  readFileSync(resolve(__dirname, `../../../docs/fixtures/${name}`), "utf8");

describe("schema 2.1 foundations → design.md", () => {
  const parsed = parseStyleSnapExport(fixture("capture-browser-v2.json"));
  if (!parsed.ok) throw new Error(parsed.error);

  it("imports the v2 browser fixture without warning", () => {
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.versionWarning).toBeUndefined();
      expect(parsed.data.meta.foundations?.breakpointsPx).toEqual([640, 768, 1024, 1280]);
    }
  });

  it("merges foundations and prefills layout/motion notes", () => {
    const foundations = mergeCaptureFoundations([parsed.data.meta]);
    expect(foundations?.breakpointsPx?.length).toBe(4);
    const notes = notesFromFoundations(foundations);
    expect(notes.layout).toContain("1280px");
    expect(notes.motion).toContain("150ms");
  });

  it("emits agent rules, breakpoints, and capture-derived notes in design.md", () => {
    const tokens = parsed.data.tokens as StyleSnapToken[];
    const assignments = new Map<string, string>([
      ["color/action/primary", "ext_001"],
      ["color/action/primary-hover", "ext_002"],
      ["color/border/focus", "ext_003"],
      ["color/surface/card", "ext_007"],
      ["radius/md", "ext_004"],
      ["space/sm", "ext_006"],
      ["space/md", "ext_005"],
      ["space/lg", "ext_008"],
      ["shadow/sm", "ext_009"],
    ]);
    const names = new Map(tokens.map((t) => [t.id, t.id]));
    const rawById = new Map(tokens.map((t) => [t.id, t]));
    const input: ExportInput = {
      projectName: "Example",
      generatedAt: "2026-07-19T15:00:00Z",
      captures: [parsed.data.meta],
      rawTokenCount: tokens.length,
      mergeCount: 0,
      tokens,
      rawById,
      assignments,
      names,
      notes: {},
    };
    const md = generateDesignMd(input);
    expect(md).toContain("Schema v2.1");
    expect(md).toContain("Breakpoints (do not invent)");
    expect(md).toContain("**Breakpoints** — 640px · 768px · 1024px · 1280px");
    expect(md).toContain("**Motion** — 150ms ease-out");
    expect(md).toContain("from capture — confirm in System notes");
    expect(md).not.toContain("Breakpoints, z-index — never capturable");
    expect(md).toContain("layout inline-flex");
  });
});
