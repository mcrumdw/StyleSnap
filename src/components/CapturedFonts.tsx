import { useMemo } from "react";
import type { StyleSnapToken, TypographyToken } from "../contract/types";
import { TYPE_ROLES } from "../engine/roles";

interface CapturedFontsProps {
  /** The effective token set (captured + derived); we show captured only. */
  tokens: StyleSnapToken[];
  /** Resolved role → token id, to show what each captured font is used as. */
  assignments: Record<string, string>;
  /** Assign a captured font to a type role (overrides derivation for that slot). */
  onAssign: (role: string, tokenId: string) => void;
}

const TYPE_ROLE_LIST = TYPE_ROLES.map((r) => r.role);

/**
 * Every typography token the snap captured — shown verbatim so nothing the
 * user picked is hidden behind derivation. Fonts already filling a role show
 * their role(s); the rest offer a "Use as…" picker so the user can put ANY
 * captured font into ANY type slot (captured always beats derived, C.8).
 */
export function CapturedFonts({ tokens, assignments, onAssign }: CapturedFontsProps) {
  const captured = useMemo(
    () =>
      tokens.filter(
        (t): t is TypographyToken => t.type === "typography" && !t.id.startsWith("derived_"),
      ),
    [tokens],
  );

  const rolesByToken = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const [role, id] of Object.entries(assignments)) {
      if (!role.startsWith("type/")) continue;
      map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }, [assignments]);

  if (captured.length === 0) return null;

  return (
    <section className="flex w-full flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
      <div className="flex flex-col gap-1">
        <h3 className="font-heading text-card-title font-medium">
          Fonts captured in your snap ({captured.length})
        </h3>
        <p className="text-caption text-text-muted">
          Every typeface the snap picked up. Assign any of them to a role — a captured font
          always beats an auto-derived one.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {captured.map((token) => {
          const usedAs = rolesByToken.get(token.id) ?? [];
          const el = token.context?.element;
          const authored = token.context?.authoredName;
          return (
            <li
              key={token.id}
              className="flex flex-wrap items-center gap-3 rounded-md border-2 border-border-default bg-surface-page p-3"
            >
              <span
                className="shrink-0 truncate text-text-primary"
                style={{
                  fontFamily: token.value.fontStack?.join(", ") ?? token.value.fontFamily,
                  fontWeight: token.value.fontWeight,
                  fontSize: `${Math.min(token.value.fontSize, 28)}px`,
                  lineHeight: 1.1,
                }}
                aria-hidden
              >
                Ag
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate font-mono text-caption text-text-primary">
                  {token.value.fontFamily} · {token.value.fontSize}px / {token.value.fontWeight}
                </span>
                <span className="truncate font-mono text-badge text-text-muted">
                  {authored
                    ? `authored "${authored}"`
                    : el
                      ? `seen on <${el}>`
                      : "captured"}{" "}
                  · ×{token.occurrences}
                </span>
              </div>

              {usedAs.length > 0 ? (
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
              ) : (
                <label className="flex shrink-0 items-center gap-2">
                  <span className="font-mono text-badge text-text-muted">Use as</span>
                  <select
                    aria-label={`Assign ${token.value.fontFamily} ${token.value.fontSize}px to a role`}
                    defaultValue=""
                    onChange={(e) => {
                      if (e.target.value) onAssign(e.target.value, token.id);
                    }}
                    className="h-btn-sm rounded-sm border-2 border-border-default bg-surface-card px-2 font-mono text-caption text-text-primary"
                  >
                    <option value="" disabled>
                      role…
                    </option>
                    {TYPE_ROLE_LIST.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
