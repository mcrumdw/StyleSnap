import { useMemo } from "react";
import type { StyleSnapToken, TokenType } from "../contract/types";
import { applyMerges, type MergeRecord } from "../engine/dedup";
import { deriveRoleCandidates, fallbackName } from "../engine/roles";
import { resolveAssignments, type TokenDecision } from "../state/pool";
import type { FillInfo } from "../state/useSessionViewModel";
import type { PoolEntry } from "../state/workspace";
import { EditRolesPanel } from "./EditRolesPanel";

interface GiveMeaningStepProps {
  entries: PoolEntry[];
  merges: MergeRecord[];
  decisions: Record<string, TokenDecision>;
  /** Effective role → token id (captured + auto-derived). */
  assignments: Record<string, string>;
  /** Full token list including derived synthetics — required for derived roles. */
  systemTokens: StyleSnapToken[];
  /** Draft fills with derivedEdits overlay — source of truth for row display. */
  draftFills?: Array<{ role: string; token: StyleSnapToken }>;
  /** role → token for filled rows (derivedEdits always win). */
  roleDisplayTokens?: Map<string, StyleSnapToken>;
  /** role → fill provenance for value editing. */
  fills?: Record<string, FillInfo>;
  focusRoleId?: string;
  /** App-shell category pages: render only the slice for this role prefix. */
  rolePrefix?: "color/" | "type/" | "space/" | "radius/" | "border-width/" | "shadow/";
  onAssign: (role: string, tokenId: string) => void;
  onUnassign: (role: string) => void;
  /** Roles the user explicitly assigned (pool.assignments) — only these are removable. */
  userAssignments?: Record<string, string>;
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
  customRoles?: string[];
  onAddCustomRole?: (type: TokenType, pathAfterPrefix: string) => void;
  onRemoveCustomRole?: (role: string) => void;
}

/** Phase 10 step 2 — semantic role assignment (EditRolesPanel + derived state). */
export function GiveMeaningStep({
  entries,
  merges,
  decisions,
  assignments,
  systemTokens,
  draftFills = [],
  roleDisplayTokens,
  fills,
  focusRoleId,
  rolePrefix,
  onAssign,
  onUnassign,
  userAssignments,
  onEditDerived,
  onResetDerived,
  customRoles,
  onAddCustomRole,
  onRemoveCustomRole,
}: GiveMeaningStepProps) {
  const view = useMemo(() => {
    const merged = applyMerges(entries, merges);
    return merged.map((entry) => {
      const name = decisions[entry.token.id]?.name;
      return name !== undefined ? { ...entry, token: { ...entry.token, name } } : entry;
    });
  }, [entries, merges, decisions]);

  const tokenById = useMemo(() => new Map(systemTokens.map((t) => [t.id, t])), [systemTokens]);

  const roleTokens = useMemo(
    () => new Map(draftFills.map((f) => [f.role, f.token] as const)),
    [draftFills],
  );

  const rawById = useMemo(
    () => new Map(entries.map((e) => [e.token.id, e.token])),
    [entries],
  );
  const candidates = useMemo(
    () => deriveRoleCandidates(view.map((e) => e.token), rawById),
    [view, rawById],
  );

  const resolved = useMemo(() => resolveAssignments(assignments, merges), [assignments, merges]);

  const suggestedByRole = useMemo(() => {
    const map = new Map<string, string>();
    for (const [role, list] of candidates) {
      if (list[0] && !(role in resolved)) map.set(role, list[0].tokenId);
    }
    return map;
  }, [candidates, resolved]);

  const holderLabel = (role: string): string | undefined => {
    const holderId = resolved[role];
    if (holderId === undefined) return undefined;
    const holder = tokenById.get(holderId);
    return holder ? holder.name ?? fallbackName(holder) : undefined;
  };

  return (
    <section className="flex w-full flex-col gap-4">
        <p className="text-caption text-text-muted">
          Auto-filled roles below — click a value to edit, or use Reassign to swap primitives.{" "}
          <span title="A role is a named slot like color/text/primary — it points at one captured value. One value can fill several roles.">
            What's a role?
          </span>
        </p>
      <EditRolesPanel
        tokens={systemTokens}
        assignments={resolved}
        roleTokens={roleTokens}
        roleDisplayTokens={roleDisplayTokens}
        fills={fills}
        suggestedByRole={suggestedByRole}
        holderLabel={holderLabel}
        onAssign={onAssign}
        onUnassign={onUnassign}
        userAssignments={userAssignments}
        onEditDerived={onEditDerived}
        onResetDerived={onResetDerived}
        focusRoleId={focusRoleId}
        rolePrefix={rolePrefix}
        customRoles={customRoles}
        onAddCustomRole={onAddCustomRole}
        onRemoveCustomRole={onRemoveCustomRole}
      />
    </section>
  );
}
