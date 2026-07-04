// StyleSnap — Token workspace model (Phase 2, PRD §7.2)
//
// Pure functions between the pool and the workspace UI: flatten the pool with
// per-import provenance, sort canonically, group by type (FR-5), and apply
// search + filters (FR-7, FR-8). No React in here.

import type { StyleSnapMeta, StyleSnapToken, TokenType } from "../contract/types";
import { roleOrderIndex } from "../engine/roles";
import type { TokenPool } from "./pool";

/** A token plus the provenance of the import it arrived in (FR-3). */
export interface PoolEntry {
  token: StyleSnapToken;
  importId: string;
  meta: StyleSnapMeta;
}

export function poolEntries(pool: TokenPool): PoolEntry[] {
  return pool.imports.flatMap((imp) =>
    imp.tokens.map((token) => ({ token, importId: imp.importId, meta: imp.meta })),
  );
}

// ─────────────────────────────────────────
// Canonical ordering (AGENTS.md: type → role → name → value → id)
// ─────────────────────────────────────────
// Roles don't exist until Phase 4 — the comparator leaves a slot for them.

export const TOKEN_TYPE_ORDER: readonly TokenType[] = [
  "color",
  "gradient",
  "typography",
  "spacing",
  "border-radius",
  "border-width",
  "shadow",
];

export const TOKEN_TYPE_LABELS: Record<TokenType, string> = {
  color: "Color",
  gradient: "Gradient",
  typography: "Typography",
  spacing: "Spacing",
  "border-radius": "Border radius",
  "border-width": "Border width",
  shadow: "Shadow",
};

/** Stable, comparable key for a token's value (per-type, deterministic). */
export function valueKey(token: StyleSnapToken): string {
  switch (token.type) {
    case "color":
      return `${token.value.toLowerCase()}@${token.opacity}`;
    case "spacing":
    case "border-radius":
    case "border-width":
      // Zero-pad so lexicographic order matches numeric order.
      return token.value.toFixed(4).padStart(12, "0");
    case "typography": {
      const v = token.value;
      return [
        v.fontFamily.toLowerCase(),
        v.fontSize,
        v.fontWeight,
        v.fontStyle ?? "normal",
        v.lineHeight,
        v.letterSpacing ?? 0,
        v.textTransform ?? "none",
      ].join("|");
    }
    case "gradient":
      return JSON.stringify(token.value);
    case "shadow":
      return JSON.stringify(token.value);
  }
}

