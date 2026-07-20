import { useMemo, useState } from "react";
import type { StyleSnapToken, TokenType } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import {
  effectKindForToken,
  fallbackName,
  isSpaceScaleRole,
  isSpaceSemanticRole,
  SPACE_SCALE_ROLES,
} from "../engine/roles";
import { ELEVATION_ROLE_SET } from "../engine/effect-kinds";
import { isManualToken } from "../state/pool";
import { formatValue } from "../state/workspace";
import { Button } from "./Button";
import { InlineName } from "./InlineName";
import { MergeSurvivorDialog } from "./MergeSurvivorDialog";
import { InfoHint } from "./Tooltip";

/** Assigned foundation slot that can title an unnamed primitive (§2.48 / §2.52). */
function foundationTitleRole(tokenType: TokenType, usedAs: string[]): string | undefined {
  if (tokenType === "spacing") return usedAs.find((r) => isSpaceScaleRole(r));
  if (tokenType === "border-radius") return usedAs.find((r) => r.startsWith("radius/"));
  if (tokenType === "border-width") return usedAs.find((r) => r.startsWith("border-width/"));
  return undefined;
}

interface PrimitiveInventoryProps {
  tokenType: TokenType;
  /** Working-set tokens including derived fills (inventory splits them for colors). */
  tokens: StyleSnapToken[];
  decisions: Record<string, { name?: string }>;
  merges: MergeRecord[];
  assignments: Record<string, string>;
  rawById: ReadonlyMap<string, StyleSnapToken>;
  /** After Create System (FR-13) — hide un-merge / change survivor. */
  mergesLocked?: boolean;
  onSetName: (tokenId: string, name: string | undefined) => void;
  onUnmerge: (survivorId: string) => void;
  onSetMergeSurvivor?: (tokenId: string) => void;
  onExclude: (tokenId: string) => void;
  onRemoveManual: (tokenId: string) => void;
}


function isSystemCreated(token: StyleSnapToken): boolean {
  return token.id.startsWith("derived_");
}

function Preview({ token }: { token: StyleSnapToken }) {
  const frame = "size-10 shrink-0 overflow-hidden rounded-sm border-2 border-border-default";
  if (token.type === "color") {
    return (
      <span
        className={frame}
        style={{ backgroundColor: token.value, opacity: token.opacity }}
        aria-hidden
      />
    );
  }
  if (token.type === "typography") {
    return (
      <span
        className={`${frame} flex items-center justify-center bg-surface-page text-text-primary`}
        style={{
          fontFamily: token.value.fontFamily,
          fontWeight: token.value.fontWeight,
          fontSize: 14,
        }}
        aria-hidden
      >
        Ag
      </span>
    );
  }
  if (token.type === "spacing") {
    return (
      <span className={`${frame} flex items-center justify-center bg-surface-page`} aria-hidden>
        <span className="h-1 rounded-sm bg-brand-primary" style={{ width: Math.min(token.value, 28) }} />
      </span>
    );
  }
  if (token.type === "border-radius") {
    return (
      <span className={`${frame} flex items-center justify-center bg-surface-page`} aria-hidden>
        <span
          className="h-6 w-6 border-2 border-border-default bg-surface-card"
          style={{ borderRadius: `${Math.min(token.value, 12)}px 0 0 0` }}
        />
      </span>
    );
  }
  if (token.type === "border-width") {
    return (
      <span className={`${frame} flex items-center justify-center bg-surface-page`} aria-hidden>
        <span
          className="w-6 border-border-default"
          style={{ borderTopWidth: Math.min(token.value, 6), borderTopStyle: "solid" }}
        />
      </span>
    );
  }
  if (token.type === "shadow") {
    return (
      <span className={`${frame} flex items-center justify-center bg-surface-page p-1`} aria-hidden>
        <span className="h-5 w-5 rounded-sm bg-surface-card shadow-sm" />
      </span>
    );
  }
  return <span className={`${frame} bg-surface-page`} aria-hidden />;
}

