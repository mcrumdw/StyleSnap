import { useMemo, useRef, useState, type ReactNode } from "react";
import type { StyleSnapToken } from "../contract/types";
import {
  isBackdropBlurToken,
  isDropShadowToken,
  isInsetShadowToken,
} from "../engine/effect-kinds";
import { fallbackName, type RoleDefinition } from "../engine/roles";
import { formatValue } from "../state/workspace";
import { RoleChip } from "./RoleChip";

const CHECKERBOARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage: "repeating-conic-gradient(#ECEAF2 0% 25%, #FFFFFF 0% 50%)",
  backgroundSize: "8px 8px",
};

function isSystemCreated(token: StyleSnapToken): boolean {
  return token.id.startsWith("derived_");
}

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
export function PrimitiveThumb({ token }: { token: StyleSnapToken }) {
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

const nameOf = (token: StyleSnapToken) => token.name ?? fallbackName(token);

function PrimitiveListRow({
  token,
  count,
  onPick,
  system,
}: {
  token: StyleSnapToken;
  count: number;
  onPick: () => void;
  system?: boolean;
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
          <span className="flex items-center gap-2 truncate font-mono text-caption text-text-primary">
            <span className="truncate">{nameOf(token)}</span>
            {system && (
              <span
                className="shrink-0 font-mono text-badge text-text-muted"
                title="System-created for a missing semantic role"
              >
                system
              </span>
            )}
          </span>
          <span className="truncate font-mono text-badge text-text-muted">
            {formatValue(token)}
            {count > 1 && ` · ${count} captures`}
          </span>
        </span>
      </button>
    </li>
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <li className="sticky top-0 bg-surface-card px-2 py-1 font-mono text-badge text-text-muted">
      {children}
    </li>
  );
}

interface PrimitivePickerProps {
  role: string;
  def: RoleDefinition;
  tokens: StyleSnapToken[];
  suggestedId?: string;
  holderLabel: (role: string) => string | undefined;
  onAssign: (role: string, tokenId: string) => void;
  /** Compact trigger for filled-row reassignment. */
  compact?: boolean;
  triggerLabel?: string;
}

/** Searchable primitive picker for gap rows and filled-row reassignment. */
export function PrimitivePicker({
  role,
  def,
  tokens,
  suggestedId,
  holderLabel,
  onAssign,
  compact = false,
  triggerLabel = "Pick primitive…",
}: PrimitivePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const triggerRef = useRef<HTMLButtonElement>(null);

  const isColor = def.tokenType === "color";

  const candidates = useMemo(
    () =>
      tokens.filter((t) => {
        if (t.type !== def.tokenType) return false;
        // Colors: include system-created (derived_*). Other types: snap/manual only.
        if (!isColor && t.id.startsWith("derived_")) return false;
        if (t.type === "shadow") {
          const blur = isBackdropBlurToken(t);
          const inset = isInsetShadowToken(t);
          const drop = isDropShadowToken(t);
          const blurRole = role.startsWith("effect/") || role.startsWith("blur/");
          if (blurRole) return blur;
          if (role === "shadow/inset") return inset;
          if (role === "shadow/sm" || role === "shadow/md" || role === "shadow/lg") return drop;
          if (role.startsWith("shadow/")) return !blur;
        }
        return true;
      }),
    [tokens, def.tokenType, isColor, role],
  );

  const snapCandidates = useMemo(
    () => candidates.filter((t) => !isSystemCreated(t)),
    [candidates],
  );
  const systemCandidates = useMemo(
    () => (isColor ? candidates.filter((t) => isSystemCreated(t)) : []),
    [candidates, isColor],
  );

  const snapDeduped = useMemo(() => dedupeCandidates(snapCandidates), [snapCandidates]);
  const systemDeduped = useMemo(() => dedupeCandidates(systemCandidates), [systemCandidates]);

  const suggested = suggestedId ? candidates.find((t) => t.id === suggestedId) : undefined;
  const holder = holderLabel(role);

  const q = query.toLowerCase().trim();
  const filterEntry = (entry: { token: StyleSnapToken; count: number }) =>
    nameOf(entry.token).toLowerCase().includes(q) ||
    formatValue(entry.token).toLowerCase().includes(q);

  const snapMatches = snapDeduped.filter(filterEntry);
  const systemMatches = systemDeduped.filter(filterEntry);

  const suggestedEntry = suggested
    ? ({ token: suggested, count: 1 } as const)
    : undefined;
  const suggestedIsSystem = suggested ? isSystemCreated(suggested) : false;

  const snapList = suggestedEntry && !suggestedIsSystem
    ? snapMatches.filter(({ token }) => token.id !== suggestedEntry.token.id)
    : snapMatches;
  const systemList = suggestedEntry && suggestedIsSystem
    ? systemMatches.filter(({ token }) => token.id !== suggestedEntry.token.id)
    : systemMatches;

  const close = () => {
    setOpen(false);
    setQuery("");
    triggerRef.current?.focus();
  };

  const pick = (tokenId: string) => {
    onAssign(role, tokenId);
    close();
  };

  if (!compact && suggested && !holder) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => onAssign(role, suggested.id)} className="inline-flex">
          <RoleChip role={role} />
        </button>
        <PrimitiveThumb token={suggested} />
        <span className="text-badge text-text-muted">
          → {nameOf(suggested)} ({formatValue(suggested)})
          {isSystemCreated(suggested) ? " · system" : ""}
        </span>
      </div>
    );
  }

  if (candidates.length === 0) {
    return <span className="text-caption text-text-muted">No {def.tokenType} primitives captured yet.</span>;
  }

  const showSections = isColor && (snapList.length > 0 || systemList.length > 0 || suggestedEntry);

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
          <span className="text-text-muted">{triggerLabel}</span>
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
                      system={suggestedIsSystem}
                      onPick={() => pick(suggestedEntry.token.id)}
                    />
                  </li>
                )}

                {showSections ? (
                  <>
                    {snapList.length > 0 && (
                      <>
                        <SectionLabel>From snap</SectionLabel>
                        {snapList.map(({ token, count }) => (
                          <PrimitiveListRow
                            key={token.id}
                            token={token}
                            count={count}
                            onPick={() => pick(token.id)}
                          />
                        ))}
                      </>
                    )}
                    {systemList.length > 0 && (
                      <>
                        <SectionLabel>System-created</SectionLabel>
                        {systemList.map(({ token, count }) => (
                          <PrimitiveListRow
                            key={token.id}
                            token={token}
                            count={count}
                            system
                            onPick={() => pick(token.id)}
                          />
                        ))}
                      </>
                    )}
                    {snapList.length === 0 && systemList.length === 0 && !suggestedEntry && (
                      <li className="px-2 py-1 text-caption text-text-muted">No matching primitive.</li>
                    )}
                  </>
                ) : (
                  <>
                    {snapList.map(({ token, count }) => (
                      <PrimitiveListRow
                        key={token.id}
                        token={token}
                        count={count}
                        onPick={() => pick(token.id)}
                      />
                    ))}
                    {snapList.length === 0 && !suggestedEntry && (
                      <li className="px-2 py-1 text-caption text-text-muted">No matching primitive.</li>
                    )}
                  </>
                )}
              </ul>
            </div>
          </>
        )}
      </div>
      {!compact && holder && (
        <span className="text-badge text-text-muted">
          Currently → {holder} — pick another to reassign
        </span>
      )}
    </div>
  );
}
