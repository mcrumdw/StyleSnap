import { useMemo } from "react";
import { applyMerges, type MergeRecord } from "../engine/dedup";
import { deriveRoleCandidates, fallbackName } from "../engine/roles";
import { resolveAssignments, type TokenDecision } from "../state/pool";
import type { PoolEntry } from "../state/workspace";
import { EditRolesPanel } from "./EditRolesPanel";

interface GiveMeaningStepProps {
  entries: PoolEntry[];
  merges: MergeRecord[];
  decisions: Record<string, TokenDecision>;
  assignments: Record<string, string>;
  focusRoleId?: string;
  onAssign: (role: string, tokenId: string) => void;
  onUnassign: (role: string) => void;
}

/** Phase 10 step 2 — semantic role assignment (EditRolesPanel + derived state). */
export function GiveMeaningStep({
  entries,
  merges,
  decisions,
  assignments,
  focusRoleId,
  onAssign,
  onUnassign,
}: GiveMeaningStepProps) {
  const view = useMemo(() => {
    const merged = applyMerges(entries, merges);
    return merged.map((entry) => {
      const name = decisions[entry.token.id]?.name;
      return name !== undefined ? { ...entry, token: { ...entry.token, name } } : entry;
    });
  }, [entries, merges, decisions]);

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
    const holder = view.find((e) => e.token.id === holderId);
    return holder ? holder.token.name ?? fallbackName(holder.token) : undefined;
  };

  const systemTokens = view.map((e) => e.token);

  return (
    <section className="flex w-full flex-col gap-4">
      <p className="text-caption text-text-muted">
        Tell each value what job it does in your system.{" "}
        <span title="A role is a named slot like color/text/primary — it points at one captured value. One value can fill several roles.">
          What's a role?
        </span>
      </p>
      <EditRolesPanel
        tokens={systemTokens}
        assignments={resolved}
        suggestedByRole={suggestedByRole}
        holderLabel={holderLabel}
        onAssign={onAssign}
        onUnassign={onUnassign}
        focusRoleId={focusRoleId}
      />
    </section>
  );
}
