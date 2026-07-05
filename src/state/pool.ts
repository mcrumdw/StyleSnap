// StyleSnap — Token pool (Phase 1)
//
// The pool is the session's working set: every accepted import appended in
// order (PRD FR-3), each keeping its own `meta` so provenance (meta.source,
// figmaFile / pageUrl) survives all the way to export. Tokens are never
// mutated here — dedup/merge (Phase 3) builds on top of this.
//
// Everything in this file is a pure function so it can be unit-tested without
// React or a browser.

import { styleSnapExportSchema, styleSnapTokenSchema } from "../contract/schema";
import type { StyleSnapExport, StyleSnapMeta, StyleSnapToken } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import type { PipelineStep } from "./pipeline";
import { clampStep } from "./pipeline";

export interface PoolImport {
  /** Unique per import action (not per capture file — the same file can be imported twice). */
  importId: string;
  /** When the user imported it, ISO 8601. */
  importedAt: string;
  meta: StyleSnapMeta;
  tokens: StyleSnapToken[];
}

/**
 * A user decision about one token. Since Phase 8 this is the NAME only —
 * roles live in `assignments` (roles point at primitives, DECISIONS.md §2.3).
 * Suggestions are always computed live from the engine; only explicit
 * decisions persist here (FR-16: nothing finalizes without confirmation).
 */
export interface TokenDecision {
  /** User-assigned slash-nested name (FR-21). */
  name?: string;
}

export interface TokenPool {
  imports: PoolImport[];
  /** User-confirmed merges (Phase 3) — applied as a view, reversible until Create System. */
  merges: MergeRecord[];
  /** Per-token decisions (name only since Phase 8). */
  decisions: Record<string, TokenDecision>;
  /**
   * Phase 8 — role → token id. Each role points at exactly ONE primitive (map
   * key uniqueness enforces it); a primitive may be referenced by any number
   * of roles. Values are RAW token ids: merges are a view, so resolution to
   * the current survivor happens at read time (see workspace.resolveAssignments)
   * and un-merge restores the original targets for free.
   */
  assignments: Record<string, string>;
  /** Manually added tokens (Phase 5, FR-19) — user-owned, editable, removable. */
  manual: StyleSnapToken[];
  /** User-edited project name (Phase 6); when unset, derived from the first import. */
  projectName?: string;
  /** Set by Create System (FR-23) — locks merges and pins the export timestamp. */
  systemCreatedAt?: string;
  /** Phase 10 — last active pipeline step (1–4). */
  currentStep?: PipelineStep;
}

