import { useMemo, useState } from "react";
import type { StyleSnapToken, TokenType } from "../contract/types";
import {
  ALL_ROLES,
  COLOR_ROLES,
  buildCustomRole,
  customRoleDefinition,
  fallbackName,
  tokenTypeForRolePrefix,
  TYPE_ROLES,
  type RoleDefinition,
} from "../engine/roles";
import { buildPreviewContext } from "../state/token-display";
import type { FillInfo } from "../state/useSessionViewModel";
import { Button } from "./Button";
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

const INPUT =
  "w-full rounded-sm border-2 border-border-default bg-surface-card px-3 py-2 font-mono text-caption text-text-primary placeholder:text-text-muted";

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
  /** Declared custom roles beyond Appendix B (§2.30). */
  customRoles?: string[];
  onAddCustomRole?: (type: TokenType, pathAfterPrefix: string) => void;
  onRemoveCustomRole?: (role: string) => void;
}

function AddCustomRoleForm({
  prefix,
  tokenType,
  onAdd,
}: {
  prefix: string;
  tokenType: TokenType;
  onAdd: (type: TokenType, pathAfterPrefix: string) => void;
}) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);

  const example =
    tokenType === "color"
      ? "border/card"
      : tokenType === "border-width"
        ? "table-cell"
        : tokenType === "typography"
          ? "label"
          : "card";

  const submit = () => {
    const role = buildCustomRole(tokenType, path);
    if (!role) {
      setError(
        tokenType === "color"
          ? "Use a path like border/card (kebab-case, after color/)."
          : `Use a name like ${example} (kebab-case). Cannot reuse Appendix B slots.`,
      );
      return;
    }
    onAdd(tokenType, path);
    setPath("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border-2 border-dashed border-border-default bg-surface-page p-3">
      <p className="text-caption text-text-muted">
        Add a semantic role under <span className="font-mono text-text-primary">{prefix}</span>
        {tokenType === "border-width" && (
          <>
            {" "}
            — stroke color is on Colors (<span className="font-mono">color/border/…</span>); width
            lives here.
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span className="shrink-0 font-mono text-caption text-text-muted">{prefix}</span>
        <input
          className={`${INPUT} min-w-0 flex-1`}
          value={path}
          onChange={(e) => {
            setPath(e.target.value);
            setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={example}
          aria-label={`Custom role path after ${prefix}`}
        />
        <Button size="sm" variant="secondary" onClick={submit}>
          Add role
        </Button>
      </div>
      {error && <p className="text-caption text-error">{error}</p>}
    </div>
  );
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
  customRoles = [],
  onAddCustomRole,
  onRemoveCustomRole,
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

  const customsForPrefix = useMemo(() => {
    if (!rolePrefix) return customRoles;
    return customRoles.filter((r) => r.startsWith(rolePrefix)).sort();
  }, [customRoles, rolePrefix]);

  const rowId = (role: string) => `role-${role.replace(/\//g, "-")}`;

  const filledRow = (role: string, token: StyleSnapToken, def: RoleDefinition, removable?: boolean) => {
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
        reassignSlot={(close) => (
          <>
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
            {removable && onRemoveCustomRole && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  onRemoveCustomRole(role);
                  close();
                }}
              >
                Remove role
              </Button>
            )}
          </>
        )}
      />
    );
  };

  const gapRow = (def: RoleDefinition, removable?: boolean) => (
    <div
      key={def.role}
      id={rowId(def.role)}
      className={`flex flex-col gap-3 rounded-md border-2 border-dashed border-border-default bg-surface-page p-4 ${
        focusRoleId === def.role ? "ring-2 ring-brand-primary ring-offset-2" : ""
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="flex items-center gap-2 font-mono text-caption font-medium text-text-muted">
            {def.role}
            {removable && (
              <span className="rounded-sm border-2 border-border-default bg-brand-pop px-1.5 py-0.5 font-mono text-badge font-medium text-text-primary">
                custom
              </span>
            )}
            <InfoHint content={def.meaning} />
          </span>
          <span className="text-badge text-text-muted">
            {def.meaning}
            {def.required ? " — required" : ""}
          </span>
        </div>
        {removable && onRemoveCustomRole && (
          <Button size="sm" variant="ghost" onClick={() => onRemoveCustomRole(def.role)}>
            Remove
          </Button>
        )}
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

  const customSection = (prefix: string) => {
    const type = tokenTypeForRolePrefix(prefix);
    if (!type || !onAddCustomRole) return null;
    const defs = customsForPrefix
      .filter((r) => r.startsWith(prefix))
      .map((role) => customRoleDefinition(role, type));
    const rows = defs.flatMap((def) => {
      const token = roleEntries.get(def.role);
      if (token) return [filledRow(def.role, token, def, true)];
      return [gapRow(def, true)];
    });
    return (
      <section className="flex flex-col gap-3">
        {rows.length > 0 && (
          <>
            <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
              Custom roles
            </h4>
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{rows}</div>
          </>
        )}
        <AddCustomRoleForm prefix={prefix} tokenType={type} onAdd={onAddCustomRole} />
      </section>
    );
  };

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
      return [gapRow(def)];
    });
    if (rows.length === 0 && !onAddCustomRole) return null;
    return (
      <section key={prefix} className="flex flex-col gap-3">
        <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
          {label}
        </h4>
        {rows.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{rows}</div>
        )}
        {customSection(prefix)}
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
          Assign meaning to your primitives — one primitive can fill several roles. Add custom
          roles for component semantics (e.g. <span className="font-mono">border-width/card</span>
          ); Appendix B slots stay the completeness checklist.
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
          {customSection("color/")}
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
          return (
            <section className="flex flex-col gap-3">
              <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
                Type
              </h4>
              {typeRows.length > 0 && <div className="grid grid-cols-1 gap-3">{typeRows}</div>}
              {customSection("type/")}
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
