import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import {
  SPACE_SLOTS,
  fallbackName,
  isSpaceSemanticRole,
  type RoleDefinition,
} from "../engine/roles";
import { buildPreviewContext } from "../state/token-display";
import type { FillInfo } from "../state/useSessionViewModel";
import { PrimitivePicker } from "./PrimitivePicker";
import { RoleFilledRow } from "./RoleValueEditor";
import { InfoHint } from "./Tooltip";

interface SpacingScalePanelProps {
  tokens: StyleSnapToken[];
  assignments: Record<string, string>;
  roleDisplayTokens?: Map<string, StyleSnapToken>;
  fills?: Record<string, FillInfo>;
  suggestedByRole: Map<string, string>;
  holderLabel: (role: string) => string | undefined;
  onAssign: (role: string, tokenId: string) => void;
  onUnassign: (role: string) => void;
  userAssignments?: Record<string, string>;
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
  focusRoleId?: string;
}

const nameOf = (token: StyleSnapToken) => token.name ?? fallbackName(token);

/**
 * Full spacing scale ladder — always `xs · sm · md · lg · xl · 2xl` in order (§2.47 / §2.48).
 * Filled or empty; inventory below only lists values not on this ladder.
 */
export function SpacingScalePanel({
  tokens,
  assignments,
  roleDisplayTokens,
  fills = {},
  suggestedByRole,
  holderLabel,
  onAssign,
  onUnassign,
  userAssignments,
  onEditDerived,
  onResetDerived,
  focusRoleId,
}: SpacingScalePanelProps) {
  const byId = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);

  const roleEntries = useMemo(() => {
    const map = new Map<string, StyleSnapToken>();
    if (roleDisplayTokens) {
      for (const [role, token] of roleDisplayTokens) {
        if (SPACE_SLOTS.some((s) => s.role === role)) map.set(role, token);
      }
    }
    for (const [role, id] of Object.entries(assignments)) {
      if (map.has(role)) continue;
      if (!SPACE_SLOTS.some((s) => s.role === role)) continue;
      const token = byId.get(id);
      if (token) map.set(role, token);
    }
    return map;
  }, [assignments, byId, roleDisplayTokens]);

  const previewContext = useMemo(() => buildPreviewContext(roleEntries), [roleEntries]);

  const jobsByToken = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [role, id] of Object.entries(assignments)) {
      if (!isSpaceSemanticRole(role)) continue;
      map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }, [assignments]);

  const rowId = (role: string) => `role-${role.replace(/\//g, "-")}`;

  const filledRow = (role: string, token: StyleSnapToken, def: RoleDefinition) => {
    const fillInfo = fills[role];
    const anchorToken = fillInfo?.derivedFrom ? byId.get(fillInfo.derivedFrom) : undefined;
    const canUnassign = Boolean(userAssignments && role in userAssignments);
    const jobs = (jobsByToken.get(token.id) ?? []).map((r) => r.split("/").slice(-1)[0]!);
    return (
      <div key={role} className="flex flex-col gap-1">
        <RoleFilledRow
          role={role}
          token={token}
          fills={fills}
          fillInfo={fillInfo}
          anchorToken={anchorToken}
          focusRoleId={focusRoleId}
          rowId={rowId(role)}
          name={nameOf(token)}
          roleMeaning={
            jobs.length > 0
              ? `${def.meaning} · also ${jobs.join(", ")}`
              : def.meaning
          }
          onUnassign={canUnassign ? () => onUnassign(role) : undefined}
          onEditDerived={onEditDerived}
          onResetDerived={onResetDerived}
          previewContext={previewContext}
          reassignSlot={(close) => (
            <PrimitivePicker
              role={role}
              def={def}
              tokens={tokens}
              suggestedId={suggestedByRole.get(role)}
              holderLabel={holderLabel}
              onAssign={(r, id) => {
                onAssign(r, id);
                close();
              }}
              compact
              triggerLabel="Change primitive…"
            />
          )}
        />
      </div>
    );
  };

  const gapRow = (def: RoleDefinition) => (
    <div
      key={def.role}
      id={rowId(def.role)}
      className={`flex flex-col gap-3 rounded-md border-2 border-dashed border-border-default bg-surface-page p-4 ${
        focusRoleId === def.role ? "ring-2 ring-brand-primary ring-offset-2" : ""
      }`}
    >
      <div className="flex flex-col gap-1">
        <span className="flex items-center gap-2 font-mono text-caption font-medium text-text-muted">
          {def.role}
          <InfoHint content={def.meaning} />
        </span>
        <span className="text-badge text-text-muted">Empty — pick a value for this step</span>
      </div>
      <PrimitivePicker
        role={def.role}
        def={def}
        tokens={tokens}
        suggestedId={suggestedByRole.get(def.role)}
        holderLabel={holderLabel}
        onAssign={onAssign}
      />
    </div>
  );

  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
          Scale
        </h4>
        <p className="text-caption text-text-muted">
          Full ladder — <span className="font-mono">xs · sm · md · lg · xl · 2xl</span>. Every step
          stays visible; empty ones wait for a pick.
        </p>
      </div>
      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
        {SPACE_SLOTS.map((def) => {
          const token = roleEntries.get(def.role);
          if (token) return filledRow(def.role, token, def);
          return gapRow(def);
        })}
      </div>
    </section>
  );
}
