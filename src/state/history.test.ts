import { describe, expect, it } from "vitest";
import { editDerived, emptyPool, type TokenPool } from "./pool";
import type { ColorToken } from "../contract/types";
import {
  canRedoHistory,
  canUndoHistory,
  emptyHistory,
  MAX_HISTORY,
  peekRedoLabel,
  peekUndoLabel,
  pushHistory,
  redoHistory,
  undoHistory,
} from "./history";

const pool = (tag: string): TokenPool => ({ ...emptyPool(), projectName: tag });

describe("history", () => {
  it("pushes, undoes, and redoes in order", () => {
    const a = pool("a");
    const b = pool("b");
    const c = pool("c");
    let h = pushHistory(emptyHistory(), a, b, "first", false);
    h = pushHistory(h, b, c, "second", false);

    expect(peekUndoLabel(h, false)).toBe("second");
    const u1 = undoHistory(h, c, false)!;
    expect(u1.pool.projectName).toBe("b");
    h = u1.history;

    const r1 = redoHistory(h, b, false)!;
    expect(r1.pool.projectName).toBe("c");
    h = r1.history;

    const u2 = undoHistory(h, c, false)!;
    expect(u2.pool.projectName).toBe("b");
  });

  it("redo restores the after snapshot, not the before snapshot", () => {
    const before = pool("before");
    const after = pool("after");
    let h = pushHistory(emptyHistory(), before, after, "edit", false);
    const undone = undoHistory(h, after, false)!;
    expect(undone.pool.projectName).toBe("before");
    expect(canRedoHistory(undone.history, false)).toBe(true);

    const redone = redoHistory(undone.history, before, false)!;
    expect(redone.pool.projectName).toBe("after");
  });

  it("clears future on a new push", () => {
    const a = pool("a");
    const b = pool("b");
    const c = pool("c");
    let h = pushHistory(emptyHistory(), a, b, "one", false);
    h = pushHistory(h, b, c, "two", false);
    const undone = undoHistory(h, c, false)!;
    h = pushHistory(undone.history, undone.pool, pool("d"), "three", false);
    expect(h.future).toHaveLength(0);
    expect(canRedoHistory(h, false)).toBe(false);
  });

  it("caps the stack at MAX_HISTORY", () => {
    let h = emptyHistory();
    let before = pool("0");
    for (let i = 1; i <= MAX_HISTORY + 5; i++) {
      const after = pool(String(i));
      h = pushHistory(h, before, after, `step ${i}`, false);
      before = after;
    }
    expect(h.past).toHaveLength(MAX_HISTORY);
  });

  it("skips merge steps when the system is locked", () => {
    const start = pool("start");
    const edited = pool("edited");
    const merged = pool("merged");
    let h = pushHistory(emptyHistory(), start, edited, "edit color", false);
    h = pushHistory(h, edited, merged, "merge blues", true);

    expect(canUndoHistory(h, true)).toBe(true);
    expect(peekUndoLabel(h, true)).toBe("edit color");

    const u = undoHistory(h, merged, true)!;
    expect(u.pool.projectName).toBe("start");
    expect(peekRedoLabel(u.history, true)).toBe("edit color");
  });

  it("allows merge undo before finalize", () => {
    const h = pushHistory(emptyHistory(), pool("a"), pool("b"), "merge", true);
    const u = undoHistory(h, pool("b"), false)!;
    expect(u.pool.projectName).toBe("a");
  });

  it("round-trips derivedEdits through undo and redo", () => {
    const token: ColorToken = {
      id: "derived_color_action_primary_hover",
      captureId: "derived",
      source: "derived",
      name: null,
      occurrences: 1,
      merged: false,
      type: "color",
      value: "#FF0000",
      opacity: 1,
    };
    const before = emptyPool();
    const after = editDerived(before, "color/action/primary-hover", token, "t");

    let h = pushHistory(emptyHistory(), before, after, "edit hover", false);
    const undone = undoHistory(h, after, false)!;
    expect(undone.pool.derivedEdits?.["color/action/primary-hover"]).toBeUndefined();

    const redone = redoHistory(undone.history, undone.pool, false)!;
    expect(redone.pool.derivedEdits?.["color/action/primary-hover"]?.token.value).toBe("#FF0000");
  });
});
