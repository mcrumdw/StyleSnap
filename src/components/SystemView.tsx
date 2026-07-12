import { useMemo, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { AccentSuggestion, Harmony } from "../engine/derive-system";
import {
  COLOR_ROLES,
  fallbackName,
  roleDefinition,
  roleOrderIndex,
  TYPE_ROLES,
  type RoleDefinition,
} from "../engine/roles";
import type { FillInfo, FillOrigin } from "../state/useSessionViewModel";
import { formatValue } from "../state/workspace";
import { Button } from "./Button";

export type { FillInfo } from "../state/useSessionViewModel";

interface SystemViewProps {
  /** The effective view: captured + derived tokens, user names overlaid. */
  tokens: StyleSnapToken[];
  /** Effective role → token id (captured assignments + draft fills). */
  assignments: Record<string, string>;
  /** Phase 10 — how each role was filled; roles absent here are user/captured assignments. */
  fills?: Record<string, FillInfo>;
  /** Phase 10 — the accent suggestion card (null = dismissed or second hue exists). */
  accent?: AccentSuggestion | null;
  accentHarmony?: Harmony;
  onAccentHarmony?: (harmony: Harmony) => void;
  onAccentDismiss?: () => void;
  /** Phase 10 — hand-edit a derived value (dirty-flags it) / reset to derived. */
  onEditDerived?: (role: string, token: StyleSnapToken) => void;
  onResetDerived?: (role: string) => void;
  /** Gap slots jump to the anchors & meaning step. */
  onGoToGaps: () => void;
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

const HARMONIES: Harmony[] = ["complementary", "split-complementary", "analogous"];
const HARMONY_LABELS: Record<Harmony, string> = {
  complementary: "Complementary — maximum pop",
  "split-complementary": "Split-complementary — contrast without clash",
  analogous: "Analogous — quiet harmony",
};

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * Phase 10 — "Your system": the complete auto-drafted system, reviewed by
 * exception. Three visual states only (10c progressive disclosure):
 * captured = solid border · derived = dashed · edited = corner dot.
 * Provenance and the derivation formula live in a click-popover, never inline.
 */
export function SystemView({
  tokens,
  assignments,
  fills = {},
  accent,
  accentHarmony,
  onAccentHarmony,
  onAccentDismiss,
  onEditDerived,
  onResetDerived,
  onGoToGaps,
}: SystemViewProps) {
  const byId = useMemo(() => new Map(tokens.map((t) => [t.id, t])), [tokens]);
  const [openRole, setOpenRole] = useState<string | null>(null);
  const [editHex, setEditHex] = useState("");

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

  // Primitives strip: CAPTURED color primitives only, by occurrences.
  const colorPrimitives = useMemo(
    () =>
      tokens
        .filter((t) => t.type === "color" && !t.id.startsWith("derived_"))
        .sort((a, b) => b.occurrences - a.occurrences || (nameOf(a) < nameOf(b) ? -1 : 1)),
    [tokens],
  );

  const originOf = (role: string): FillOrigin | "assigned" =>
    fills[role]?.origin ?? "assigned";

  const rowBorder = (role: string) =>
    originOf(role) === "derived" ? "border-dashed border-border-default" : "border-border-default";

  // Explicit marking (user testing 2026-07-06): an "auto" chip on every
  // automatically filled value, a dot on hand-edited ones.
  const originMark = (role: string) => {
    const origin = originOf(role);
    if (origin === "derived") {
      return (
        <span
          className="absolute -right-1.5 -top-2.5 rounded-sm border-2 border-border-default bg-brand-pop px-1 font-mono text-badge font-medium text-text-primary"
          title="Filled in automatically — click for the story"
        >
          auto
        </span>
      );
    }
    if (origin === "edited") {
      return (
        <span
          className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-brand-primary"
          title="You edited this value"
          aria-label="edited by you"
        />
      );
    }
    return null;
  };

  const openPopover = (role: string, token: StyleSnapToken) => {
    if (openRole === role) {
      setOpenRole(null);
      return;
    }
    setOpenRole(role);
    setEditHex(token.type === "color" ? token.value : "");
  };

  const popover = (role: string, token: StyleSnapToken) => {
    if (openRole !== role) return null;
    const info = fills[role];
    const editable = info && info.origin !== "captured" && token.type === "color" && onEditDerived;
    const anchorToken = info ? byId.get(info.derivedFrom) : undefined;
    return (
      <div className="absolute left-0 top-full z-dropdown mt-2 w-72 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-modal">
        <p className="text-caption text-text-primary">
          {info
            ? info.origin === "captured"
              ? `From your capture — ${info.method}.`
              : `We made this: ${info.method}${
                  anchorToken ? ` from ${nameOf(anchorToken)}` : ""
                }.`
            : `From your capture (${token.source}, ×${token.occurrences}).`}
        </p>
        {editable && (
          <div className="mt-2 flex items-center gap-2">
            {/* Visual picker + hex input + screen eyedropper (2026-07-06 fix-up). */}
            <input
              type="color"
              value={HEX_RE.test(editHex) ? editHex : "#000000"}
              onChange={(e) => setEditHex(e.target.value.toUpperCase())}
              aria-label={`Pick ${role} color`}
              className="h-btn-sm w-10 cursor-pointer rounded-sm border-2 border-border-default bg-surface-card p-0.5"
            />
            <input
              value={editHex}
              onChange={(e) => setEditHex(e.target.value)}
              aria-label={`Edit ${role} value`}
              className="h-btn-sm w-24 rounded-sm border-2 border-border-default bg-surface-card px-2 font-mono text-caption"
            />
            {"EyeDropper" in window && (
              <Button
                size="sm"
                variant="secondary"
                title="Pick a color from anywhere on screen"
                onClick={async () => {
                  try {
                    const picker = new (
                      window as unknown as {
                        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
                      }
                    ).EyeDropper();
                    const result = await picker.open();
                    setEditHex(result.sRGBHex.toUpperCase());
                  } catch {
                    // user cancelled the eyedropper — nothing to do
                  }
                }}
              >
                💧
              </Button>
            )}
            <Button
              size="sm"
              disabled={!HEX_RE.test(editHex)}
              onClick={() => {
                onEditDerived(role, { ...token, value: editHex.toUpperCase() } as StyleSnapToken);
                setOpenRole(null);
              }}
            >
              Save
            </Button>
          </div>
        )}
        {info && info.origin === "edited" && onResetDerived && (
          <Button
            size="sm"
            variant="ghost"
            className="mt-2"
            onClick={() => {
              onResetDerived(role);
              setOpenRole(null);
            }}
          >
            Reset to derived
          </Button>
        )}
      </div>
    );
  };

  const filledRow = (role: string, token: StyleSnapToken) => (
    <div key={role} className="relative">
      <button
        type="button"
        onClick={() => openPopover(role, token)}
        className={`relative flex w-full items-center gap-3 rounded-md border-2 bg-surface-card p-3 text-left shadow-card ${rowBorder(role)}`}
      >
        {originMark(role)}
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
      </button>
      {popover(role, token)}
    </div>
  );

  const gapRow = (def: RoleDefinition) => (
    <button
      key={def.role}
      type="button"
      onClick={onGoToGaps}
      title="Open anchors & meaning to fill this"
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
            <div key={role} className="relative">
              <button
                type="button"
                onClick={() => openPopover(role, token)}
                className={`relative flex items-center gap-2 rounded-md border-2 bg-surface-card px-3 py-2 ${rowBorder(role)}`}
              >
                {originMark(role)}
                <span className="font-mono text-badge text-brand-primary">{role}</span>
                <span className="font-mono text-badge text-text-muted">{formatValue(token)}</span>
              </button>
              {popover(role, token)}
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
        <p className="text-base text-text-muted">
          Import a capture first — your system builds itself from there.
        </p>
      </section>
    );
  }

  return (
    <section className="flex w-full flex-col gap-10">
      {/* One-line legend — the only badge vocabulary on this screen (10c). */}
      <p className="text-caption text-text-muted">
        <span className="mr-1 inline-block h-3 w-3 rounded-sm border-2 border-border-default align-middle" />{" "}
        from your capture ·{" "}
        <span className="mr-1 rounded-sm border-2 border-border-default bg-brand-pop px-1 font-mono text-badge font-medium text-text-primary">
          auto
        </span>{" "}
        filled in for you ·{" "}
        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-brand-primary align-middle" />{" "}
        you changed it — click any value for the story or to change it.
      </p>

      {/* Accent suggestion (C.5) — a card, never an assignment. */}
      {accent && (
        <section className="flex flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
          <div className="flex items-center justify-between">
            <h3 className="font-heading text-card-title font-medium">
              Want a second color? Your capture only has one hue.
            </h3>
            {onAccentDismiss && (
              <Button size="sm" variant="ghost" onClick={onAccentDismiss}>
                Dismiss
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-3">
            {HARMONIES.map((harmony) => {
              const hex = accent.candidates[harmony];
              const active = (accentHarmony ?? accent.suggested) === harmony;
              return (
                <button
                  key={harmony}
                  type="button"
                  onClick={() => onAccentHarmony?.(harmony)}
                  aria-pressed={active}
                  className={`flex items-center gap-2 rounded-md border-2 px-3 py-2 ${
                    active ? "border-brand-primary shadow-card" : "border-border-default"
                  }`}
                >
                  <span
                    className="h-6 w-6 rounded-sm border-2 border-border-default"
                    style={{ backgroundColor: hex }}
                    aria-hidden
                  />
                  <span className="flex flex-col text-left">
                    <span className="text-caption font-medium text-text-primary">
                      {HARMONY_LABELS[harmony]}
                      {harmony === accent.suggested ? " (our pick)" : ""}
                    </span>
                    <span className="font-mono text-badge text-text-muted">{hex}</span>
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-caption text-text-muted">
            Pick a harmony — your <span className="font-mono">color/action/secondary</span> updates
            instantly in the draft below.
          </p>
        </section>
      )}

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

      {/* Captured color primitives, by occurrences — collapsed detail. */}
      <details className="flex flex-col gap-3">
        <summary className="cursor-pointer font-heading text-card-title font-bold">
          Captured colors ({colorPrimitives.length})
        </summary>
        <div className="mt-3 flex flex-wrap gap-3">
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
                    {refCount} use{refCount === 1 ? "" : "s"}
                  </span>
                ) : (
                  <span className="ml-1 rounded-sm bg-surface-page px-2 py-0.5 font-mono text-badge text-warning-text">
                    not used yet
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </details>

      {/* Same pattern, lighter, for the rest of the system. */}
      <section className="flex flex-col gap-6">
        <h2 className="font-heading text-section-header font-bold">Type & foundations</h2>
        {(() => {
          const typeRows = TYPE_ROLES.flatMap((def) => {
            const token = roleEntries.get(def.role);
            if (!token || token.type !== "typography") return [];
            const v = token.value;
            return [
              <div key={def.role} className="relative">
                <button
                  type="button"
                  onClick={() => openPopover(def.role, token)}
                  className={`relative flex w-full items-baseline gap-3 rounded-md border-2 bg-surface-card px-3 py-2 text-left ${rowBorder(def.role)}`}
                >
                  {originMark(def.role)}
                  <span className="font-mono text-badge text-brand-primary">{def.role}</span>
                  <span className="text-caption text-text-primary">
                    {v.fontFamily} {v.fontSize}px / {v.fontWeight} / {v.lineHeight}
                  </span>
                  <span className="ml-auto font-mono text-badge text-text-muted">{nameOf(token)}</span>
                </button>
                {popover(def.role, token)}
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
              {requiredGaps} required role{requiredGaps === 1 ? "" : "s"} still unfilled.
            </p>
            <Button size="sm" variant="secondary" onClick={onGoToGaps}>
              Fill them
            </Button>
          </div>
        ) : null;
      })()}
    </section>
  );
}
