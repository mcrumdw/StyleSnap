import { useMemo, useState, type SelectHTMLAttributes } from "react";
import type { TokenType } from "../contract/types";
import {
  applyMerges,
  detectClusters,
  flagLevels,
  type MergeRecord,
  type Sensitivity,
} from "../engine/dedup";
import { computeChecklist } from "../engine/completeness";
import { deriveRoleSuggestions } from "../engine/roles";
import type { StyleSnapToken } from "../contract/types";
import type { TokenDecision } from "../state/pool";
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
import { AddTokenDialog } from "./AddTokenDialog";
import { Button } from "./Button";
import { ChecklistPanel } from "./ChecklistPanel";
import { MergeDialog } from "./MergeDialog";
import { Toast } from "./Toast";
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

const SENSITIVITY_STEPS: Sensitivity[] = ["strict", "default", "loose"];

// §9-style plural labels for the merge toast ("Nice — 4 blues just became 1.").
const MERGE_NOUNS: Record<TokenType, string> = {
  color: "colors",
  gradient: "gradients",
  typography: "type styles",
  spacing: "spacing values",
  "border-radius": "radii",
  "border-width": "border widths",
  shadow: "shadows",
};

interface WorkspaceProps {
  entries: PoolEntry[];
  merges: MergeRecord[];
  decisions: Record<string, TokenDecision>;
  onMergeCluster: (survivorId: string, mergedIds: string[]) => void;
  onUnmerge: (survivorId: string) => void;
  onDecide: (tokenId: string, patch: TokenDecision) => void;
  onAddManual: (token: StyleSnapToken, role?: string) => void;
  onUpdateManual: (token: StyleSnapToken, role?: string | null) => void;
  onRemoveManual: (tokenId: string) => void;
}

type TokenDialog =
  | { mode: "add"; presetType?: StyleSnapToken["type"]; presetRole?: string }
  | { mode: "edit"; token: StyleSnapToken; role?: string };