function RoleChips({
  roles,
  emphasizeSemantic = false,
}: {
  roles: string[];
  /** Spacing: show jobs (inset/page) as primary chips; scale is the card title. */
  emphasizeSemantic?: boolean;
}) {
  const shown = emphasizeSemantic
    ? roles.filter((r) => !isSpaceScaleRole(r))
    : roles;
  if (shown.length === 0) return null;
  return (
    <span className="flex flex-wrap gap-1">
      {shown.slice(0, 4).map((role) => {
        const semantic = isSpaceSemanticRole(role);
        const label = role.split("/").slice(-1)[0]!;
        return (
          <span
            key={role}
            className={`rounded-sm border-2 px-2 py-0.5 font-mono text-badge ${
              semantic
                ? "border-brand-primary bg-surface-card text-text-primary"
                : "border-border-default bg-surface-card text-text-muted"
            }`}
            title={role}
          >
            {label}
          </span>
        );
      })}
      {shown.length > 4 && (
        <span className="font-mono text-badge text-text-muted">+{shown.length - 4}</span>
      )}
    </span>
  );
}

function MergeBadge({
  mergeCount,
  absorbed,
}: {
  mergeCount: number;
  absorbed: string[];
}) {
  return (
    <span className="inline-flex w-fit items-center gap-1.5 font-mono text-badge text-text-muted">
      {mergeCount}-way merge
      <InfoHint
        content={
          absorbed.length > 0
            ? `Merged from: ${absorbed.join(" · ")}. Un-merge splits them apart again.`
            : "Near-identical captures were merged into this one."
        }
      />
    </span>
  );
}

/**
 * Named inventory the system keeps — rename, un-merge, exclude (captures) or
 * delete (manuals). On Colors, derived fills appear in a collapsed System-created band.
 */
