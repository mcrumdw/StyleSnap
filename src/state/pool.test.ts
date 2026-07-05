import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../contract/schema";
import type { StyleSnapExport } from "../contract/types";
import {
  addManualToken,
  appendImport,
  assignRole,
  createSystem,
  defaultProjectName,
  deserializeDraft,
  emptyPool,
  importLabel,
  isSystemCreated,
  poolTokenCount,
  poolTokens,
  removeManualToken,
  resolveAssignments,
  serializeDraft,
  setDecision,
  setProjectName,
  unassignRole,
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

describe("decisions (FR-16 — nothing finalizes without confirmation)", () => {
  it("stores and clears per-token names", () => {
    let pool = emptyPool();
    pool = setDecision(pool, "t1", { name: "color/brand-blue" });
    expect(pool.decisions.t1).toEqual({ name: "color/brand-blue" });
    pool = setDecision(pool, "t1", { name: undefined });
    expect(pool.decisions.t1).toBeUndefined();
  });
});

describe("role assignments (Phase 8 — roles point at primitives)", () => {
  it("one primitive can carry several roles; removing one leaves the other", () => {
    let pool = emptyPool();
    pool = assignRole(pool, "color/action/primary", "green_1");
    pool = assignRole(pool, "color/text/link", "green_1");
    expect(pool.assignments).toEqual({
      "color/action/primary": "green_1",
      "color/text/link": "green_1",
    });
    pool = unassignRole(pool, "color/text/link");
    expect(pool.assignments).toEqual({ "color/action/primary": "green_1" });
  });

  it("reassigning a role moves it — a role has exactly one primitive", () => {
    let pool = emptyPool();
    pool = assignRole(pool, "color/action/primary", "blue_1");
    pool = assignRole(pool, "color/action/primary", "blue_2");
    expect(pool.assignments["color/action/primary"]).toBe("blue_2");
  });

  it("merge remaps assignments to the survivor; un-merge restores them", () => {
    let pool = emptyPool();
    pool = assignRole(pool, "color/text/link", "ext_002");
    pool = assignRole(pool, "color/action/primary", "ext_001");

    // ext_002 is absorbed into ext_001 — the link role follows the survivor.
    const merge = { survivorId: "ext_001", mergedIds: ["ext_002"], mergedAt: "t" };
    expect(resolveAssignments(pool.assignments, [merge])).toEqual({
      "color/text/link": "ext_001",
      "color/action/primary": "ext_001",
    });
    // Un-merge (the record is removed) — the original target comes back.
    expect(resolveAssignments(pool.assignments, [])).toEqual({
      "color/text/link": "ext_002",
      "color/action/primary": "ext_001",
    });
  });

  it("resolution follows merge chains", () => {
    const assignments = { "space/md": "a" };
    const chain = [
      { survivorId: "b", mergedIds: ["a"], mergedAt: "t1" },
      { survivorId: "c", mergedIds: ["b"], mergedAt: "t2" },
    ];
    expect(resolveAssignments(assignments, chain)).toEqual({ "space/md": "c" });
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

  it("round-trips projectName + systemCreatedAt; derives a default name", () => {
    let pool = poolWithBothFixtures();
    expect(defaultProjectName(pool)).toBe("Lumen Design v3"); // figma file wins
    expect(isSystemCreated(pool)).toBe(false);

    pool = setProjectName(pool, "Lumen");
    pool = createSystem(pool, "2026-07-04T12:00:00Z");
    const restored = deserializeDraft(serializeDraft(pool));
    expect(restored?.projectName).toBe("Lumen");
    expect(restored?.systemCreatedAt).toBe("2026-07-04T12:00:00Z");
    expect(isSystemCreated(restored!)).toBe(true);
  });

  it("round-trips manual tokens; removal cleans decisions, merges, assignments", () => {
    let pool = poolWithBothFixtures();
    pool = addManualToken(pool, {
      id: "manual_1",
      captureId: "manual-1",
      source: "manual entry",
      name: null,
      occurrences: 1,
      merged: false,
      type: "color",
      value: "#5B2EFF",
      opacity: 1,
    });
    pool = assignRole(pool, "color/border/focus", "manual_1");
    expect(deserializeDraft(serializeDraft(pool))).toEqual(pool);

    pool = removeManualToken(pool, "manual_1");
    expect(pool.manual).toHaveLength(0);
    expect(pool.assignments["color/border/focus"]).toBeUndefined();

    const legacy = JSON.parse(serializeDraft(poolWithBothFixtures()));
    delete legacy.manual;
    expect(deserializeDraft(JSON.stringify(legacy))?.manual).toEqual([]);
  });

  it("round-trips names + assignments; legacy drafts get empty maps", () => {
    let pool = poolWithBothFixtures();
    pool = setDecision(pool, "ext_008", { name: "color/gray-500" });
    pool = assignRole(pool, "color/action/primary", "ext_001");
    expect(deserializeDraft(serializeDraft(pool))).toEqual(pool);

    const legacy = JSON.parse(serializeDraft(poolWithBothFixtures()));
    delete legacy.decisions;
    delete legacy.assignments;
    const restored = deserializeDraft(JSON.stringify(legacy));
    expect(restored?.decisions).toEqual({});
    expect(restored?.assignments).toEqual({});
  });

  it("migrates pre-Phase-8 drafts: decisions[id].role → assignments[role] = id", () => {
    const legacy = JSON.parse(serializeDraft(poolWithBothFixtures()));
    legacy.decisions = {
      ext_001: { role: "color/action/primary", name: "color/brand-blue" },
      ext_006: { role: "color/text/primary" },
      ext_008: { role: null, name: "color/gray-500" }, // explicit "no role"
    };
    delete legacy.assignments;
    const restored = deserializeDraft(JSON.stringify(legacy));
    expect(restored?.assignments).toEqual({
      "color/action/primary": "ext_001",
      "color/text/primary": "ext_006",
    });
    // Names survive; the old role field is gone.
    expect(restored?.decisions).toEqual({
      ext_001: { name: "color/brand-blue" },
      ext_008: { name: "color/gray-500" },
    });
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