export function emptyPool(): TokenPool {
  return { imports: [], merges: [], decisions: {}, assignments: {}, manual: [] };
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

/** Set or clear a token's name (FR-21). `undefined` clears back to unnamed. */
export function setDecision(
  pool: TokenPool,
  tokenId: string,
  patch: TokenDecision,
): TokenPool {
  const decisions = { ...pool.decisions };
  if (patch.name === undefined) {
    delete decisions[tokenId];
  } else {
    decisions[tokenId] = { name: patch.name };
  }
  return { ...pool, decisions };
}

// ─────────────────────────────────────────
// Role assignments (Phase 8) — role → primitive
// ─────────────────────────────────────────

/**
 * Point a role at a token. Overwrites any previous target — the UI asks for
 * explicit confirmation before stealing a role from another primitive.
 */
export function assignRole(pool: TokenPool, role: string, tokenId: string): TokenPool {
  return { ...pool, assignments: { ...pool.assignments, [role]: tokenId } };
}

export function unassignRole(pool: TokenPool, role: string): TokenPool {
  const assignments = { ...pool.assignments };
  delete assignments[role];
  return { ...pool, assignments };
}

/**
 * Resolve assignments through the merge view: a role pointing at an absorbed
 * token follows the chain to its current survivor. Because the stored ids
 * stay raw, un-merge restores the original targets with no bookkeeping.
 */
export function resolveAssignments(
  assignments: Record<string, string>,
  merges: MergeRecord[],
): Record<string, string> {
  const survivorOf = new Map<string, string>();
  for (const merge of merges) {
    for (const id of merge.mergedIds) survivorOf.set(id, merge.survivorId);
  }
  const resolve = (id: string): string => {
    let current = id;
    for (let hops = 0; hops < merges.length && survivorOf.has(current); hops++) {
      current = survivorOf.get(current)!;
    }
    return current;
  };
  return Object.fromEntries(
    Object.entries(assignments).map(([role, id]) => [role, resolve(id)]),
  );
}

// ─────────────────────────────────────────
// Manual tokens (Phase 5, FR-19)
// ─────────────────────────────────────────

export function addManualToken(pool: TokenPool, token: StyleSnapToken): TokenPool {
  return { ...pool, manual: [...pool.manual, token] };
}

/** Replace a manual token in place (same id). */
export function updateManualToken(pool: TokenPool, token: StyleSnapToken): TokenPool {
  return {
    ...pool,
    manual: pool.manual.map((t) => (t.id === token.id ? token : t)),
  };
}

/** Remove a manual token and everything that referenced it. */
export function removeManualToken(pool: TokenPool, tokenId: string): TokenPool {
  const decisions = { ...pool.decisions };
  delete decisions[tokenId];
  return {
    ...pool,
    manual: pool.manual.filter((t) => t.id !== tokenId),
    // A merge it survived is dropped; merges that absorbed it skip it safely.
    merges: pool.merges.filter((m) => m.survivorId !== tokenId),
    decisions,
    assignments: Object.fromEntries(
      Object.entries(pool.assignments).filter(([, id]) => id !== tokenId),
    ),
  };
}

// ─────────────────────────────────────────
// Create System (Phase 6, FR-23)
// ─────────────────────────────────────────

export function setProjectName(pool: TokenPool, name: string): TokenPool {
  return { ...pool, projectName: name };
}

/** Finalize: merges lock, exports use this timestamp (re-exports stay byte-identical). */
export function setCurrentStep(pool: TokenPool, step: PipelineStep): TokenPool {
  return { ...pool, currentStep: step };
}

export function createSystem(pool: TokenPool, at: string): TokenPool {
  return { ...pool, systemCreatedAt: at };
}

export function isSystemCreated(pool: TokenPool): boolean {
  return pool.systemCreatedAt !== undefined;
}

/** PRD §16 (decided): prefill from meta.figmaFile / the pageUrl domain. */
export function defaultProjectName(pool: TokenPool): string {
  for (const imp of pool.imports) {
    if (imp.meta.figmaFile) return imp.meta.figmaFile;
  }
  for (const imp of pool.imports) {
    if (imp.meta.pageUrl) return hostnameOf(imp.meta.pageUrl);
  }
  return "Untitled";
}

export function poolTokens(pool: TokenPool): StyleSnapToken[] {
  return [...pool.imports.flatMap((imp) => imp.tokens), ...pool.manual];
}

export function poolTokenCount(pool: TokenPool): number {
  return pool.imports.reduce((n, imp) => n + imp.tokens.length, pool.manual.length);
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

  // Decisions were added in Phase 4. Pre-Phase-8 drafts stored a `role`
  // field per token (1:1) — migrate it into the role→token `assignments` map
  // losslessly. An explicit "no role" (null) has no assignment equivalent
  // and simply drops; a name is kept either way.
  const rawDecisions = (json as { decisions?: unknown }).decisions ?? {};
  if (typeof rawDecisions !== "object" || rawDecisions === null || Array.isArray(rawDecisions)) {
    return null;
  }
  const decisions: Record<string, TokenDecision> = {};
  const migratedAssignments: Record<string, string> = {};
  // Deterministic migration order in the (formerly possible) case where two
  // tokens carried the same role string: the lowest token id wins.
  const decisionEntries = Object.entries(rawDecisions).sort(([a], [b]) => (a < b ? -1 : 1));
  for (const [tokenId, entry] of decisionEntries) {
    const d = entry as { role?: string | null; name?: string };
    if (typeof d !== "object" || d === null) return null;
    if (d.role !== undefined && d.role !== null && typeof d.role !== "string") return null;
    if (d.name !== undefined && typeof d.name !== "string") return null;
    if (typeof d.role === "string" && !(d.role in migratedAssignments)) {
      migratedAssignments[d.role] = tokenId;
    }
    if (d.name !== undefined) decisions[tokenId] = { name: d.name };
  }

  // Assignments were added in Phase 8 — merged with anything migrated above.
  const rawAssignments = (json as Partial<TokenPool>).assignments ?? {};
  if (typeof rawAssignments !== "object" || rawAssignments === null || Array.isArray(rawAssignments)) {
    return null;
  }
  const assignments: Record<string, string> = { ...migratedAssignments };
  for (const [role, tokenId] of Object.entries(rawAssignments)) {
    if (typeof tokenId !== "string") return null;
    assignments[role] = tokenId;
  }

  // Manual tokens were added in Phase 5 — older drafts simply have none.
  const rawManual = (json as Partial<TokenPool>).manual ?? [];
  if (!Array.isArray(rawManual)) return null;
  const manual: StyleSnapToken[] = [];
  for (const entry of rawManual) {
    const parsed = styleSnapTokenSchema.safeParse(entry);
    if (!parsed.success) return null;
    manual.push(parsed.data);
  }

  // Project name + Create System stamp were added in Phase 6 — optional strings.
  const { projectName, systemCreatedAt, currentStep } = json as Partial<TokenPool>;
  if (projectName !== undefined && typeof projectName !== "string") return null;
  if (systemCreatedAt !== undefined && typeof systemCreatedAt !== "string") return null;
  if (currentStep !== undefined && ![1, 2, 3, 4].includes(currentStep)) return null;

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
  const pool: TokenPool = { imports, merges, decisions, assignments, manual };
  if (projectName !== undefined) pool.projectName = projectName;
  if (systemCreatedAt !== undefined) pool.systemCreatedAt = systemCreatedAt;
  if (currentStep !== undefined) pool.currentStep = clampStep(currentStep);
  return pool;
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
