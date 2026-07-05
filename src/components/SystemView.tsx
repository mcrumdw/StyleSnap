import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import {
  COLOR_ROLES,
  fallbackName,
  roleDefinition,
  roleOrderIndex,
  TYPE_ROLES,
  type RoleDefinition,
} from "../engine/roles";
import { formatValue } from "../state/workspace";
import { Button } from "./Button";

interface SystemViewProps {
  /** The reviewed view: merges applied, user names overlaid. */
  tokens: StyleSnapToken[];
  /** Resolved role → token id (Phase 8). */
  assignments: Record<string, string>;
  /** Gap slots open the gap drawer. */
  onOpenGaps: () => void;
}

const COLOR_SUBSECTIONS = ["text", "surface", "action", "border", "feedback"] as const;
const SUBSECTION_LABELS: Record<(typeof COLOR_SUBSECTIONS)[number], string> = {
  text: "Text",
  surface: "Surface",
  action: "Action",
  border: "Border",
  feedback: "Feedback",
};

function Swatch({ token, size = "h-8 w-8" }: { token: StyleSnapToken; size?: string }) {
  if (token.type !== "color") return null;
  return (
    <span
      className={`${size} shrink-0 rounded-sm border-2 border-border-default`}
      style={{ backgroundColor: token.value, opacity: token.opacity }}
      aria-hidden
    />
  );
}

const nameOf = (token: StyleSnapToken) => token.name ?? fallbackName(token);

/**
 * Phase 8 — the "main primitives + their semantic uses" screen. A primitive
 * referenced by several roles shows the SAME name and swatch each time:
 * visibly "one primitive, many uses", never a suspected duplicate.
 */
