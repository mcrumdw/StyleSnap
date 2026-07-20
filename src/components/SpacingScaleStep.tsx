import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import { applyMerges, type MergeRecord } from "../engine/dedup";
import { deriveRoleCandidates, fallbackName } from "../engine/roles";
import { resolveAssignments, type TokenDecision } from "../state/pool";
import type { FillInfo } from "../state/useSessionViewModel";
import type { PoolEntry } from "../state/workspace";
import { SpacingScalePanel } from "./SpacingScalePanel";

interface SpacingScaleStepProps {
  entries: PoolEntry[];
  merges: MergeRecord[];
  decisions: Record<string, TokenDecision>;
  assignments: Record<string, string>;
  systemTokens: StyleSnapToken[];
  roleDisplayTokens?: Map<string, StyleSnapToken>;
  fills?: Record<string, FillInfo>;
  focusRoleId?: string;
  onAssign: (role: string, tokenId: string) => void;
  onUnassign: (role: string) => void;
  userAssignments?: Record<string, string>;
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
}

/** Full scale ladder under Spacing → Primitives. */
export function SpacingScaleStep({
  entries,
  merges,
  decisions,
  assignments,
  systemTokens,
  roleDisplayTokens,
  fills,
  focusRoleId,
  onAssign,
  onUnassign,
  userAssignments,
  onEditDerived,
  onResetDerived,
}: SpacingScaleStepProps) {
  const view = useMemo(() => {
    const merged = applyMerges(entries, merges);
    return merged.map((entry) => {
      const name = decisions[entry.token.id]?.name;
      return name !== undefined ? { ...entry, token: { ...entry.token, name } } : entry;
    });
  }, [entries, merges, decisions]);

  const tokenById = useMemo(() => new Map(systemTokens.map((t) => [t.id, t])), [systemTokens]);

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
    <SpacingScalePanel
      tokens={systemTokens}
      assignments={resolved}
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
    />
  );
}
