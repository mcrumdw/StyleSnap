import { useMemo, useState, type SelectHTMLAttributes } from "react";
import type { TokenType } from "../contract/types";
import {
  captureGroups,
  DEFAULT_FILTERS,
  filterEntries,
  groupByType,
  TOKEN_TYPE_LABELS,
  TOKEN_TYPE_ORDER,
  type PoolEntry,
  type WorkspaceFilters,
} from "../state/workspace";
import { Button } from "./Button";
import { TokenCard } from "./TokenCard";

const control =
  "h-btn-sm rounded-sm border-2 border-border-default bg-surface-card px-3 text-caption text-text-primary";

function Select({
  label,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string }) {
  return (
    <label className="flex items-center gap-2">
      <span className="text-caption font-medium text-text-muted">{label}</span>
      <select className={control} {...props} />
    </label>
  );
}

/** PRD §7.2 — the read-only token workspace: groups, counts, search, filters. */
export function Workspace({ entries }: { entries: PoolEntry[] }) {
  const [filters, setFilters] = useState<WorkspaceFilters>(DEFAULT_FILTERS);
  const set = <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const elements = useMemo(() => captureGroups(entries), [entries]);
  const visible = useMemo(() => filterEntries(entries, filters), [entries, filters]);
  const groups = useMemo(() => groupByType(visible), [visible]);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  return (
    <section className="flex w-full flex-col gap-8">
      <div className="flex flex-wrap items-center gap-4">
        <input
          type="search"
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          placeholder="Search value, name, source…"
          aria-label="Search tokens"
          className={`${control} w-64 placeholder:text-text-muted`}
        />
        <Select
          label="Type"
          value={filters.type}
          onChange={(e) => set("type", e.target.value as TokenType | "all")}
        >
          <option value="all">All</option>
          {TOKEN_TYPE_ORDER.map((type) => (
            <option key={type} value={type}>
              {TOKEN_TYPE_LABELS[type]}
            </option>
          ))}
        </Select>
        <Select
          label="Source"
          value={filters.source}
          onChange={(e) => set("source", e.target.value as WorkspaceFilters["source"])}
        >
          <option value="all">All</option>
          <option value="browser-extension">Web</option>
          <option value="figma">Figma</option>
        </Select>
        <Select
          label="Name"
          value={filters.named}
          onChange={(e) => set("named", e.target.value as WorkspaceFilters["named"])}
        >
          <option value="all">All</option>
          <option value="named">Named</option>
          <option value="unnamed">Unnamed</option>
        </Select>
        <Select
          label="Flags"
          value={filters.flagged}
          onChange={(e) => set("flagged", e.target.value as WorkspaceFilters["flagged"])}
        >
          <option value="all">All</option>
          <option value="flagged">Flagged only</option>
        </Select>
        <Select
          label="Same element"
          value={filters.captureId}
          onChange={(e) => set("captureId", e.target.value)}
        >
          <option value="all">All</option>
          {elements.map((g) => (
            <option key={g.captureId} value={g.captureId}>
              {g.captureId} ({g.count})
            </option>
          ))}
        </Select>
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </Button>
        )}
      </div>

      {groups.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <h2 className="font-heading text-section-header font-bold">No tokens match</h2>
          <p className="text-base text-text-muted">
            Try a different search — or clear the filters to see everything again.
          </p>
          <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </Button>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.type} className="flex flex-col gap-4">
            <h2 className="font-heading text-section-header font-bold">
              {group.label}{" "}
              <span className="font-mono text-card-title text-text-muted">
                ({group.entries.length})
              </span>
            </h2>
            <div className="grid grid-cols-3 gap-6">
              {group.entries.map((entry) => (
                <TokenCard key={entry.token.id} entry={entry} />
              ))}
            </div>
          </section>
        ))
      )}
    </section>
  );
}
