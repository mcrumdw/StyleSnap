import { useMemo, useState } from "react";
import type { StyleSnapToken, TokenType } from "../contract/types";
import {
  ALL_ROLES,
  COLOR_ROLES,
  EFFECT_SEMANTIC_ROLES,
  SHADOW_CUSTOM_PREFIXES,
  SHADOW_SLOTS,
  SPACE_SEMANTIC_ROLES,
  buildCustomRole,
  customRoleDefinition,
  fallbackName,
  isElevationRole,
  isSpaceScaleRole,
  tokenTypeForRolePrefix,
  TYPE_ROLES,
  type RoleDefinition,
  type ShadowCustomPrefix,
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
  onAddCustomRole?: (type: TokenType, pathAfterPrefix: string, prefixOverride?: string) => void;
  onRemoveCustomRole?: (role: string) => void;
}

function AddCustomRoleForm({
  prefix: fixedPrefix,
  tokenType,
  onAdd,
  prefixChoices,
}: {
  prefix: string;
  tokenType: TokenType;
  onAdd: (type: TokenType, pathAfterPrefix: string, prefixOverride?: string) => void;
  /** When set (Effects page), user picks elevation vs blur prefix. */
  prefixChoices?: readonly ShadowCustomPrefix[];
}) {
  const [path, setPath] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [prefix, setPrefix] = useState(fixedPrefix);

  const example =
    tokenType === "color"
      ? "border/card"
      : tokenType === "border-width"
        ? "table-cell"
        : tokenType === "typography"
          ? "label"
          : prefixChoices
            ? "blur1"
            : "card";

  const activePrefix = prefixChoices ? prefix : fixedPrefix;

  const submit = () => {
    const role = buildCustomRole(
      tokenType,
      path,
      prefixChoices ? activePrefix : undefined,
    );
    if (!role) {
      setError(
        tokenType === "color"
          ? "Use a path like border/card (kebab-case, after color/)."
          : `Use a name like ${example} (kebab-case). Cannot reuse Appendix B slots.`,
      );
      return;
    }
    onAdd(tokenType, path, prefixChoices ? activePrefix : undefined);
    setPath("");
    setError(null);
  };

  return (
    <div className="flex flex-col gap-2 rounded-md border-2 border-dashed border-border-default bg-surface-page p-3">
      <p className="text-caption text-text-muted">
        {prefixChoices ? (
          <>
            Add a role for background blur or other non-shadow effects — use{" "}
            <span className="font-mono text-text-primary">effect/</span> or{" "}
            <span className="font-mono text-text-primary">blur/</span>, not{" "}
            <span className="font-mono text-text-primary">shadow/sm</span>.
          </>
        ) : (
          <>
            Add a semantic role under{" "}
            <span className="font-mono text-text-primary">{fixedPrefix}</span>
            {tokenType === "border-width" && (
              <>
                {" "}
                — stroke color is on Colors (<span className="font-mono">color/border/…</span>);
                width lives here.
              </>
            )}
          </>
        )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {prefixChoices ? (
          <select
            className={`${INPUT} w-auto shrink-0`}
            value={activePrefix}
            onChange={(e) => setPrefix(e.target.value)}
            aria-label="Role prefix"
          >
            {prefixChoices.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        ) : (
          <span className="shrink-0 font-mono text-caption text-text-muted">{fixedPrefix}</span>
        )}
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
          aria-label={`Custom role path after ${activePrefix}`}
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
    if (rolePrefix === "shadow/") {
      return customRoles.filter((r) =>
        (SHADOW_CUSTOM_PREFIXES as readonly string[]).some((p) => r.startsWith(p)),
      ).sort();
    }
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

  const customSection = (
    prefix: string,
    options?: {
      prefixChoices?: readonly ShadowCustomPrefix[];
      /** Extra filter after prefix match (e.g. exclude scale steps). */
      excludeRole?: (role: string) => boolean;
    },
  ) => {
    const type = tokenTypeForRolePrefix(prefix);
    if (!type || !onAddCustomRole) return null;
    const defs = customsForPrefix
      .filter((r) => {
        if (options?.prefixChoices) {
          return options.prefixChoices.some((p) => r.startsWith(p));
        }
        return r.startsWith(prefix);
      })
      .filter((r) => !(options?.excludeRole?.(r)))
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
        <AddCustomRoleForm
          prefix={prefix}
          tokenType={type}
          onAdd={onAddCustomRole}
          prefixChoices={options?.prefixChoices}
        />
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

  const foundationSection = (
    label: string,
    prefix: string,
    options?: { includeCustoms?: boolean },
  ) => {
    const defs = ALL_ROLES.filter((d) => d.role.startsWith(prefix));
    const rows = defs.flatMap((def) => {
      const token = roleEntries.get(def.role);
      if (token) return [filledRow(def.role, token, def)];
      return [gapRow(def)];
    });
    const showCustoms = options?.includeCustoms !== false;
    if (rows.length === 0 && !(showCustoms && onAddCustomRole)) return null;
    return (
      <section key={prefix} className="flex flex-col gap-3">
        <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
          {label}
        </h4>
        {rows.length > 0 && (
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{rows}</div>
        )}
        {showCustoms && customSection(prefix)}
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
      {show("space/") && (
        <section className="flex flex-col gap-3">
          <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
            Spacing roles
          </h4>
          <p className="text-caption text-text-muted">
            Layout jobs that point at scale steps. The scale itself (`space/xs`…`2xl`) lives under
            Primitives.
          </p>
          <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
            {SPACE_SEMANTIC_ROLES.flatMap((def) => {
              const token = roleEntries.get(def.role);
              if (token) return [filledRow(def.role, token, def)];
              return [gapRow(def)];
            })}
          </div>
          {customSection("space/", {
            excludeRole: (r) =>
              isSpaceScaleRole(r) || SPACE_SEMANTIC_ROLES.some((d) => d.role === r),
          })}
        </section>
      )}
      {show("radius/") && foundationSection("Radius", "radius/")}
      {show("border-width/") && foundationSection("Border width", "border-width/")}
      {show("shadow/") && (
        <>
          <section className="flex flex-col gap-3">
            <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
              Elevation
            </h4>
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {SHADOW_SLOTS.flatMap((def) => {
                const token = roleEntries.get(def.role);
                if (token) return [filledRow(def.role, token, def)];
                return [gapRow(def)];
              })}
            </div>
            {customSection("shadow/", {
              excludeRole: (r) =>
                isElevationRole(r) || r === "shadow/inset" || !r.startsWith("shadow/"),
            })}
          </section>
          <section className="flex flex-col gap-3">
            <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
              Inner shadow
            </h4>
            <p className="text-caption text-text-muted">
              Pressed wells and recessed depth — seeded from capture when an inset shadow exists.
            </p>
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {EFFECT_SEMANTIC_ROLES.filter((d) => d.role === "shadow/inset").flatMap((def) => {
                const token = roleEntries.get(def.role);
                if (token) return [filledRow(def.role, token, def)];
                return [gapRow(def)];
              })}
            </div>
          </section>
          <section className="flex flex-col gap-3">
            <h4 className="font-heading text-caption font-bold uppercase tracking-wide text-text-muted">
              Background blur
            </h4>
            <p className="text-caption text-text-muted">
              Frosted glass — seeded from capture when backdrop-filter is present.
            </p>
            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
              {EFFECT_SEMANTIC_ROLES.filter((d) => d.role === "blur/backdrop").flatMap((def) => {
                const token = roleEntries.get(def.role);
                if (token) return [filledRow(def.role, token, def)];
                return [gapRow(def)];
              })}
            </div>
            {customSection("effect/", {
              prefixChoices: ["effect/", "blur/"] as const,
              excludeRole: (r) => r === "blur/backdrop",
            })}
          </section>
        </>
      )}
    </section>
  );
}
