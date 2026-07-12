import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ColorToken } from "../contract/types";
import { parseStyleSnapExport } from "../contract/schema";
import { applyMerges } from "../engine/dedup";
import { deriveSystem } from "../engine/derive-system";
import { editDerived, poolTokens, type TokenPool } from "./pool";
import { emptyHistory, type HistoryState, canRedoHistory, canUndoHistory } from "./history";
import { poolReducer } from "./usePool";
import { buildRoleDisplayTokens, type DraftFill } from "./useSessionViewModel";
import { poolEntries } from "./workspace";

function poolFromFixture(name: string): TokenPool {
  const raw = readFileSync(new URL(`../../docs/fixtures/${name}`, import.meta.url), "utf-8");
  const parsed = parseStyleSnapExport(raw);
  if (!parsed.ok) throw new Error(`fixture ${name} failed`);
  return {
    imports: [
      {
        importId: "test",
        importedAt: "2026-07-10T12:00:00Z",
        meta: parsed.data.meta,
        tokens: parsed.data.tokens,
      },
    ],
    merges: [],
    decisions: {},
    assignments: {},
    manual: [],
  };
}

/** Mirrors useSessionViewModel draftFills + effective token overlay — keep in sync. */
function roleColor(pool: TokenPool, role: string) {
  const entries = poolEntries(pool);
  const tokens = applyMerges(entries, pool.merges).map((e) => e.token);
  const rawById = new Map(poolTokens(pool).map((t) => [t.id, t]));
  const draft = deriveSystem({ tokens, rawById, assignments: new Map(Object.entries(pool.assignments)) });
  const draftFills = draft.fills.map((fill) => {
    const edit = pool.derivedEdits?.[fill.role];
    if (edit) {
      return { ...fill, token: edit.token, origin: "edited" as const };
    }
    const synthetic = fill.token.id.startsWith("derived_");
    return { ...fill, origin: synthetic ? ("derived" as const) : ("captured" as const) };
  });
  const rolesWithFill = new Set(draftFills.map((f) => f.role));
  for (const [r, edit] of Object.entries(pool.derivedEdits ?? {})) {
    if (rolesWithFill.has(r)) continue;
    draftFills.push({
      role: r,
      token: edit.token,
      origin: "edited" as const,
      derivedFrom: edit.token.id,
      method: "user edit",
    });
  }

  const tokenById = new Map(tokens.map((t) => [t.id, t]));
  const assignments = new Map(Object.entries(pool.assignments));
  for (const fill of draftFills) {
    assignments.set(fill.role, fill.token.id);
    tokenById.set(fill.token.id, fill.token);
  }
  const effectiveTokens: typeof tokens = [];
  const seen = new Set<string>();
  for (const token of tokens) {
    effectiveTokens.push(tokenById.get(token.id) ?? token);
    seen.add(token.id);
  }
  for (const fill of draftFills) {
    if (!seen.has(fill.token.id)) {
      effectiveTokens.push(tokenById.get(fill.token.id)!);
      seen.add(fill.token.id);
    }
  }

  const fill = draftFills.find((f) => f.role === role);
  const id = assignments.get(role) ?? fill?.token.id;
  const system = effectiveTokens.find((t) => t.id === id);
  return {
    draft: fill?.token.type === "color" ? fill.token.value : null,
    system: system?.type === "color" ? system.value : null,
    roleToken: fill?.token.type === "color" ? fill.token.value : null,
  };
}

function hoverColors(pool: TokenPool) {
  return roleColor(pool, "color/action/primary-hover");
}