export function canonicalCompare(a: StyleSnapToken, b: StyleSnapToken): number {
  const typeDiff = TOKEN_TYPE_ORDER.indexOf(a.type) - TOKEN_TYPE_ORDER.indexOf(b.type);
  if (typeDiff !== 0) return typeDiff;
  // (role slot — Phase 4)
  const aName = a.name ?? "\uffff"; // unnamed sorts after named
  const bName = b.name ?? "\uffff";
  if (aName !== bName) return aName < bName ? -1 : 1;
  const aValue = valueKey(a);
  const bValue = valueKey(b);
  if (aValue !== bValue) return aValue < bValue ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// ─────────────────────────────────────────
// Display formatting (also the search haystack)
// ─────────────────────────────────────────

const pct = (opacity: number) => `${Math.round(opacity * 100)}%`;

export function formatValue(token: StyleSnapToken): string {
  switch (token.type) {
    case "color":
      return token.opacity < 1 ? `${token.value} @ ${pct(token.opacity)}` : token.value;
    case "gradient": {
      const stops = token.value.stops.map((s) => s.color).join(" → ");
      const angle = token.value.kind === "linear" && token.value.angle !== undefined ? ` ${token.value.angle}°` : "";
      return `${token.value.kind}${angle} · ${stops}`;
    }
    case "typography": {
      const v = token.value;
      const extras = [
        v.fontStyle === "italic" ? "italic" : null,
        `lh ${v.lineHeight}`,
        v.letterSpacing !== undefined ? `tracking ${v.letterSpacing}px` : null,
        v.textTransform && v.textTransform !== "none" ? v.textTransform : null,
      ].filter(Boolean);
      return `${v.fontFamily} ${v.fontSize}px/${v.fontWeight} · ${extras.join(" · ")}`;
    }
    case "spacing":
    case "border-radius":
    case "border-width":
      return `${token.value}px`;
    case "shadow":
      return token.value
        .map(
          (l) =>
            `${l.inset ? "inset " : ""}${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread} ${l.color} @ ${pct(l.opacity)}`,
        )
        .join(", ");
  }
}

// ─────────────────────────────────────────
// Filters (FR-7 + FR-8)
// ─────────────────────────────────────────

export interface WorkspaceFilters {
  search: string;
  type: TokenType | "all";
  source: StyleSnapMeta["source"] | "all";
  named: "all" | "named" | "unnamed";
  /** "flagged" needs the dedup engine (Phase 3); until then no token is flagged. */
  flagged: "all" | "flagged";
  captureId: string | "all";
}

export const DEFAULT_FILTERS: WorkspaceFilters = {
  search: "",
  type: "all",
  source: "all",
  named: "all",
  flagged: "all",
  captureId: "all",
};

function haystack(entry: PoolEntry): string {
  const { token } = entry;
  return [
    token.name ?? "",
    token.source,
    token.type,
    formatValue(token),
    token.context?.authoredName ?? "",
    token.context?.selector ?? "",
    token.context?.element ?? "",
  ]
    .join(" ")
    .toLowerCase();
}

export function filterEntries(
  entries: PoolEntry[],
  filters: WorkspaceFilters,
  flaggedIds: ReadonlySet<string> = new Set(),
): PoolEntry[] {
  const query = filters.search.trim().toLowerCase();
  return entries.filter(({ token, meta, ...rest }) => {
    const entry = { token, meta, ...rest };
    if (filters.type !== "all" && token.type !== filters.type) return false;
    if (filters.source !== "all" && meta.source !== filters.source) return false;
    if (filters.named === "named" && token.name === null) return false;
    if (filters.named === "unnamed" && token.name !== null) return false;
    if (filters.flagged === "flagged" && !flaggedIds.has(token.id)) return false;
    if (filters.captureId !== "all" && token.captureId !== filters.captureId) return false;
    if (query && !haystack(entry).includes(query)) return false;
    return true;
  });
}

// ─────────────────────────────────────────
// Grouping (FR-5, FR-8)
// ─────────────────────────────────────────

export interface TokenGroup {
  type: TokenType;
  label: string;
  entries: PoolEntry[];
}

/**
 * Groups in canonical type order, canonically sorted inside (with roles in
 * Appendix B order when provided — role-less last), empty groups omitted.
 */
export function groupByType(
  entries: PoolEntry[],
  roleOf?: (tokenId: string) => string | undefined,
): TokenGroup[] {
  return TOKEN_TYPE_ORDER.flatMap((type) => {
    const inGroup = entries
      .filter((e) => e.token.type === type)
      .sort((a, b) => {
        if (roleOf) {
          const byRole = roleOrderIndex(roleOf(a.token.id)) - roleOrderIndex(roleOf(b.token.id));
          if (byRole !== 0) return byRole;
        }
        return canonicalCompare(a.token, b.token);
      });
    return inGroup.length > 0
      ? [{ type, label: TOKEN_TYPE_LABELS[type], entries: inGroup }]
      : [];
  });
}

export interface CaptureGroup {
  captureId: string;
  count: number;
}

/** "From the same element" groups (FR-8): captureIds carrying 2+ tokens. */
export function captureGroups(entries: PoolEntry[]): CaptureGroup[] {
  const counts = new Map<string, number>();
  for (const { token } of entries) {
    counts.set(token.captureId, (counts.get(token.captureId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([captureId, count]) => ({ captureId, count }))
    .sort((a, b) => b.count - a.count || (a.captureId < b.captureId ? -1 : 1));
}
