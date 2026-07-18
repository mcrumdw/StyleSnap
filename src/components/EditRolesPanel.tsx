import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import {
  ALL_ROLES,
  COLOR_ROLES,
  fallbackName,
  TYPE_ROLES,
  type RoleDefinition,
} from "../engine/roles";
import { buildPreviewContext } from "../state/token-display";
import type { FillInfo } from "../state/useSessionViewModel";
import { PrimitivePicker } from "./PrimitivePicker";
import { RoleFilledRow } from "./RoleValueEditor";
import { InfoHint } from "./Tooltip";

const COLOR_SUBSECTIONS = ["text", "surface", "action", "border", "feedback"] as const;
const SUBSECTION_LABELS: Record<(typeof COLOR_SUBSECTIONS)[number], string> = {
  text: "Text",
  surface: "Surface",
  action: "Action",
  border: "Border",
  feedback: "Feedback",
};

const nameOf = (token: StyleSnapToken) => token.name ?? fallbackName(token);

interface EditRolesPanelProps {
  tokens: StyleSnapToken[];
  assignments: Record<string, string>;
  /** role → how the slot was filled (derived / captured / edited). */
  fills?: Record<string, FillInfo>;
  /** role → top suggested token id */
  /** role → display token (draftFills overlay — includes derivedEdits). */
  roleTokens?: Map<string, StyleSnapToken>;
  /** role → display token; derivedEdits always win (preferred for filled rows). */
  roleDisplayTokens?: Map<string, StyleSnapToken>;
  suggestedByRole: Map<string, string>;
  holderLabel: (role: string) => string | undefined;
  onAssign: (role: string, tokenId: string) => void;
  onUnassign: (role: string) => void;
  /** Roles explicitly assigned by the user — derived auto-fills are not removable. */
  userAssignments?: Record<string, string>;
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
  focusRoleId?: string;
  /** App-shell category pages: render only the slice for this role prefix. */
  rolePrefix?: "color/" | "type/" | "space/" | "radius/" | "border-width/" | "shadow/";
}

/**
 * Edit · Roles — semantic layer in the foreground. Each role slot shows its
 * assigned primitive (or a gap slot) with pick/confirm controls.
 */
export function EditRolesPanel({
  tokens,
  assignments,
  fills = {},
  roleTokens,
  roleDisplayTokens,
  suggestedByRole,
  holderLabel,
  onAssign,
  onUnassign,
  userAssignments,
  onEditDerived,
  onResetDerived,
  focusRoleId,
  rolePrefix,
}: EditRolesPanelProps) {
  const byId = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);

  const roleEntries = useMemo(() => {
    const map = new Map<string, StyleSnapToken>();
    const display = roleDisplayTokens ?? roleTokens;
    if (display) {
      for (const [role, token] of display) {
        map.set(role, token);
      }
    }
    for (const [role, id] of Object.entries(assignments)) {
      if (map.has(role)) continue;
      const token = byId.get(id);
      if (token) map.set(role, token);
    }
    return map;
  }, [assignments, byId, roleDisplayTokens, roleTokens]);

  const previewContext = useMemo(() => buildPreviewContext(roleEntries), [roleEntries]);

  const rowId = (role: string) => `role-${role.replace(/\//g, "-")}`;

  const filledRow = (role: string, token: StyleSnapToken, def: RoleDefinition) => {
    const fillInfo = fills[role];
    const anchorToken = fillInfo?.derivedFrom ? byId.get(fillInfo.derivedFrom) : undefined;
    const canUnassign = Boolean(userAssignments && role in userAssignments);
    return (
      <RoleFilledRow
        key={role}
        role={role}
        token={token}
        fills={fills}
        fillInfo={fillInfo}
        anchorToken={anchorToken}
        focusRoleId={focusRoleId}
        rowId={rowId(role)}
        name={nameOf(token)}
        roleMeaning={def.meaning}
        onUnassign={canUnassign ? () => onUnassign(role) : undefined}
        onEditDerived={onEditDerived}
        onResetDerived={onResetDerived}
        previewContext={previewContext}
        reassignSlot={
          <PrimitivePicker
            role={role}
            def={def}
            tokens={tokens}
            suggestedId={suggestedByRole.get(role)}
            holderLabel={holderLabel}
            onAssign={onAssign}
            compact
            triggerLabel="Change primitive…"
          />
        }
      />
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
        <span className="text-badge text-text-muted">
          {def.meaning}
          {def.required ? " — required" : ""}
        </span>
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

  const roleGrid = (defs: RoleDefinition[]) => {
    const rows = defs.flatMap((def) => {
      const token = roleEntries.get(def.role);
      if (token) return [filledRow(def.role, token, def)];
      if (def.required || suggestedByRole.has(def.role)) return [gapRow(def)];
      return [];
    });
    return rows.length > 0 ? <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{rows}</div> : null;
  };

  const foundationSection = (label: string, prefix: string) => {
    const defs = ALL_ROLES.filter((d) => d.role.startsWith(prefix));
    const rows = defs.flatMap((def) => {
      const token = roleEntries.get(def.role);
      if (token) return [filledRow(def.role, token, def)];
      // Show all foundation slots so users can assign orphans.
      return [gapRow(def)];
    });
    if (rows.length === 0) return null;
    return (
      <section key={prefix} className="flex flex-col gap-3">
        <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
          {label}
        </h4>
        <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{rows}</div>
      </section>
    );
  };

  // Category pages (app shell): render only the matching slice.
  const show = (prefix: string) => rolePrefix === undefined || rolePrefix === prefix;

  return (
    <section className="flex w-full flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
          Roles
        </h3>
        <p className="text-caption text-text-muted">
          Assign meaning to your primitives — one primitive can fill several roles.
        </p>
      </div>

      {show("color/") && (
        <section className="flex flex-col gap-6">
          {COLOR_SUBSECTIONS.map((sub) => {
            const defs = COLOR_ROLES.filter((d) => d.role.startsWith(`color/${sub}/`));
            const grid = roleGrid(defs);
            if (!grid) return null;
            return (
              <section key={sub} className="flex flex-col gap-3">
                <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
                  {SUBSECTION_LABELS[sub]}
                </h4>
                {grid}
              </section>
            );
          })}
        </section>
      )}

      {show("type/") &&
        (() => {
          const typeRows = TYPE_ROLES.flatMap((def) => {
            const token = roleEntries.get(def.role);
            if (token) return [filledRow(def.role, token, def)];
            if (def.required || suggestedByRole.has(def.role)) return [gapRow(def)];
            return [];
          });
          if (typeRows.length === 0) return null;
          return (
            <section className="flex flex-col gap-3">
              <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
                Type
              </h4>
              <div className="grid grid-cols-1 gap-3">{typeRows}</div>
            </section>
          );
        })()}
      {show("space/") && foundationSection("Spacing", "space/")}
      {show("radius/") && foundationSection("Radius", "radius/")}
      {show("border-width/") && foundationSection("Border width", "border-width/")}
      {show("shadow/") && foundationSection("Effects", "shadow/")}
    </section>
  );
}
