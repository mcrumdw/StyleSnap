// Session undo/redo — decision-level history for the token pool.
// History is session-only (not persisted to localStorage).

import type { TokenPool } from "./pool";

export const MAX_HISTORY = 50;

/** One reversible user action — explicit before/after snapshots. */
export type HistoryEntry = {
  before: TokenPool;
  after: TokenPool;
  label: string;
  /** When the system is finalized, merge-related steps cannot be undone. */
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

function skippable(entry: HistoryEntry, locked: boolean): boolean {
  return locked && entry.affectsMerges;
}

export function peekUndoLabel(history: HistoryState, locked: boolean): string | null {
  for (let i = history.past.length - 1; i >= 0; i--) {
    const entry = history.past[i]!;
    if (!skippable(entry, locked)) return entry.label;
  }
  return null;
}

export function peekRedoLabel(history: HistoryState, locked: boolean): string | null {
  for (const entry of history.future) {
    if (!skippable(entry, locked)) return entry.label;
  }
  return null;
}

export function canUndoHistory(history: HistoryState, locked: boolean): boolean {
  return peekUndoLabel(history, locked) !== null;
}

export function canRedoHistory(history: HistoryState, locked: boolean): boolean {
  return peekRedoLabel(history, locked) !== null;
}

export function undoHistory(
  history: HistoryState,
  _current: TokenPool,
  locked: boolean,
): { history: HistoryState; pool: TokenPool } | null {
  const past = [...history.past];
  while (past.length > 0) {
    const entry = past.pop()!;
    if (skippable(entry, locked)) continue;
    return {
      history: { past, future: [entry, ...history.future] },
      pool: entry.before,
    };
  }
  return null;
}

export function redoHistory(
  history: HistoryState,
  _current: TokenPool,
  locked: boolean,
): { history: HistoryState; pool: TokenPool } | null {
  const future = [...history.future];
  while (future.length > 0) {
    const entry = future.shift()!;
    if (skippable(entry, locked)) continue;
    return {
      history: { past: [...history.past, entry], future },
      pool: entry.after,
    };
  }
  return null;
}
