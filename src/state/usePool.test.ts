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
});
