import { useMemo } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import { isNeutral } from "../engine/derive-system/oklch";
import { findMergeForMember, isManualToken } from "../state/pool";

interface CapturedColorsProps {
  /** Raw pool colors — every snap capture, not the merge-collapsed view. */
  tokens: StyleSnapToken[];
  merges: MergeRecord[];
  assignments: Record<string, string>;
  primaryId?: string;
  secondaryId?: string;
  accentIds: string[];
}

type ColorTok = StyleSnapToken & { type: "color" };

function isColorToken(t: StyleSnapToken): t is ColorTok {
  // Snap captures only — never derived, never user-added primitives (§manual).
  return t.type === "color" && !t.id.startsWith("derived_") && !isManualToken(t);
}

/**
 * From snap inventory — read-only. Role / primary / merge survivor choices
 * live in Primitives and System roles (§2.40).
 */
export function CapturedColors({
  tokens,
  merges,
  assignments,
  primaryId,
  secondaryId,
  accentIds,
}: CapturedColorsProps) {
  const captured = useMemo(() => tokens.filter(isColorToken), [tokens]);

  const byId = useMemo(() => new Map(captured.map((t) => [t.id, t])), [captured]);

  const rolesByToken = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [role, id] of Object.entries(assignments)) {
      if (!role.startsWith("color/")) continue;
      map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }, [assignments]);

  const accentSet = useMemo(() => new Set(accentIds), [accentIds]);

  if (captured.length === 0) {
    return (
      <p className="text-caption text-text-muted">
        No colors in this snap — add a color token below or keep derived roles.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {captured.map((token) => {
        const merge = findMergeForMember(merges, token.id);
        const survivorId = merge ? merge.survivorId : token.id;
        const survivor = byId.get(survivorId);
        const isSurvivor = !merge || token.id === survivorId;
        const usedAs = isSurvivor ? (rolesByToken.get(token.id) ?? []) : [];
        const el = token.context?.element;
        const authored = token.context?.authoredName;
        const isPrimary = token.id === primaryId;
        const isSecondary = token.id === secondaryId;
        const inAccents = accentSet.has(survivorId) && isSurvivor;
        const translucent = token.opacity < 1;
        const mergeSize = merge ? merge.mergedIds.length + 1 : 0;

        return (
          <li
            key={token.id}
            className="flex flex-wrap items-center gap-3 rounded-md border-2 border-border-default bg-surface-page p-3"
          >
            <span
              className="size-10 shrink-0 rounded-sm border-2 border-border-default"
              style={{ backgroundColor: token.value, opacity: token.opacity }}
              aria-hidden
            />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-mono text-caption text-text-primary">
                {token.value}
                {translucent ? ` @ ${Math.round(token.opacity * 100)}%` : ""}
                {isNeutral(token.value) ? " · neutral" : ""}
                {isPrimary ? " · primary" : ""}
                {isSecondary ? " · secondary" : ""}
                {inAccents ? " · accent" : ""}
              </span>
              <span className="truncate font-mono text-badge text-text-muted">
                {authored
                  ? `authored "${authored}"`
                  : el
                    ? `seen on <${el}>`
                    : "captured"}{" "}
                · ×{token.occurrences}
                {merge && isSurvivor
                  ? ` · ${mergeSize}-way merge (system uses this)`
                  : ""}
                {merge && !isSurvivor && survivor
                  ? ` · merged → ${survivor.value} (system)`
                  : ""}
              </span>
            </div>

            {usedAs.length > 0 && (
              <span className="flex shrink-0 flex-wrap gap-1">
                {usedAs.map((role) => (
                  <span
                    key={role}
                    className="rounded-sm border-2 border-brand-primary bg-surface-card px-2 py-0.5 font-mono text-badge text-brand-primary"
                  >
                    {role}
                  </span>
                ))}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
