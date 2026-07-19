import { describe, expect, it } from "vitest";
import { editDerived, emptyPool, type TokenPool } from "./pool";
import type { ColorToken } from "../contract/types";
import {
  canRedoHistory,
  canUndoHistory,
  emptyHistory,
  MAX_HISTORY,
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

  it("undoes and redoes three commits one step at a time", () => {
    const p0 = pool("0");
    const p1 = pool("1");
    const p2 = pool("2");
    const p3 = pool("3");
    let h = pushHistory(emptyHistory(), p0, p1, "one", false);
    h = pushHistory(h, p1, p2, "two", false);
    h = pushHistory(h, p2, p3, "three", false);

    const u1 = undoHistory(h, p3, false)!;
    expect(u1.pool.projectName).toBe("2");
    expect(peekUndoLabel(u1.history, false)).toBe("two");

    const u2 = undoHistory(u1.history, u1.pool, false)!;
    expect(u2.pool.projectName).toBe("1");

    const u3 = undoHistory(u2.history, u2.pool, false)!;
    expect(u3.pool.projectName).toBe("0");
    expect(canUndoHistory(u3.history, false)).toBe(false);

    const r1 = redoHistory(u3.history, u3.pool, false)!;
    expect(r1.pool.projectName).toBe("1");
    const r2 = redoHistory(r1.history, r1.pool, false)!;
    expect(r2.pool.projectName).toBe("2");
    const r3 = redoHistory(r2.history, r2.pool, false)!;
    expect(r3.pool.projectName).toBe("3");
    expect(canRedoHistory(r3.history, false)).toBe(false);
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

  it("blocks undo when locked and the top step affects merges (barrier)", () => {
    const start = pool("start");
    const edited = pool("edited");
    const merged = pool("merged");
    let h = pushHistory(emptyHistory(), start, edited, "edit color", false);
    h = pushHistory(h, edited, merged, "merge blues", true);

    expect(canUndoHistory(h, true)).toBe(false);
    expect(peekUndoLabel(h, true)).toBeNull();
    expect(undoHistory(h, merged, true)).toBeNull();
    // Unlocked still undoes the merge one step.
    expect(canUndoHistory(h, false)).toBe(true);
    expect(undoHistory(h, merged, false)!.pool.projectName).toBe("edited");
  });

  it("locked: undoes a non-merge edit above a merge barrier, then stops", () => {
    const start = pool("start");
    const edited = pool("edited");
    const merged = pool("merged");
    const edited2 = pool("edited2");
    let h = pushHistory(emptyHistory(), start, edited, "edit color", false);
    h = pushHistory(h, edited, merged, "merge blues", true);
    h = pushHistory(h, merged, edited2, "edit again", false);

    expect(peekUndoLabel(h, true)).toBe("edit again");
    const u1 = undoHistory(h, edited2, true)!;
    expect(u1.pool.projectName).toBe("merged");
    expect(canUndoHistory(u1.history, true)).toBe(false);
    expect(undoHistory(u1.history, u1.pool, true)).toBeNull();
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
