import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { ColorToken } from "../contract/types";
import { parseStyleSnapExport } from "../contract/schema";
import { applyMerges } from "../engine/dedup";
import { deriveSystem } from "../engine/derive-system";
import { editDerived, emptyPool, poolTokens, type TokenPool } from "./pool";
import { emptyHistory, type HistoryState } from "./history";
import { poolReducer } from "./usePool";
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

function hoverColor(pool: ReturnType<typeof poolFromFixture>) {
  const entries = poolEntries(pool);
  const tokens = applyMerges(entries, pool.merges).map((e) => e.token);
  const rawById = new Map(poolTokens(pool).map((t) => [t.id, t]));
  const draft = deriveSystem({ tokens, rawById, assignments: new Map() });
  const fill = draft.fills.find((f) => f.role === "color/action/primary-hover");
  expect(fill).toBeDefined();
  return fill!.token as ColorToken;
}

describe("poolReducer undo/redo", () => {
  it("undoes a color edit then redoes it", () => {
    const role = "color/action/primary-hover";
    const pool = poolFromFixture("capture-test-drive.json");
    const token = hoverColor(pool);
    const original = token.value;
    const editedAt = "2026-07-10T12:00:00Z";

    let state: { pool: TokenPool; history: HistoryState } = {
      pool,
      history: emptyHistory(),
    };
    state = poolReducer(state, {
      type: "commit",
      updater: (current) =>
        editDerived(current, role, { ...token, value: "#ABCDEF" }, editedAt),
      label: "Change hover color",
      affectsMerges: false,
    });

    expect(state.pool.derivedEdits?.[role]?.token.value).toBe("#ABCDEF");
    expect(state.history.past).toHaveLength(1);

    state = poolReducer(state, { type: "undo", locked: false });
    expect(state.pool.derivedEdits?.[role]).toBeUndefined();
    expect(state.history.future).toHaveLength(1);

    state = poolReducer(state, { type: "redo", locked: false });
    expect(state.pool.derivedEdits?.[role]?.token.value).toBe("#ABCDEF");

    // Sanity: the original derived value is not the edited one.
    expect(original).not.toBe("#ABCDEF");
  });

  it("starts from an empty pool without crashing", () => {
    const state = poolReducer(
      { pool: emptyPool(), history: { past: [], future: [] } },
      { type: "undo", locked: false },
    );
    expect(state.pool).toEqual(emptyPool());
  });

  it("undoes an un-merge when the system is not locked", () => {
    const messy = poolFromFixture("capture-browser-messy.json");
    let state: { pool: TokenPool; history: HistoryState } = {
      pool: messy,
      history: emptyHistory(),
    };
    // Simulate import auto-merge by committing a merge, then un-merge + undo.
    const colors = messy.imports[0]!.tokens.filter((t) => t.type === "color");
    const survivorId = colors[0]!.id;
    const mergedIds = colors.slice(1, 3).map((t) => t.id);
    state = poolReducer(state, {
      type: "commit",
      updater: (current) => ({
        ...current,
        merges: [
          {
            survivorId,
            mergedIds,
            mergedAt: "2026-07-19T12:00:00Z",
          },
        ],
      }),
      label: "Merge colors",
      affectsMerges: true,
    });
    expect(state.pool.merges).toHaveLength(1);

    state = poolReducer(state, {
      type: "commit",
      updater: (current) => ({
        ...current,
        merges: current.merges.filter((m) => m.survivorId !== survivorId),
      }),
      label: "Un-merge tokens",
      affectsMerges: true,
    });
    expect(state.pool.merges).toHaveLength(0);

    state = poolReducer(state, { type: "undo", locked: false });
    expect(state.pool.merges).toHaveLength(1);
    expect(state.pool.merges[0]!.survivorId).toBe(survivorId);

    // Locked (Create System) blocks undoing the merge-affecting step.
    state = poolReducer(state, {
      type: "commit",
      updater: (current) => ({
        ...current,
        merges: current.merges.filter((m) => m.survivorId !== survivorId),
      }),
      label: "Un-merge tokens",
      affectsMerges: true,
    });
    const locked = poolReducer(state, { type: "undo", locked: true });
    expect(locked.pool.merges).toHaveLength(0);
  });
});
