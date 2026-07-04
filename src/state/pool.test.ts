import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../contract/schema";
import type { StyleSnapExport } from "../contract/types";
import {
  appendImport,
  deserializeDraft,
  emptyPool,
  importLabel,
  poolTokenCount,
  poolTokens,
  serializeDraft,
} from "./pool";

const fixture = (name: string) =>
  readFileSync(new URL(`../../docs/fixtures/${name}`, import.meta.url), "utf-8");

function parsedFixture(name: string): StyleSnapExport {
  const result = parseStyleSnapExport(fixture(name));
  if (!result.ok) throw new Error(`fixture ${name} should parse`);
  return result.data;
}

function poolWithBothFixtures() {
  let pool = emptyPool();
  pool = appendImport(pool, parsedFixture("capture-browser-messy.json"), {
    importId: "imp-1",
    importedAt: "2026-07-04T10:00:00Z",
  });
  pool = appendImport(pool, parsedFixture("capture-figma-clean.json"), {
    importId: "imp-2",
    importedAt: "2026-07-04T10:01:00Z",
  });
  return pool;
}

describe("token pool (FR-3)", () => {
  it("appends both good fixtures into one pool: 31 + 9 tokens", () => {
    const pool = poolWithBothFixtures();
    expect(pool.imports).toHaveLength(2);
    expect(pool.imports[0].tokens).toHaveLength(31);
    expect(pool.imports[1].tokens).toHaveLength(9);
    expect(poolTokenCount(pool)).toBe(40);
    expect(poolTokens(pool)).toHaveLength(40);
  });

  it("preserves provenance: meta.source, source, captureId, occurrences", () => {
    const pool = poolWithBothFixtures();
    expect(pool.imports[0].meta.source).toBe("browser-extension");
    expect(pool.imports[1].meta.source).toBe("figma");
    const token = pool.imports[0].tokens[0];
    expect(token.source).toBeTruthy();
    expect(token.captureId).toBeTruthy();
    expect(token.occurrences).toBeGreaterThanOrEqual(1);
  });

  it("appendImport is pure — the original pool is untouched", () => {
    const before = emptyPool();
    appendImport(before, parsedFixture("capture-figma-clean.json"), {
      importId: "imp-x",
      importedAt: "2026-07-04T10:00:00Z",
    });
    expect(before.imports).toHaveLength(0);
  });

  it("labels imports from their meta", () => {
    const pool = poolWithBothFixtures();
    expect(importLabel(pool.imports[0].meta)).toContain("browser extension");
    expect(importLabel(pool.imports[1].meta)).toContain("Figma");
  });
});

describe("malformed capture (FR-2 acceptance)", () => {
  it("is rejected with the friendly error and its 4 specific issues", () => {
    const result = parseStyleSnapExport(fixture("capture-malformed.json"));
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(
        "That doesn't look like a StyleSnap capture. Mind checking the file?",
      );
      expect(result.details).toHaveLength(4);
    }
  });
});

describe("version mismatch (FR-4)", () => {
  it("imports with a warning instead of rejecting", () => {
    const raw = JSON.parse(fixture("capture-figma-clean.json"));
    raw.meta.version = "1.0";
    const result = parseStyleSnapExport(JSON.stringify(raw));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.versionWarning).toContain("v1.0");
      expect(result.versionWarning).toContain("v2.0");
    }
  });
});

describe("localStorage draft (FR-29)", () => {
  it("round-trips the pool exactly", () => {
    const pool = poolWithBothFixtures();
    const restored = deserializeDraft(serializeDraft(pool));
    expect(restored).toEqual(pool);
  });

  it("round-trips merges and accepts pre-Phase-3 drafts without them", () => {
    const pool = {
      ...poolWithBothFixtures(),
      merges: [{ survivorId: "ext_001", mergedIds: ["ext_002"], mergedAt: "2026-07-04T12:00:00Z" }],
    };
    expect(deserializeDraft(serializeDraft(pool))).toEqual(pool);

    const legacy = JSON.parse(serializeDraft(poolWithBothFixtures()));
    delete legacy.merges;
    expect(deserializeDraft(JSON.stringify(legacy))?.merges).toEqual([]);
  });

  it("returns null for a missing, corrupt, or invalid draft — never throws", () => {
    expect(deserializeDraft(null)).toBeNull();
    expect(deserializeDraft("not json {")).toBeNull();
    expect(deserializeDraft('{"something":"else"}')).toBeNull();
    // Structurally a pool, but with a token that violates the contract.
    const bad = {
      imports: [
        {
          importId: "imp-1",
          importedAt: "2026-07-04T10:00:00Z",
          meta: {
            source: "figma",
            exportedAt: "2026-07-03T14:22:00Z",
            version: "2.0",
          },
          tokens: [{ id: "x", type: "color", value: "not-a-hex" }],
        },
      ],
    };
    expect(deserializeDraft(JSON.stringify(bad))).toBeNull();
  });
});
