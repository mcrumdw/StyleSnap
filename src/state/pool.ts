// StyleSnap — Token pool (Phase 1)
//
// The pool is the session's working set: every accepted import appended in
// order (PRD FR-3), each keeping its own `meta` so provenance (meta.source,
// figmaFile / pageUrl) survives all the way to export. Tokens are never
// mutated here — dedup/merge (Phase 3) builds on top of this.
//
// Everything in this file is a pure function so it can be unit-tested without
// React or a browser.

import { styleSnapExportSchema } from "../contract/schema";
import type { StyleSnapExport, StyleSnapMeta, StyleSnapToken } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";

export interface PoolImport {
  /** Unique per import action (not per capture file — the same file can be imported twice). */
  importId: string;
  /** When the user imported it, ISO 8601. */
  importedAt: string;
  meta: StyleSnapMeta;
  tokens: StyleSnapToken[];
}

/**
 * A user decision about one token (Phase 4). Suggestions are always computed
 * live from the engine; ONLY explicit decisions persist here — that is what
 * "nothing finalizes without confirmation" (FR-16) means in the data model.
 */
export interface TokenDecision {
  /** Confirmed role; `null` = user explicitly chose "no role (primitive)". */
  role?: string | null;
  /** User-assigned slash-nested name (FR-21). */
  name?: string;
}

export interface TokenPool {
  imports: PoolImport[];
  /** User-confirmed merges (Phase 3) — applied as a view, reversible until Create System. */
  merges: MergeRecord[];
  /** Confirmed roles + names per token id (Phase 4). */
  decisions: Record<string, TokenDecision>;
}

export function emptyPool(): TokenPool {
  return { imports: [], merges: [], decisions: {} };
}

/** Append a validated export to the pool. Pure — returns a new pool. */
export function appendImport(
  pool: TokenPool,
  data: StyleSnapExport,
  stamp: { importId: string; importedAt: string },
): TokenPool {
  return {
    ...pool,
    imports: [
      ...pool.imports,
      { importId: stamp.importId, importedAt: stamp.importedAt, meta: data.meta, tokens: data.tokens },
    ],
  };
}

/** Record a user-confirmed merge (FR-12). Pure — returns a new pool. */
export function addMerge(pool: TokenPool, merge: MergeRecord): TokenPool {
  return { ...pool, merges: [...pool.merges, merge] };
}

/** Un-merge (FR-13): drop the record; the view restores itself exactly. */
export function removeMerge(pool: TokenPool, survivorId: string): TokenPool {
  return { ...pool, merges: pool.merges.filter((m) => m.survivorId !== survivorId) };
}

/**
 * Set or clear one field of a token's decision. `undefined` removes the field
 * (falls back to the live suggestion); empty decisions are dropped entirely.
 */
export function setDecision(
  pool: TokenPool,
  tokenId: string,
  patch: TokenDecision,
): TokenPool {
  const next: TokenDecision = { ...pool.decisions[tokenId], ...patch };
  if (patch.role === undefined && "role" in patch) delete next.role;
  if (patch.name === undefined && "name" in patch) delete next.name;
  const decisions = { ...pool.decisions };
  if (next.role === undefined && next.name === undefined) {
    delete decisions[tokenId];
  } else {
    decisions[tokenId] = next;
  }
  return { ...pool, decisions };
}

export function poolTokens(pool: TokenPool): StyleSnapToken[] {
  return pool.imports.flatMap((imp) => imp.tokens);
}

export function poolTokenCount(pool: TokenPool): number {
  return pool.imports.reduce((n, imp) => n + imp.tokens.length, 0);
}

/** Human label for an import's origin, e.g. "lumen.app (browser extension)". */
export function importLabel(meta: StyleSnapMeta): string {
  if (meta.source === "figma") {
    return meta.figmaFile ? `${meta.figmaFile} (Figma)` : "Figma";
  }
  return meta.pageUrl ? `${hostnameOf(meta.pageUrl)} (browser extension)` : "Browser extension";
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return url;
  }
}

// ─────────────────────────────────────────
// localStorage draft (FR-29)
// ─────────────────────────────────────────
// The draft is a persistence detail, not a contract: if it is corrupt or from
// an incompatible app version we silently start fresh — never crash, never
// show the FR-2 import error for something the user didn't paste.

export const DRAFT_STORAGE_KEY = "stylesnap.draft.v1";

export function serializeDraft(pool: TokenPool): string {
  return JSON.stringify(pool);
}

/** Returns the pool, or null when the draft is missing/corrupt (start fresh). */
export function deserializeDraft(text: string | null): TokenPool | null {
  if (!text) return null;
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof json !== "object" || json === null || !Array.isArray((json as TokenPool).imports)) {
    return null;
  }

  // Merges were added in Phase 3 — older drafts simply have none.
  const rawMerges = (json as Partial<TokenPool>).merges ?? [];
  if (!Array.isArray(rawMerges)) return null;
  const merges: MergeRecord[] = [];
  for (const entry of rawMerges) {
    const m = entry as MergeRecord;
    if (
      typeof m?.survivorId !== "string" ||
      typeof m?.mergedAt !== "string" ||
      !Array.isArray(m?.mergedIds) ||
      m.mergedIds.some((id) => typeof id !== "string")
    ) {
      return null;
    }
    merges.push({ survivorId: m.survivorId, mergedIds: m.mergedIds, mergedAt: m.mergedAt });
  }

  // Decisions were added in Phase 4 — older drafts simply have none.
  const rawDecisions = (json as Partial<TokenPool>).decisions ?? {};
  if (typeof rawDecisions !== "object" || rawDecisions === null || Array.isArray(rawDecisions)) {
    return null;
  }
  const decisions: Record<string, TokenDecision> = {};
  for (const [tokenId, entry] of Object.entries(rawDecisions)) {
    const d = entry as TokenDecision;
    if (typeof d !== "object" || d === null) return null;
    if (d.role !== undefined && d.role !== null && typeof d.role !== "string") return null;
    if (d.name !== undefined && typeof d.name !== "string") return null;
    const clean: TokenDecision = {};
    if (d.role !== undefined) clean.role = d.role;
    if (d.name !== undefined) clean.name = d.name;
    if (clean.role !== undefined || clean.name !== undefined) decisions[tokenId] = clean;
  }

  const imports: PoolImport[] = [];
  for (const entry of (json as { imports: unknown[] }).imports) {
    const imp = entry as PoolImport;
    if (typeof imp?.importId !== "string" || typeof imp?.importedAt !== "string") return null;
    // Re-validate each stored capture with the contract schema so a stale or
    // hand-edited draft can't smuggle malformed tokens into the app.
    const parsed = styleSnapExportSchema.safeParse({ meta: imp.meta, tokens: imp.tokens });
    if (!parsed.success) return null;
    imports.push({
      importId: imp.importId,
      importedAt: imp.importedAt,
      meta: parsed.data.meta,
      tokens: parsed.data.tokens,
    });
  }
  return { imports, merges, decisions };
}

export function loadDraft(storage: Pick<Storage, "getItem">): TokenPool | null {
  try {
    return deserializeDraft(storage.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return null; // storage disabled (private mode etc.) — run in-memory only
  }
}

export function saveDraft(storage: Pick<Storage, "setItem">, pool: TokenPool): void {
  try {
    storage.setItem(DRAFT_STORAGE_KEY, serializeDraft(pool));
  } catch {
    // Quota exceeded / storage disabled — the session still works in memory.
  }
}

export function clearDraft(storage: Pick<Storage, "removeItem">): void {
  try {
    storage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // ignore — nothing to clear
  }
}
