import { useMemo, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import { COLOR_ROLES } from "../engine/roles";
import { isNeutral } from "../engine/derive-system/oklch";
import {
  findMergeForMember,
  resolveSurvivorId,
} from "../state/pool";
import { Button } from "./Button";
import { MergeSurvivorDialog } from "./MergeSurvivorDialog";

interface CapturedColorsProps {
  /** Raw pool colors — every snap capture, not the merge-collapsed view. */
  tokens: StyleSnapToken[];
  merges: MergeRecord[];
  assignments: Record<string, string>;
  primaryId?: string;
  secondaryId?: string;
  accentIds: string[];
  onMakePrimary: (tokenId: string) => void;
  onMakeSecondary: (tokenId: string) => void;
  onAssign: (role: string, tokenId: string) => void;
  onAddAccent: (tokenId: string) => void;
  onSetMergeSurvivor: (tokenId: string) => void;
  onExclude?: (tokenId: string) => void;
}

const COLOR_ROLE_LIST = COLOR_ROLES.map((r) => r.role);

type ColorTok = StyleSnapToken & { type: "color" };

function isColorToken(t: StyleSnapToken): t is ColorTok {
  return t.type === "color" && !t.id.startsWith("derived_");
}

/**
 * Every color the snap captured (raw). Merges do not hide members here —
 * primitives use the survivor. Click a merge to re-pick which hex wins.
 */
export function CapturedColors({
  tokens,
  merges,
  assignments,
  primaryId,
  secondaryId,
  accentIds,
  onMakePrimary,
  onMakeSecondary,
  onAssign,
  onAddAccent,
  onSetMergeSurvivor,
  onExclude,
}: CapturedColorsProps) {
  const [pickerFor, setPickerFor] = useState<string | null>(null);

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

  const pickerMembers = useMemo(() => {
    if (!pickerFor) return [];
    const merge = findMergeForMember(merges, pickerFor);
    if (!merge) return [];
    return [merge.survivorId, ...merge.mergedIds]
      .map((id) => byId.get(id))
      .filter((t): t is ColorTok => !!t);
  }, [pickerFor, merges, byId]);

  const pickerSurvivorId = pickerFor
    ? resolveSurvivorId(pickerFor, merges)
    : "";

  if (captured.length === 0) {
    return (
      <p className="text-caption text-text-muted">
        No colors in this snap — add a color token below or keep derived roles.
      </p>
    );
  }

  return (
    <>
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

              <div className="flex shrink-0 flex-wrap items-center gap-2">
                {merge && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setPickerFor(token.id)}
                    title="See merged colors and pick which hex the system keeps"
                  >
                    {isSurvivor ? "Change merged…" : "Choose as merged…"}
                  </Button>
                )}
                {!isPrimary && (
                  <Button size="sm" variant="secondary" onClick={() => onMakePrimary(token.id)}>
                    Make primary
                  </Button>
                )}
                {!isSecondary && (
                  <Button size="sm" variant="ghost" onClick={() => onMakeSecondary(token.id)}>
                    Make secondary
                  </Button>
                )}
                {isSurvivor && (
                  <label className="flex items-center gap-1">
                    <span className="font-mono text-badge text-text-muted">Role</span>
                    <select
                      aria-label={`Assign ${token.value} to a role`}
                      defaultValue=""
                      onChange={(e) => {
                        if (e.target.value) onAssign(e.target.value, token.id);
                        e.target.value = "";
                      }}
                      className="h-btn-sm rounded-sm border-2 border-border-default bg-surface-card px-2 font-mono text-caption text-text-primary"
                    >
                      <option value="" disabled>
                        …
                      </option>
                      {COLOR_ROLE_LIST.map((role) => (
                        <option key={role} value={role}>
                          {role}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
                {isSurvivor && !inAccents && !isNeutral(token.value) && (
                  <Button size="sm" variant="ghost" onClick={() => onAddAccent(token.id)}>
                    Add to accents
                  </Button>
                )}
                {onExclude && (
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

      {pickerFor && pickerMembers.length > 1 && (
        <MergeSurvivorDialog
          members={pickerMembers}
          currentSurvivorId={pickerSurvivorId}
          onPick={onSetMergeSurvivor}
          onClose={() => setPickerFor(null)}
        />
      )}
    </>
  );
}