export function PrimitiveInventory({
  tokenType,
  tokens,
  decisions,
  merges,
  assignments,
  rawById,
  mergesLocked = false,
  onSetName,
  onUnmerge,
  onSetMergeSurvivor,
  onExclude,
  onRemoveManual,
}: PrimitiveInventoryProps) {
  const [pickerSurvivorId, setPickerSurvivorId] = useState<string | null>(null);
  const [systemOpen, setSystemOpen] = useState(false);

  const ofType = useMemo(
    () => tokens.filter((t) => t.type === tokenType),
    [tokens, tokenType],
  );

  const rolesByToken = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [role, id] of Object.entries(assignments)) {
      map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }, [assignments]);

  /** Tokens already shown on a scale ladder — don't list them again (§2.48 / §2.50). */
  const scaleTokenIds = useMemo(() => {
    const ids = new Set<string>();
    if (tokenType === "spacing") {
      for (const [role, id] of Object.entries(assignments)) {
        if (SPACE_SCALE_ROLES.has(role)) ids.add(id);
      }
    } else if (tokenType === "shadow") {
      for (const [role, id] of Object.entries(assignments)) {
        if (ELEVATION_ROLE_SET.has(role)) ids.add(id);
      }
    }
    return ids;
  }, [assignments, tokenType]);

  const primitives = useMemo(() => {
    const list = ofType.filter((t) => {
      if (isSystemCreated(t)) return false;
      if ((tokenType === "spacing" || tokenType === "shadow") && scaleTokenIds.has(t.id)) {
        return false;
      }
      return true;
    });
    if (
      tokenType === "spacing" ||
      tokenType === "border-radius" ||
      tokenType === "border-width"
    ) {
      return [...list].sort((a, b) => {
        const av = "value" in a && typeof a.value === "number" ? a.value : 0;
        const bv = "value" in b && typeof b.value === "number" ? b.value : 0;
        return av - bv || (a.id < b.id ? -1 : 1);
      });
    }
    return list;
  }, [ofType, tokenType, scaleTokenIds]);

  const systemCreated = useMemo(
    () =>
      tokenType === "color" ? ofType.filter((t) => isSystemCreated(t)) : [],
    [ofType, tokenType],
  );

  const mergeBySurvivor = useMemo(() => {
    const map = new Map<string, MergeRecord>();
    for (const m of merges) map.set(m.survivorId, m);
    return map;
  }, [merges]);

  const pickerMembers = useMemo(() => {
    if (!pickerSurvivorId || tokenType !== "color") return [];
    const merge = mergeBySurvivor.get(pickerSurvivorId);
    if (!merge) return [];
    return [merge.survivorId, ...merge.mergedIds]
      .map((id) => rawById.get(id))
      .filter(
        (t): t is StyleSnapToken & { type: "color" } =>
          !!t && t.type === "color",
      );
  }, [pickerSurvivorId, mergeBySurvivor, rawById, tokenType]);

  if (primitives.length === 0 && systemCreated.length === 0) {
    return (
      <p className="text-caption text-text-muted">
        {tokenType === "spacing"
          ? "All spacing values sit on the scale above — or add a token for an extra size."
          : tokenType === "shadow"
            ? "Elevation steps live under System roles. Inset and blur primitives appear here when not assigned."
            : "No primitives yet — values appear here after import, or add a token."}
      </p>
    );
  }

  const grid =
    tokenType === "color" || tokenType === "spacing"
      ? "grid grid-cols-1 gap-2 md:grid-cols-2"
      : "flex flex-col gap-2";

  const cardSpan =
    tokenType === "color" || tokenType === "spacing" ? " md:col-span-2" : "";

  return (
    <>
      {primitives.length > 0 && (
        <ul className={grid}>
          {primitives.map((token) => {
            const displayName = decisions[token.id]?.name ?? token.name;
            const merge = mergeBySurvivor.get(token.id);
            const mergeCount = merge ? merge.mergedIds.length + 1 : token.mergedFrom?.length ?? 0;
            const absorbed =
              merge?.mergedIds.map((id) => {
                const raw = rawById.get(id);
                return raw ? formatValue(raw) : id;
              }) ??
              token.mergedFrom?.map((id) => {
                const raw = rawById.get(id);
                return raw ? formatValue(raw) : id;
              }) ??
              [];
            const usedAs = rolesByToken.get(token.id) ?? [];
            const scaleRole = foundationTitleRole(tokenType, usedAs);
            const manual = isManualToken(token);
            const isMerged = mergeCount > 1;
            // Unnamed foundation primitives — title from assigned slot or derived fallback (§2.52).
            const derivedLabel = scaleRole ?? fallbackName(token);
            const titleName = displayName ?? scaleRole ?? null;
            const suggested = derivedLabel;
            const showDerivedTitle =
              !displayName &&
              (scaleRole !== undefined ||
                tokenType === "border-radius" ||
                tokenType === "border-width");

            if (isMerged) {
              return (
                <li
                  key={token.id}
                  className={`flex flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-card${cardSpan}`}
                >
                  {/* Identity: preview + name + value | merge + job tags */}
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    <div className="flex min-w-0 items-start gap-3">
                      <Preview token={token} />
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        {showDerivedTitle ? (
                          <span className="font-mono text-caption font-medium text-text-primary">
                            {derivedLabel}
                          </span>
                        ) : (
                          <InlineName
                            name={titleName}
                            onSetName={(name) => onSetName(token.id, name)}
                            tokenType={token.type}
                            effectKind={effectKindForToken(token)}
                            suggestedName={suggested}
                          />
                        )}
                        <span className="truncate font-mono text-badge text-text-muted">
                          {formatValue(token)}
                          {manual ? " · manual" : " · from capture"}
                        </span>
                        {showDerivedTitle && (
                          <button
                            type="button"
                            className="self-start font-mono text-badge text-brand-primary underline"
                            onClick={() => onSetName(token.id, derivedLabel)}
                            title="Save this path as the primitive name"
                          >
                            Keep as name
                          </button>
                        )}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                      <MergeBadge mergeCount={mergeCount} absorbed={absorbed} />
                      <RoleChips
                        roles={usedAs}
                        emphasizeSemantic={tokenType === "spacing"}
                      />
                    </div>
                  </div>

                  {/* Actions — own band so buttons never sit on the name */}
                  <div
                    className="flex flex-wrap items-center gap-2 border-t-2 border-border-default pt-3"
                    role="group"
                    aria-label="Merge actions"
                  >
                    {!mergesLocked &&
                      merge &&
                      tokenType === "color" &&
                      onSetMergeSurvivor && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => setPickerSurvivorId(token.id)}
                          title="Pick which merged hex the system keeps"
                        >
                          Change merged…
                        </Button>
                      )}
                    {!mergesLocked && merge && (
                      <Button size="sm" variant="secondary" onClick={() => onUnmerge(token.id)}>
                        Un-merge
                      </Button>
                    )}
                    {mergesLocked && merge && (
                      <span
                        className="font-mono text-badge text-text-muted"
                        title="Merges lock after Create System"
                      >
                        Merged · locked
                      </span>
                    )}
                    {manual ? (
                      <Button size="sm" variant="ghost" onClick={() => onRemoveManual(token.id)}>
                        Delete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onExclude(token.id)}
                        title="Remove from system (undoable)"
                        aria-label="Remove"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </li>
              );
            }

            return (
              <li
                key={token.id}
                className="flex flex-col gap-2 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-card"
              >
                <div className="flex min-w-0 items-start gap-3">
                  <Preview token={token} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    {showDerivedTitle ? (
                      <span className="font-mono text-caption font-medium text-text-primary">
                        {derivedLabel}
                      </span>
                    ) : (
                      <InlineName
                        name={titleName}
                        onSetName={(name) => onSetName(token.id, name)}
                        tokenType={token.type}
                        effectKind={effectKindForToken(token)}
                        suggestedName={suggested}
                      />
                    )}
                    <span className="truncate font-mono text-badge text-text-muted">
                      {formatValue(token)}
                      {manual ? " · manual" : ""}
                    </span>
                    {showDerivedTitle && (
                      <button
                        type="button"
                        className="self-start font-mono text-badge text-brand-primary underline"
                        onClick={() => onSetName(token.id, derivedLabel)}
                        title="Save this path as the primitive name"
                      >
                        Keep as name
                      </button>
                    )}
                    <RoleChips
                      roles={usedAs}
                      emphasizeSemantic={tokenType === "spacing"}
                    />
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {manual ? (
                      <Button size="sm" variant="ghost" onClick={() => onRemoveManual(token.id)}>
                        Delete
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => onExclude(token.id)}
                        title="Remove from system (undoable)"
                        aria-label="Remove"
                      >
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {systemCreated.length > 0 && (
        <div className="mt-4 flex flex-col gap-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-2 font-mono text-caption font-medium text-text-primary">
                System-created
                <span className="font-mono text-badge font-normal text-text-muted">system</span>
              </span>
              <p className="text-badge text-text-muted">
                Colors the system made for missing semantic roles.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSystemOpen((o) => !o)}
              aria-expanded={systemOpen}
              className="shrink-0 font-mono text-caption text-text-muted hover:text-brand-primary"
            >
              {systemOpen ? "Hide" : "Show"} · {systemCreated.length}
            </button>
          </div>
          {systemOpen && (
            <ul className={grid}>
              {systemCreated.map((token) => {
                const displayName = decisions[token.id]?.name ?? token.name;
                const usedAs = rolesByToken.get(token.id) ?? [];
                return (
                  <li
                    key={token.id}
                    className="flex min-w-0 items-start gap-3 rounded-md border-2 border-border-default bg-surface-page p-3"
                  >
                    <Preview token={token} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <InlineName
                        name={displayName ?? null}
                        onSetName={(name) => onSetName(token.id, name)}
                        tokenType={token.type}
                        effectKind={effectKindForToken(token)}
                        suggestedName={fallbackName(token)}
                      />
                      <span className="truncate font-mono text-badge text-text-muted">
                        {formatValue(token)}
                        {" · "}
                        <span title="System-created for a missing semantic role">system</span>
                      </span>
                      <RoleChips roles={usedAs} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {pickerSurvivorId && pickerMembers.length > 1 && onSetMergeSurvivor && (
        <MergeSurvivorDialog
          members={pickerMembers}
          currentSurvivorId={pickerSurvivorId}
          onPick={onSetMergeSurvivor}
          onClose={() => setPickerSurvivorId(null)}
        />
      )}
    </>
  );
}

/** Display name helper for callers. */
export function primitiveDisplayName(
  token: StyleSnapToken,
  decisions: Record<string, { name?: string }>,
): string {
  return decisions[token.id]?.name ?? token.name ?? fallbackName(token);
}
