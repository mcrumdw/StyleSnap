import { useEffect, useMemo, useState, type SelectHTMLAttributes } from "react";
import type { TokenType } from "../contract/types";
import type { StyleSnapToken } from "../contract/types";
import {
  applyMerges,
  detectClusters,
  flagLevels,
  type MergeRecord,
  type Sensitivity,
} from "../engine/dedup";
import {
  deriveRoleCandidates,
  fallbackName,
  roleOrderIndex,
  topSuggestionsByToken,
} from "../engine/roles";
import { resolveAssignments, type TokenDecision } from "../state/pool";
import {
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

const MERGE_NOUNS: Record<TokenType, string> = {
  color: "colors",
  gradient: "gradients",
  typography: "type styles",
  spacing: "spacing values",
  "border-radius": "radii",
  "border-width": "border widths",
  shadow: "shadows",
};

interface CleanupStepProps {
  entries: PoolEntry[];
  merges: MergeRecord[];
  decisions: Record<string, TokenDecision>;
  assignments: Record<string, string>;
  addTokenPreset?: { tokenType: TokenType; role?: string };
  onAddTokenPresetConsumed?: () => void;
  onMergeCluster: (survivorId: string, mergedIds: string[]) => void;
  onUnmerge: (survivorId: string) => void;
  onSetName: (tokenId: string, name: string | undefined) => void;
  onAssign: (role: string, tokenId: string) => void;
  onUnassign: (role: string) => void;
  onAddManual: (token: StyleSnapToken, role?: string) => void;
  onUpdateManual: (token: StyleSnapToken, role?: string | null) => void;
  onRemoveManual: (tokenId: string) => void;
  onMergeCelebration?: (message: string) => void;
  /** Toast with optional one-click undo (uses the session history stack). */
  onActionToast?: (message: string, undo?: () => void) => void;
  locked?: boolean;
}

type TokenDialog =
  | { mode: "add"; presetType?: StyleSnapToken["type"]; presetRole?: string }
  | { mode: "edit"; token: StyleSnapToken; role?: string };

/** Phase 10 step 1 — captured grid + merge flow. */
export function CleanupStep({
  entries,
  merges,
  decisions,
  assignments,
  addTokenPreset,
  onAddTokenPresetConsumed,
  onMergeCluster,
  onUnmerge,
  onSetName,
  onAssign,
  onUnassign,
  onAddManual,
  onUpdateManual,
  onRemoveManual,
  onMergeCelebration,
  onActionToast,
  locked = false,
}: CleanupStepProps) {
  const [filters, setFilters] = useState<WorkspaceFilters>(DEFAULT_FILTERS);
  const [capturedFilter, setCapturedFilter] = useState<"all" | "unused" | "flagged">("all");
  const [showEverything, setShowEverything] = useState(false);
  const [sensitivity, setSensitivity] = useState<Sensitivity>("default");
  const [openClusterId, setOpenClusterId] = useState<string | null>(null);
  const [tokenDialog, setTokenDialog] = useState<TokenDialog | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!addTokenPreset) return;
    setTokenDialog({
      mode: "add",
      presetType: addTokenPreset.tokenType,
      presetRole: addTokenPreset.role,
    });
    onAddTokenPresetConsumed?.();
  }, [addTokenPreset, onAddTokenPresetConsumed]);

  const set = <K extends keyof WorkspaceFilters>(key: K, value: WorkspaceFilters[K]) =>
    setFilters((f) => ({ ...f, [key]: value }));

  const namedEntries = useMemo(
    () =>
      entries.map((entry) => {
        const name = decisions[entry.token.id]?.name;
        return name !== undefined ? { ...entry, token: { ...entry.token, name } } : entry;
      }),
    [entries, decisions],
  );

  const mergedView = useMemo(() => applyMerges(namedEntries, merges), [namedEntries, merges]);
  const view = showEverything ? namedEntries : mergedView;

  const rawById = useMemo(
    () => new Map(entries.map((e) => [e.token.id, e.token])),
    [entries],
  );
  const candidates = useMemo(
    () => deriveRoleCandidates(mergedView.map((e) => e.token), rawById),
    [mergedView, rawById],
  );
  const suggestionChips = useMemo(() => topSuggestionsByToken(candidates), [candidates]);

  const resolved = useMemo(() => resolveAssignments(assignments, merges), [assignments, merges]);
  const rolesByToken = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [role, tokenId] of Object.entries(resolved)) {
      map.set(tokenId, [...(map.get(tokenId) ?? []), role]);
    }
    for (const roles of map.values()) {
      roles.sort((a, b) => roleOrderIndex(a) - roleOrderIndex(b));
    }
    return map;
  }, [resolved]);

  const suggestedFor = (tokenId: string): string[] =>
    (suggestionChips.get(tokenId) ?? []).filter((role) => !(role in resolved));

  const holderLabel = (role: string): string | undefined => {
    const holderId = resolved[role];
    if (holderId === undefined) return undefined;
    const holder = mergedView.find((e) => e.token.id === holderId);
    return holder ? holder.token.name ?? fallbackName(holder.token) : undefined;
  };

  const effectiveRoleOf = (tokenId: string): string | undefined =>
    rolesByToken.get(tokenId)?.[0] ?? suggestedFor(tokenId)[0];

  const clusters = useMemo(
    () => detectClusters(mergedView.map((e) => e.token), sensitivity),
    [mergedView, sensitivity],
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

  const visible = useMemo(() => filterEntries(view, filters, flaggedIds), [view, filters, flaggedIds]);

  const displayEntries = useMemo(() => {
    let list = visible;
    if (capturedFilter === "unused") {
      list = list.filter((e) => (rolesByToken.get(e.token.id)?.length ?? 0) === 0);
    } else if (capturedFilter === "flagged") {
      list = list.filter((e) => flaggedIds.has(e.token.id));
    }
    return list;
  }, [visible, capturedFilter, rolesByToken, flaggedIds]);

  const groups = groupByType(displayEntries, effectiveRoleOf);
  const isFiltered = JSON.stringify(filters) !== JSON.stringify(DEFAULT_FILTERS);
  const openCluster = clusters.find((c) => c.id === openClusterId) ?? null;

  function handleMerge(survivorId: string, mergedIds: string[]) {
    const cluster = openCluster!;
    onMergeCluster(survivorId, mergedIds);
    setOpenClusterId(null);
    const count = mergedIds.length + 1;
    const msg = `Nice — ${count} ${MERGE_NOUNS[cluster.canonical.type]} just became 1.`;
    if (onActionToast) onActionToast(msg);
    else setToast(msg);
    onMergeCelebration?.(msg);
  }

  function handleUnmerge(survivorId: string) {
    onUnmerge(survivorId);
    const msg = "Un-merged — the originals are back, untouched.";
    if (onActionToast) onActionToast(msg);
    else setToast(msg);
  }

  return (
    <section className="flex w-full flex-col gap-6">
      <p className="text-caption text-text-muted">
        Raw values from your captures — merge near-duplicates and name them here.{" "}
        <span title="A raw captured value (hex, spacing, font). Roles in step 2 say what it's for.">
          What's a value?
        </span>
      </p>

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
          label="Show"
          value={capturedFilter}
          onChange={(e) => setCapturedFilter(e.target.value as typeof capturedFilter)}
        >
          <option value="all">All</option>
          <option value="unused">Unused only</option>
          <option value="flagged">Flagged only</option>
        </Select>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={showEverything}
            onChange={(e) => setShowEverything(e.target.checked)}
            className="h-4 w-4 rounded-sm border-2 border-border-default"
          />
          <span className="text-caption text-text-muted">Show everything (incl. merged-away)</span>
        </label>
        {isFiltered && (
          <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
            Clear filters
          </Button>
        )}
        {locked && (
          <span className="ml-auto rounded-sm border-2 border-border-default bg-surface-page px-3 py-1 font-mono text-badge text-text-muted">
            SYSTEM CREATED — merges locked
          </span>
        )}
        {!locked && (
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
        )}
      </div>

      <div className="flex flex-col gap-8">
        {groups.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-16 text-center">
            <h2 className="font-heading text-section-header font-bold">No tokens match</h2>
            <p className="text-base text-text-muted">Try a different search — or clear the filters.</p>
            <Button variant="secondary" onClick={() => setFilters(DEFAULT_FILTERS)}>
              Clear filters
            </Button>
          </div>
        ) : (
          groups.map((group) => (
            <section key={group.type} className="flex flex-col gap-4">
              <h2 className="font-heading text-section-header font-bold">
                {group.label}{" "}
                <span className="font-mono text-card-title text-text-muted">({group.entries.length})</span>
              </h2>
              <div className="grid grid-cols-3 gap-6">
                {group.entries.map((entry) => {
                  const id = entry.token.id;
                  const clusterId = clusterIdByToken.get(id);
                  return (
                    <TokenCard
                      key={id}
                      entry={entry}
                      variant="primitive"
                      roleCount={rolesByToken.get(id)?.length ?? 0}
                      flag={flags.get(id)}
                      assignedRoles={rolesByToken.get(id) ?? []}
                      suggestedRoles={suggestedFor(id)}
                      holderLabel={holderLabel}
                      onAssignRole={(role) => onAssign(role, id)}
                      onUnassignRole={onUnassign}
                      onSetName={(name) => onSetName(id, name)}
                      onReviewCluster={
                        !locked && clusterId ? () => setOpenClusterId(clusterId) : undefined
                      }
                      onUnmerge={!locked && entry.token.merged ? () => handleUnmerge(id) : undefined}
                      onEditManual={
                        entry.origin === "manual"
                          ? () =>
                              setTokenDialog({
                                mode: "edit",
                                token: entry.token,
                                role: rolesByToken.get(id)?.[0],
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
      </div>

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