describe("derivedEdits overlay", () => {
  it("applies edits for derived fills regardless of token id prefix", () => {
    const pool = poolFromFixture("capture-test-drive.json");
    const original = hoverColors(pool).system;
    const entries = poolEntries(pool);
    const tokens = applyMerges(entries, pool.merges).map((e) => e.token);
    const rawById = new Map(poolTokens(pool).map((t) => [t.id, t]));
    const draft = deriveSystem({ tokens, rawById, assignments: new Map() });
    const token = draft.fills.find((f) => f.role === "color/action/primary-hover")!.token as ColorToken;

    const edited = editDerived(
      pool,
      "color/action/primary-hover",
      { ...token, value: "#ABCDEF" },
      "2026-07-10T12:00:00Z",
    );

    const colors = hoverColors(edited);
    expect(colors.draft).toBe("#ABCDEF");
    expect(colors.system).toBe("#ABCDEF");
    expect(colors.system).not.toBe(original);
  });

  it("undo/redo round-trip updates both draftFills and systemTokens", () => {
    const role = "color/action/primary-hover";
    const pool = poolFromFixture("capture-test-drive.json");
    const entries = poolEntries(pool);
    const tokens = applyMerges(entries, pool.merges).map((e) => e.token);
    const rawById = new Map(poolTokens(pool).map((t) => [t.id, t]));
    const draft = deriveSystem({ tokens, rawById, assignments: new Map() });
    const token = draft.fills.find((f) => f.role === role)!.token as ColorToken;
    const original = hoverColors(pool).system;

    let state: { pool: TokenPool; history: HistoryState } = {
      pool,
      history: emptyHistory(),
    };
    state = poolReducer(state, {
      type: "commit",
      updater: (current) =>
        editDerived(current, role, { ...token, value: "#ABCDEF" }, "2026-07-10T12:00:00Z"),
      label: "edit",
      affectsMerges: false,
    });
    expect(hoverColors(state.pool).system).toBe("#ABCDEF");

    state = poolReducer(state, { type: "undo", locked: false });
    expect(hoverColors(state.pool).system).toBe(original);

    state = poolReducer(state, { type: "redo", locked: false });
    expect(hoverColors(state.pool).system).toBe("#ABCDEF");
  });

  it("color/text/muted edit shows in draftFills and systemTokens immediately", () => {
    const role = "color/text/muted";
    const pool = poolFromFixture("capture-ember-app.json");
    const entries = poolEntries(pool);
    const tokens = applyMerges(entries, pool.merges).map((e) => e.token);
    const rawById = new Map(poolTokens(pool).map((t) => [t.id, t]));
    const draft = deriveSystem({ tokens, rawById, assignments: new Map() });
    const token = draft.fills.find((f) => f.role === role)!.token as ColorToken;
    const edited = editDerived(pool, role, { ...token, value: "#A1B2C3" }, "2026-07-10T12:00:00Z");

    const colors = roleColor(edited, role);
    expect(colors.draft).toBe("#A1B2C3");
    expect(colors.roleToken).toBe("#A1B2C3");
    expect(colors.system).toBe("#A1B2C3");
  });

  it("color/text/primary edit is visible via roleDisplayTokens immediately after commit", () => {
    const role = "color/text/primary";
    const pool = poolFromFixture("capture-ember-app.json");
    const entries = poolEntries(pool);
    const tokens = applyMerges(entries, pool.merges).map((e) => e.token);
    const rawById = new Map(poolTokens(pool).map((t) => [t.id, t]));
    const draft = deriveSystem({ tokens, rawById, assignments: new Map() });
    const token = draft.fills.find((f) => f.role === role)!.token as ColorToken;

    let state: { pool: TokenPool; history: HistoryState } = {
      pool,
      history: emptyHistory(),
    };
    state = poolReducer(state, {
      type: "commit",
      updater: (current) =>
        editDerived(current, role, { ...token, value: "#112233" }, "2026-07-10T12:00:00Z"),
      label: "edit text primary",
      affectsMerges: false,
    });

    const colors = roleColor(state.pool, role);
    expect(colors.system).toBe("#112233");
    expect(canUndoHistory(state.history, false)).toBe(true);
    expect(canRedoHistory(state.history, false)).toBe(false);

    const draftFills: DraftFill[] = draft.fills.map((fill) => {
      const edit = state.pool.derivedEdits?.[fill.role];
      if (edit) {
        return { ...fill, token: edit.token, origin: "edited" as const };
      }
      const synthetic = fill.token.id.startsWith("derived_");
      return { ...fill, origin: synthetic ? ("derived" as const) : ("captured" as const) };
    });
    const display = buildRoleDisplayTokens(draftFills, state.pool.derivedEdits);
    expect(display.get(role)?.value).toBe("#112233");
  });
});