/** PRD §7.2–7.7 — the token workspace: flags, merge, roles, naming, gaps. */
export function Workspace({
  entries,
  merges,
  decisions,
  onMergeCluster,
  onUnmerge,
  onDecide,
  onAddManual,
  onUpdateManual,
  onRemoveManual,
}: WorkspaceProps) {
  const [filters, setFilters] = useState<WorkspaceFilters>(DEFAULT_FILTERS);
  const [sensitivity, setSensitivity] = useState<Sensitivity>("default");
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [tokenDialog, setTokenDialog] = useState<TokenDialog | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const set = <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  // Merges are a view over the raw pool — reversible until Create System.
  // User-assigned names overlay the raw tokens the same way.
  const view = useMemo(() => {
    const merged = applyMerges(entries, merges);
    return merged.map((entry) => {
      const name = decisions[entry.token.id]?.name;
      return name !== undefined ? { ...entry, token: { ...entry.token, name } } : entry;
    });
  }, [entries, merges, decisions]);

  // Role suggestions are always derived live (never persisted): the raw map
  // lets merge survivors inherit their absorbed tokens' contexts (A.1).
  const rawById = useMemo(
    () => new Map(entries.map((e) => [e.token.id, e.token])),
    [entries],
  );
  const suggestions = useMemo(
    () => deriveRoleSuggestions(view.map((e) => e.token), rawById),
    [view, rawById],
  );
  const effectiveRoleOf = (tokenId: string): string | undefined => {
    const decided = decisions[tokenId]?.role;
    if (decided !== undefined) return decided ?? undefined;
    return suggestions.get(tokenId)?.role;
  };

  // FR-18 — completeness against CONFIRMED roles only, recomputed live.
  const confirmedRoles = useMemo(() => {
    const map = new Map<string, string>();
    for (const [id, decision] of Object.entries(decisions)) {
      if (typeof decision.role === "string") map.set(id, decision.role);
    }
    return map;
  }, [decisions]);
  const checklist = useMemo(
    () => computeChecklist(view.map((e) => e.token), confirmedRoles),
    [view, confirmedRoles],
  );

  // Detection re-flags live on sensitivity change; it never merges by itself.
  const clusters = useMemo(
    () => detectClusters(view.map((e) => e.token), sensitivity),
    [view, sensitivity],
  );
  const flags = useMemo(() => flagLevels(clusters), [clusters]);
  const flaggedIds = useMemo(() => new Set(flags.keys()), [flags]);
  const clusterIdByToken = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clusters) {
      map.set(c.canonical.id, c.id);
      for (const m of c.members) map.set(m.token.id, c.id);
    }
    return map;
  }, [clusters]);

  const elements = useMemo(() => captureGroups(view), [view]);
  const visible = useMemo(() => filterEntries(view, filters, flaggedIds), [view, filters, flaggedIds]);
  const groups = groupByType(visible, effectiveRoleOf);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);

  const openCluster = clusters.find((c) => c.id === openClusterId) ?? null;

  function handleMerge(survivorId: string, mergedIds: string[]) {
    const cluster = openCluster!;
    onMergeCluster(survivorId, mergedIds);
    setOpenClusterId(null);
    const count = mergedIds.length + 1;
    setToast(`Nice — ${count} ${MERGE_NOUNS[cluster.canonical.type]} just became 1.`);
  }

  function handleUnmerge(survivorId: string) {
    onUnmerge(survivorId);
    setToast("Un-merged — the originals are back, untouched.");
  }

  return (
    <section className="flex w-full flex-col gap-8">
      <ChecklistPanel
        checklist={checklist}
        onAddToken={({ tokenType, role }) =>
          setTokenDialog({ mode: "add", presetType: tokenType, presetRole: role })
        }
      />

      <div className="flex flex-wrap items-center gap-4">
        <Button size="sm" onClick={() => setTokenDialog({ mode: "add" })}>
          Add token
        </Button>
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
          <option value="manual">Manual</option>
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

        {/* DESIGN.md §5.1 sensitivity slider — re-flags live, never re-merges. */}
        <label className="ml-auto flex items-center gap-3">
          <span className="text-caption font-medium text-text-muted">strict</span>
          <input
            type="range"
            className="sensitivity w-32"
            min={0}
            max={2}
            step={1}
            value={SENSITIVITY_STEPS.indexOf(sensitivity)}
            onChange={(e) => setSensitivity(SENSITIVITY_STEPS[Number(e.target.value)])}
            aria-label="Merge sensitivity"
          />
          <span className="text-caption font-medium text-text-muted">loose</span>
        </label>
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
              {group.entries.map((entry) => {
                const id = entry.token.id;
                const clusterId = clusterIdByToken.get(id);
                return (
                  <TokenCard
                    key={id}
                    entry={entry}
                    flag={flags.get(id)}
                    roleSuggestion={suggestions.get(id)}
                    roleDecision={decisions[id]?.role}
                    onDecideRole={(role) => onDecide(id, { role })}
                    onSetName={(name) => onDecide(id, { name })}
                    onReviewCluster={clusterId ? () => setOpenClusterId(clusterId) : undefined}
                    onUnmerge={entry.token.merged ? () => handleUnmerge(id) : undefined}
                    onEditManual={
                      entry.origin === "manual"
                        ? () =>
                            setTokenDialog({
                              mode: "edit",
                              token: entry.token,
                              role: confirmedRoles.get(id),
                            })
                        : undefined
                    }
                    onRemoveManual={
                      entry.origin === "manual" ? () => onRemoveManual(id) : undefined
                    }
                  />
                );
              })}
            </div>
          </section>
        ))
      )}

      {openCluster && (
        <MergeDialog
          cluster={openCluster}
          onMerge={handleMerge}
          onClose={() => setOpenClusterId(null)}
        />
      )}
      {tokenDialog && (
        <AddTokenDialog
          presetType={tokenDialog.mode === "add" ? tokenDialog.presetType : undefined}
          presetRole={tokenDialog.mode === "add" ? tokenDialog.presetRole : undefined}
          editing={tokenDialog.mode === "edit" ? tokenDialog.token : undefined}
          editingRole={tokenDialog.mode === "edit" ? tokenDialog.role : undefined}
          onSave={(token, role) => {
            if (tokenDialog.mode === "edit") {
              onUpdateManual(token, role ?? null);
              setToast("Token updated.");
            } else {
              onAddManual(token, role);
              setToast(role ? `Added — ${role} has a home now.` : "Token added.");
            }
            setTokenDialog(null);
          }}
          onClose={() => setTokenDialog(null)}
        />
      )}
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </section>
  );
}
