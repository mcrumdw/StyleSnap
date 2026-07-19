import { useMemo, useState } from "react";
import type { StyleSnapToken, TokenType } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import { fallbackName } from "../engine/roles";
import { formatValue } from "../state/workspace";
import { Button } from "./Button";
import { InlineName } from "./InlineName";
import { MergeSurvivorDialog } from "./MergeSurvivorDialog";
import { InfoHint } from "./Tooltip";

interface PrimitiveInventoryProps {
  tokenType: TokenType;
  /** Working-set tokens including derived fills (inventory splits them for colors). */
  tokens: StyleSnapToken[];
  decisions: Record<string, { name?: string }>;
  merges: MergeRecord[];
  assignments: Record<string, string>;
  rawById: ReadonlyMap<string, StyleSnapToken>;
  onSetName: (tokenId: string, name: string | undefined) => void;
  onUnmerge: (survivorId: string) => void;
  onSetMergeSurvivor?: (tokenId: string) => void;
  onExclude: (tokenId: string) => void;
  onRemoveManual: (tokenId: string) => void;
}

function isManual(token: StyleSnapToken): boolean {
  return token.id.startsWith("manual_") || token.source === "manual entry";
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

function RoleChips({ roles }: { roles: string[] }) {
  if (roles.length === 0) return null;
  return (
    <span className="flex max-w-xs shrink-0 flex-wrap gap-1">
      {roles.slice(0, 3).map((role) => (
        <span
          key={role}
          className="rounded-sm border-2 border-border-default bg-surface-card px-2 py-0.5 font-mono text-badge text-text-muted"
          title={role}
        >
          {role.split("/").slice(-1)[0]}
        </span>
      ))}
      {roles.length > 3 && (
        <span className="font-mono text-badge text-text-muted">+{roles.length - 3}</span>
      )}
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

  const primitives = useMemo(
    () => ofType.filter((t) => !isSystemCreated(t)),
    [ofType],
  );

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

  const rolesByToken = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [role, id] of Object.entries(assignments)) {
      map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }, [assignments]);

  if (primitives.length === 0 && systemCreated.length === 0) {
    return (
      <p className="text-caption text-text-muted">
        No primitives yet — values appear here after import, or add a token.
      </p>
    );
  }

  const grid =
    tokenType === "color"
      ? "grid grid-cols-1 gap-2 md:grid-cols-2"
      : "flex flex-col gap-2";

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
            const manual = isManual(token);

            return (
              <li
                key={token.id}
                className="flex flex-wrap items-center gap-3 rounded-md border-2 border-border-default bg-surface-page p-3"
              >
                <Preview token={token} />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <InlineName
                    name={displayName ?? null}
                    onSetName={(name) => onSetName(token.id, name)}
                    tokenType={token.type}
                    suggestedName={fallbackName(token)}
                  />
                  <span className="truncate font-mono text-badge text-text-muted">
                    {formatValue(token)}
                    {manual ? " · manual" : ""}
                  </span>
                  {mergeCount > 1 && (
                    <span className="inline-flex items-center gap-1 font-mono text-badge text-text-muted">
                      {mergeCount}-way merge
                      <InfoHint
                        content={
                          absorbed.length > 0
                            ? `Merged from: ${absorbed.join(" · ")}. Un-merge splits them apart again.`
                            : "Near-identical captures were merged into this one."
                        }
                      />
                    </span>
                  )}
                </div>

                <RoleChips roles={usedAs} />

                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  {merge && tokenType === "color" && onSetMergeSurvivor && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => setPickerSurvivorId(token.id)}
                      title="Pick which merged hex the system keeps"
                    >
                      Change merged…
                    </Button>
                  )}
                  {merge && (
                    <Button size="sm" variant="secondary" onClick={() => onUnmerge(token.id)}>
                      Un-merge
                    </Button>
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
                      title="Exclude from system (undoable)"
                    >
                      Exclude
                    </Button>
                  )}
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
                    className="flex flex-wrap items-center gap-3 rounded-md border-2 border-border-default bg-surface-page p-3"
                  >
                    <Preview token={token} />
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <InlineName
                        name={displayName ?? null}
                        onSetName={(name) => onSetName(token.id, name)}
                        tokenType={token.type}
                        suggestedName={fallbackName(token)}
                      />
                      <span className="truncate font-mono text-badge text-text-muted">
                        {formatValue(token)}
                        {" · "}
                        <span title="System-created for a missing semantic role">system</span>
                      </span>
                    </div>
                    <RoleChips roles={usedAs} />
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