export function SystemView({ tokens, assignments, onOpenGaps }: SystemViewProps) {
  const byId = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);

  /** role → the token it points at (dropping stale ids defensively). */
  const roleEntries = useMemo(() => {
    const map = new Map<string, StyleSnapToken>();
    for (const [role, id] of Object.entries(assignments)) {
      const token = byId.get(id);
      if (token) map.set(role, token);
    }
    return map;
  }, [assignments, byId]);

  /** token id → roles referencing it, Appendix B order. */
  const rolesByToken = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [role, token] of roleEntries) {
      map.set(token.id, [...(map.get(token.id) ?? []), role]);
    }
    for (const roles of map.values()) {
      roles.sort((a, b) => roleOrderIndex(a) - roleOrderIndex(b));
    }
    return map;
  }, [roleEntries]);

  // Primitives strip: every color primitive by occurrences, with its role count.
  const colorPrimitives = useMemo(
    () =>
      tokens
        .filter((t) => t.type === "color")
        .sort(
          (a, b) =>
            b.occurrences - a.occurrences || (nameOf(a) < nameOf(b) ? -1 : 1),
        ),
    [tokens],
  );

  const filledRow = (role: string, token: StyleSnapToken) => (
    <div
      key={role}
      className="flex items-center gap-3 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-card"
    >
      <Swatch token={token} />
      <div className="flex min-w-0 flex-col">
        <span className="truncate font-mono text-caption font-medium text-text-primary">
          {nameOf(token)}
        </span>
        <span className="font-mono text-badge text-text-muted">{formatValue(token)}</span>
      </div>
      <span className="ml-auto shrink-0 rounded-sm border-2 border-brand-primary bg-surface-page px-2 py-1 font-mono text-badge text-brand-primary">
        {role}
      </span>
    </div>
  );

  // DESIGN.md drag-affordance dashed border — an unfilled required role.
  const gapRow = (def: RoleDefinition) => (
    <button
      key={def.role}
      type="button"
      onClick={onOpenGaps}
      title="Open the checklist to fill this gap"
      className="flex items-center gap-3 rounded-md border-2 border-dashed border-border-default bg-surface-page p-3 text-left hover:border-brand-primary"
    >
      <span className="h-8 w-8 shrink-0 rounded-sm border-2 border-dashed border-border-default" aria-hidden />
      <div className="flex min-w-0 flex-col">
        <span className="font-mono text-caption text-text-muted">{def.role}</span>
        <span className="text-badge text-text-muted">{def.meaning} — required, unfilled</span>
      </div>
    </button>
  );

  const roleGrid = (defs: RoleDefinition[]) => {
    const rows = defs.flatMap((def) => {
      const token = roleEntries.get(def.role);
      if (token) return [filledRow(def.role, token)];
      if (def.required) return [gapRow(def)];
      return [];
    });
    return rows.length > 0 ? <div className="grid grid-cols-2 gap-3">{rows}</div> : null;
  };

  const foundationSection = (label: string, prefix: string) => {
    const rows = [...roleEntries]
      .filter(([role]) => role.startsWith(prefix))
      .sort(([a], [b]) => roleOrderIndex(a) - roleOrderIndex(b));
    if (rows.length === 0) return null;
    return (
      <section key={prefix} className="flex flex-col gap-3">
        <h3 className="font-heading text-card-title font-bold">{label}</h3>
        <div className="flex flex-wrap gap-3">
          {rows.map(([role, token]) => (
            <div
              key={role}
              className="flex items-center gap-2 rounded-md border-2 border-border-default bg-surface-card px-3 py-2"
            >
              <span className="font-mono text-badge text-brand-primary">{role}</span>
              <span className="font-mono text-badge text-text-muted">{formatValue(token)}</span>
            </div>
          ))}
        </div>
      </section>
    );
  };

  if (tokens.length === 0) {
    return (
      <section className="flex flex-col items-center gap-4 py-16 text-center">
        <h2 className="font-heading text-section-header font-bold">Nothing to show yet</h2>
        <p className="text-base text-text-muted">Import a capture first — the system view fills in as roles are assigned.</p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-10">
      {/* Primitives strip — every color primitive, ordered by occurrences. */}
      <section className="flex flex-col gap-3">
        <h2 className="font-heading text-section-header font-bold">Color primitives</h2>
        <div className="flex flex-wrap gap-3">
          {colorPrimitives.map((token) => {
            const refCount = rolesByToken.get(token.id)?.length ?? 0;
            return (
              <div
                key={token.id}
                className={`flex items-center gap-2 rounded-md border-2 bg-surface-card px-3 py-2 ${
                  refCount === 0 ? "border-dashed border-border-default" : "border-border-default shadow-card"
                }`}
              >
                <Swatch token={token} size="h-6 w-6" />
                <div className="flex flex-col">
                  <span className="font-mono text-badge font-medium text-text-primary">
                    {nameOf(token)}
                  </span>
                  <span className="font-mono text-badge text-text-muted">
                    {formatValue(token)} · ×{token.occurrences}
                  </span>
                </div>
                {refCount > 0 ? (
                  <span className="ml-1 rounded-sm bg-surface-page px-2 py-0.5 font-mono text-badge text-brand-primary">
                    {refCount} role{refCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="ml-1 rounded-sm bg-surface-page px-2 py-0.5 font-mono text-badge text-feedback-warning">
                    unused — assign or drop
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Colors by role subcategory, Appendix B order. */}
      <section className="flex flex-col gap-6">
        <h2 className="font-heading text-section-header font-bold">Colors by use</h2>
        {COLOR_SUBSECTIONS.map((sub) => {
          const defs = COLOR_ROLES.filter((d) => d.role.startsWith(`color/${sub}/`));
          const grid = roleGrid(defs);
          if (!grid) return null;
          return (
            <section key={sub} className="flex flex-col gap-3">
              <h3 className="font-heading text-card-title font-bold">{SUBSECTION_LABELS[sub]}</h3>
              {grid}
            </section>
          );
        })}
      </section>

      {/* Same pattern, lighter, for the rest of the system. */}
      <section className="flex flex-col gap-6">
        <h2 className="font-heading text-section-header font-bold">Type & foundations</h2>
        {(() => {
          const typeRows = TYPE_ROLES.flatMap((def) => {
            const token = roleEntries.get(def.role);
            if (!token || token.type !== "typography") return [];
            const v = token.value;
            return [
              <div
                key={def.role}
                className="flex items-baseline gap-3 rounded-md border-2 border-border-default bg-surface-card px-3 py-2"
              >
                <span className="font-mono text-badge text-brand-primary">{def.role}</span>
                <span className="text-caption text-text-primary">
                  {v.fontFamily} {v.fontSize}px / {v.fontWeight} / {v.lineHeight}
                </span>
                <span className="ml-auto font-mono text-badge text-text-muted">{nameOf(token)}</span>
              </div>,
            ];
          });
          return typeRows.length > 0 ? (
            <section className="flex flex-col gap-3">
              <h3 className="font-heading text-card-title font-bold">Type</h3>
              <div className="flex flex-col gap-2">{typeRows}</div>
            </section>
          ) : null;
        })()}
        {foundationSection("Spacing", "space/")}
        {foundationSection("Radius", "radius/")}
        {foundationSection("Border width", "border-width/")}
        {foundationSection("Shadow", "shadow/")}
      </section>

      {(() => {
        const requiredGaps = [...COLOR_ROLES, ...TYPE_ROLES].filter(
          (d) => d.required && !roleEntries.has(d.role) && roleDefinition(d.role),
        ).length;
        return requiredGaps > 0 ? (
          <div className="flex items-center gap-4 rounded-md border-2 border-dashed border-border-default bg-surface-page p-4">
            <p className="text-caption text-text-muted">
              {requiredGaps} required role{requiredGaps === 1 ? "" : "s"} still unfilled — the
              checklist in the gap drawer walks through each one.
            </p>
            <Button size="sm" variant="secondary" onClick={onOpenGaps}>
              Open gaps
            </Button>
          </div>
        ) : null;
      })()}
    </section>
  );
}
