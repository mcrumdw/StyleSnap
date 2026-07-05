import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../contract/schema";
import { appendImport, emptyPool } from "./pool";
import {
  captureGroups,
  DEFAULT_FILTERS,
  filterEntries,
  formatValue,
  groupByType,
  poolEntries,
  valueKey,
  type PoolEntry,
} from "./workspace";

const fixture = (name: string) =>
  readFileSync(new URL(`../../docs/fixtures/${name}`, import.meta.url), "utf-8");

function entriesFromBothFixtures(): PoolEntry[] {
  let pool = emptyPool();
  for (const [i, name] of ["capture-browser-messy.json", "capture-figma-clean.json"].entries()) {
    const result = parseStyleSnapExport(fixture(name));
    if (!result.ok) throw new Error(`fixture ${name} should parse`);
    pool = appendImport(pool, result.data, {
      importId: `imp-${i}`,
      importedAt: "2026-07-04T10:00:00Z",
    });
  }
  return poolEntries(pool);
}

const entries = entriesFromBothFixtures();

describe("grouping by type (FR-5)", () => {
  it("groups both fixtures with the expected counts, empty groups hidden", () => {
    const groups = groupByType(entries);
    expect(groups.map((g) => [g.type, g.entries.length])).toEqual([
      ["color", 16],
      ["gradient", 1],
      ["typography", 7],
      ["spacing", 9],
      ["border-radius", 3],
      ["border-width", 1],
      ["shadow", 3],
    ]);
  });

  it("omits empty groups entirely", () => {
    const onlyColors = filterEntries(entries, { ...DEFAULT_FILTERS, type: "color" });
    const groups = groupByType(onlyColors);
    expect(groups).toHaveLength(1);
    expect(groups[0].type).toBe("color");
  });

  it("is deterministic — same tokens in any input order give identical output", () => {
    const reversed = [...entries].reverse();
    const a = groupByType(entries).flatMap((g) => g.entries.map((e) => e.token.id));
    const b = groupByType(reversed).flatMap((g) => g.entries.map((e) => e.token.id));
    expect(b).toEqual(a);
  });
});

describe("the Figma scrim stays distinct (Phase 2 acceptance)", () => {
  it("#101828 @ 0.5 and #101828 @ 1 have different value keys and captions", () => {
    const scrim = entries.find((e) => e.token.id === "fig_004")!;
    const ink = entries.find((e) => e.token.id === "fig_002")!;
    expect(valueKey(scrim.token)).not.toBe(valueKey(ink.token));
    expect(formatValue(scrim.token)).toBe("#101828 @ 50%");
    expect(formatValue(ink.token)).toBe("#101828");
  });
});

describe("filters (FR-7)", () => {
  it("filters by type + source combined", () => {
    const result = filterEntries(entries, { ...DEFAULT_FILTERS, type: "color", source: "figma" });
    expect(result).toHaveLength(4);
    expect(result.every((e) => e.token.type === "color" && e.origin === "figma")).toBe(true);
  });

  it("filters by named/unnamed (all fixture tokens are unnamed)", () => {
    expect(filterEntries(entries, { ...DEFAULT_FILTERS, named: "unnamed" })).toHaveLength(40);
    expect(filterEntries(entries, { ...DEFAULT_FILTERS, named: "named" })).toHaveLength(0);
  });

  it("flagged-only respects the provided flag set (empty until Phase 3)", () => {
    expect(filterEntries(entries, { ...DEFAULT_FILTERS, flagged: "flagged" })).toHaveLength(0);
    const flagged = filterEntries(
      entries,
      { ...DEFAULT_FILTERS, flagged: "flagged" },
      new Set(["ext_001", "fig_001"]),
    );
    expect(flagged.map((e) => e.token.id).sort()).toEqual(["ext_001", "fig_001"]);
  });

  it("searches across value, source, and authoredName", () => {
    // #2E6BFF appears as a color in both fixtures and as a hero gradient stop.
    expect(filterEntries(entries, { ...DEFAULT_FILTERS, search: "#2E6BFF" })).toHaveLength(3);
    expect(filterEntries(entries, { ...DEFAULT_FILTERS, search: "color/action" })).toHaveLength(1);
    expect(
      filterEntries(entries, { ...DEFAULT_FILTERS, search: "uppercase" }).map((e) => e.token.id),
    ).toEqual(["ext_018"]);
  });
});

describe('"same element" capture groups (FR-8)', () => {
  it("lists captureIds carrying 2+ tokens, biggest first", () => {
    const groups = captureGroups(entries);
    // cap-card-1 and cap-hero-1 both carry 5 tokens; alphabetical tie-break.
    expect(groups.slice(0, 2)).toEqual([
      { captureId: "cap-card-1", count: 5 },
      { captureId: "cap-hero-1", count: 5 },
    ]);
    expect(groups.every((g) => g.count >= 2)).toBe(true);
    // Singleton captures (e.g. the standalone alert) never show up.
    expect(groups.some((g) => g.captureId === "cap-alert-1")).toBe(false);
  });

  it("filters the workspace to one element's tokens", () => {
    const result = filterEntries(entries, { ...DEFAULT_FILTERS, captureId: "cap-btn-1" });
    expect(result.map((e) => e.token.id)).toEqual(["ext_001", "ext_005", "ext_019", "ext_027"]);
  });
});
