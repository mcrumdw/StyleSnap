import { useMemo, useRef, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import {
  ALL_ROLES,
  COLOR_ROLES,
  fallbackName,
  TYPE_ROLES,
  type RoleDefinition,
} from "../engine/roles";
import { formatValue } from "../state/workspace";
import type { FillInfo } from "../state/useSessionViewModel";
import { RoleFilledRow } from "./RoleValueEditor";
import { RoleChip } from "./RoleChip";

const COLOR_SUBSECTIONS = ["text", "surface", "action", "border", "feedback"] as const;
const SUBSECTION_LABELS: Record<(typeof COLOR_SUBSECTIONS)[number], string> = {
  text: "Text",
  surface: "Surface",
  action: "Action",
  border: "Border",
  feedback: "Feedback",
};

const CHECKERBOARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage: "repeating-conic-gradient(#ECEAF2 0% 25%, #FFFFFF 0% 50%)",
  backgroundSize: "8px 8px",
};

function primitiveListKey(token: StyleSnapToken): string {
  if (token.type === "color") return `${token.value}:${token.opacity}`;
  if (token.type === "typography") return JSON.stringify(token.value);
  return `${token.type}:${formatValue(token)}`;
}

function dedupeCandidates(tokens: StyleSnapToken[]): Array<{ token: StyleSnapToken; count: number }> {
  const map = new Map<string, { token: StyleSnapToken; count: number }>();
  for (const t of tokens) {
    const key = primitiveListKey(t);
    const existing = map.get(key);
    if (existing) {
      existing.count++;
      if (t.name && !existing.token.name) existing.token = t;
    } else {
      map.set(key, { token: t, count: 1 });
    }
  }
  return [...map.values()].sort((a, b) => nameOf(a.token).localeCompare(nameOf(b.token)));
}

/** Compact type-aware thumbnail for picker rows (24×24). */
function PrimitiveThumb({ token }: { token: StyleSnapToken }) {
  const frame = "h-6 w-6 shrink-0 overflow-hidden rounded-sm border-2 border-border-default";

  switch (token.type) {
    case "color":
      return (
        <span className={frame} style={token.opacity < 1 ? CHECKERBOARD : undefined}>
          <span
            className="block h-full w-full"
            style={{ backgroundColor: token.value, opacity: token.opacity }}
            aria-hidden
          />
        </span>
      );
    case "gradient":
      return (
        <span
          className={frame}
          style={{
            backgroundImage: `linear-gradient(135deg, ${token.value.stops.map((s) => s.color).join(", ")})`,
          }}
          aria-hidden
        />
      );
    case "typography":
      return (
        <span
          className={`${frame} flex items-center justify-center bg-surface-page font-body text-badge text-text-primary`}
          style={{ fontFamily: token.value.fontFamily, fontWeight: token.value.fontWeight }}
          aria-hidden
        >
          Aa
        </span>
      );
    case "spacing":
      return (
        <span className={`${frame} flex items-center justify-center bg-surface-page`} aria-hidden>
          <span
            className="h-1 rounded-sm bg-brand-primary"
            style={{ width: Math.min(token.value, 20) }}
          />
        </span>
      );
    case "border-radius":
      return (
        <span className={`${frame} flex items-center justify-center bg-surface-page`} aria-hidden>
          <span
            className="h-4 w-4 border-2 border-border-default"
            style={{ borderRadius: `${Math.min(token.value, 12)}px 0 0 0` }}
          />
        </span>
      );
    case "border-width":
      return (
        <span className={`${frame} flex items-center justify-center bg-surface-page`} aria-hidden>
          <span
            className="w-4 border-border-default"
            style={{ borderTopWidth: token.value, borderTopStyle: "solid" }}
          />
        </span>
      );
    case "shadow":
      return (
        <span className={`${frame} flex items-center justify-center bg-surface-page p-0.5`} aria-hidden>
          <span className="h-3 w-3 rounded-sm bg-surface-card shadow-sm" />
        </span>
      );
  }
}

function Swatch({ token, size = "h-8 w-8" }: { token: StyleSnapToken; size?: string }) {
  if (token.type !== "color") return <PrimitiveThumb token={token} />;
  return (
    <span className={`${size} shrink-0 overflow-hidden rounded-sm border-2 border-border-default`}>
      <span
        className="block h-full w-full"
        style={
          token.opacity < 1
            ? { ...CHECKERBOARD, backgroundColor: token.value, opacity: token.opacity }
            : { backgroundColor: token.value, opacity: token.opacity }
        }
        aria-hidden
      />
    </span>
  );
}

const nameOf = (token: StyleSnapToken) => token.name ?? fallbackName(token);

function PrimitiveListRow({
  token,
  count,
  onPick,
}: {
  token: StyleSnapToken;
  count: number;
  onPick: () => void;
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onPick}
        className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-state-disabled-bg"
      >
        <PrimitiveThumb token={token} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate font-mono text-caption text-text-primary">{nameOf(token)}</span>
          <span className="truncate font-mono text-badge text-text-muted">
            {formatValue(token)}
            {count > 1 && ` · ${count} captures`}
          </span>
        </span>
      </button>
    </li>
  );
}

