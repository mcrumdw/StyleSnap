// Session undo/redo — decision-level history for the token pool.
// History is session-only (not persisted to localStorage).

import type { TokenPool } from "./pool";

export const MAX_HISTORY = 50;

/** One reversible user action — explicit before/after snapshots. */
export type HistoryEntry = {
  before: TokenPool;
  after: TokenPool;
  label: string;
  /** When the system is finalized, merge-related steps cannot be undone (barrier). */
  affectsMerges: boolean;
};

export type HistoryState = {
  past: HistoryEntry[];
  future: HistoryEntry[];
};

export function emptyHistory(): HistoryState {
  return { past: [], future: [] };
}

export function pushHistory(
  history: HistoryState,
  before: TokenPool,
  after: TokenPool,
  label: string,
  affectsMerges: boolean,
): HistoryState {
  const past = [...history.past, { before, after, label, affectsMerges }].slice(-MAX_HISTORY);
  return { past, future: [] };
}

/** After Create System, merge frames block undo/redo — they are not skipped-over. */
function isBarrier(entry: HistoryEntry, locked: boolean): boolean {
  return locked && entry.affectsMerges;
}

export function peekUndoLabel(history: HistoryState, locked: boolean): string | null {
  const top = history.past[history.past.length - 1];
  if (!top || isBarrier(top, locked)) return null;
  return top.label;
}

export function peekRedoLabel(history: HistoryState, locked: boolean): string | null {
  const next = history.future[0];
  if (!next || isBarrier(next, locked)) return null;
  return next.label;
}

export function canUndoHistory(history: HistoryState, locked: boolean): boolean {
  return peekUndoLabel(history, locked) !== null;
}

export function canRedoHistory(history: HistoryState, locked: boolean): boolean {
  return peekRedoLabel(history, locked) !== null;
}

/**
 * Undo one committed step. When locked, a merge-related top frame is a barrier
 * (returns null) — never jump under it to an older snapshot.
 */
export function undoHistory(
  history: HistoryState,
  _current: TokenPool,
  locked: boolean,
): { history: HistoryState; pool: TokenPool } | null {
  const top = history.past[history.past.length - 1];
  if (!top || isBarrier(top, locked)) return null;
  const past = history.past.slice(0, -1);
  return {
    history: { past, future: [top, ...history.future] },
    pool: top.before,
  };
}

/**
 * Redo one committed step. When locked, a merge-related next frame is a barrier.
 */
export function redoHistory(
  history: HistoryState,
  _current: TokenPool,
  locked: boolean,
): { history: HistoryState; pool: TokenPool } | null {
  const next = history.future[0];
  if (!next || isBarrier(next, locked)) return null;
  const future = history.future.slice(1);
  return {
    history: { past: [...history.past, next], future },
    pool: next.after,
  };
}