function PrimitivePicker({
  role,
  def,
  tokens,
  suggestedId,
  holderLabel,
  onAssign,
}: {
  role: string;
  def: RoleDefinition;
  tokens: StyleSnapToken[];
  suggestedId?: string;
  holderLabel: (role: string) => string | undefined;
  onAssign: (role: string, tokenId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const candidates = useMemo(
    () => tokens.filter((t) => t.type === def.tokenType),
    [tokens, def.tokenType],
  );
  const deduped = useMemo(() => dedupeCandidates(candidates), [candidates]);
  const suggested = suggestedId ? candidates.find((t) => t.id === suggestedId) : undefined;
  const holder = holderLabel(role);

  const q = query.toLowerCase().trim();
  const matches = deduped.filter(
    ({ token }) =>
      nameOf(token).toLowerCase().includes(q) || formatValue(token).toLowerCase().includes(q),
  );
  const suggestedEntry = suggested
    ? (matches.find(({ token }) => token.id === suggested.id) ?? { token: suggested, count: 1 })
    : undefined;
  const listMatches = suggestedEntry
    ? matches.filter(({ token }) => token.id !== suggestedEntry.token.id)
    : matches;

  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const pick = (tokenId: string) => {
    onAssign(role, tokenId);
    close();
  };

  if (suggested && !holder) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onAssign(role, suggested.id)} className="inline-flex">
          <RoleChip role={role} />
        </button>
        <PrimitiveThumb token={suggested} />
        <span className="text-badge text-text-muted">
          → {nameOf(suggested)} ({formatValue(suggested)})
        </span>
      </div>
    );
  }

  if (candidates.length === 0) {
    return <span className="text-caption text-text-muted">No {def.tokenType} primitives captured yet.</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div
        className="relative"
        onKeyDown={(e) => {
          if (open && e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`Pick primitive for ${role}`}
          className="inline-flex h-btn-sm items-center gap-2 rounded-sm border-2 border-border-default bg-surface-card px-2 font-mono text-caption text-text-primary hover:border-brand-primary"
        >
          <span className="text-text-muted">Pick primitive…</span>
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-sticky" onClick={close} />
            <div className="absolute left-0 top-full z-dropdown mt-2 w-80 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-modal">
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search name or value…"
                aria-label="Search primitives"
                className="mb-2 w-full rounded-sm border-2 border-border-default bg-surface-card px-2 py-1 font-mono text-caption text-text-primary placeholder:text-text-muted"
              />
              <ul role="listbox" className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
                {suggestedEntry && (
                  <li className="mb-1 border-b-2 border-border-default pb-1">
                    <span className="px-2 font-mono text-badge text-text-muted">Suggested</span>
                    <PrimitiveListRow
                      token={suggestedEntry.token}
                      count={suggestedEntry.count}
                      onPick={() => pick(suggestedEntry.token.id)}
                    />
                  </li>
                )}
                {listMatches.map(({ token, count }) => (
                  <PrimitiveListRow
                    key={token.id}
                    token={token}
                    count={count}
                    onPick={() => pick(token.id)}
                  />
                ))}
                {listMatches.length === 0 && !suggestedEntry && (
                  <li className="px-2 py-1 text-caption text-text-muted">No matching primitive.</li>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
      {holder && (
        <span className="text-badge text-text-muted">
          Currently → {holder} — pick another to reassign
        </span>
      )}
    </div>
  );
}

interface EditRolesPanelProps {
  tokens: StyleSnapToken[];
  assignments: Record<string, string>;
  /** role → how the slot was filled (derived / captured / edited). */
  fills?: Record<string, FillInfo>;
  /** role → top suggested token id */
  /** role → display token (draftFills overlay — includes derivedEdits). */
  roleTokens?: Map<string, StyleSnapToken>;
  suggestedByRole: Map<string, string>;
  holderLabel: (role: string) => string | undefined;
  onAssign: (role: string, tokenId: string) => void;
  onUnassign: (role: string) => void;
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
  suggestedByRole,
  holderLabel,
  onAssign,
  onUnassign,
  onEditDerived,
  onResetDerived,
  focusRoleId,
  rolePrefix,
}: EditRolesPanelProps) {
  const byId = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);

  const roleEntries = useMemo(() => {
    const map = new Map<string, StyleSnapToken>();
    for (const [role, id] of Object.entries(assignments)) {
      const token = roleTokens?.get(role) ?? byId.get(id);
      if (token) map.set(role, token);
    }
    return map;
  }, [assignments, byId, roleTokens]);

  const rowId = (role: string) => `role-${role.replace(/\//g, "-")}`;

  const filledRow = (role: string, token: StyleSnapToken) => {
    const fillInfo = fills[role];
    const anchorToken = fillInfo?.derivedFrom ? byId.get(fillInfo.derivedFrom) : undefined;
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
        swatch={<Swatch token={token} />}
        name={nameOf(token)}
        valueLabel={formatValue(token)}
        onUnassign={() => onUnassign(role)}
        onEditDerived={onEditDerived}
        onResetDerived={onResetDerived}
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
        <span className="font-mono text-caption font-medium text-text-muted">{def.role}</span>
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
      if (token) return [filledRow(def.role, token)];
      if (def.required || suggestedByRole.has(def.role)) return [gapRow(def)];
      return [];
    });
    return rows.length > 0 ? <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">{rows}</div> : null;
  };

  const foundationSection = (label: string, prefix: string) => {
    const defs = ALL_ROLES.filter((d) => d.role.startsWith(prefix));
    const rows = defs.flatMap((def) => {
      const token = roleEntries.get(def.role);
      if (token) return [filledRow(def.role, token)];
      if (def.required) return [gapRow(def)];
      return [];
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
        <h2 className="font-heading text-card-title font-bold">Semantic roles</h2>
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
            if (token) return [filledRow(def.role, token)];
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
      {show("shadow/") && foundationSection("Shadow", "shadow/")}
    </section>
  );
}
