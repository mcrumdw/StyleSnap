import { useMemo } from "react";
import type { StyleSnapToken, TypographyToken } from "../contract/types";
import { TYPE_ROLES } from "../engine/roles";
import { Button } from "./Button";

interface CapturedFontsProps {
  /** The effective token set (captured + derived); we show captured only. */
  tokens: StyleSnapToken[];
  /** Resolved role → token id, to show what each captured font is used as. */
  assignments: Record<string, string>;
  /** Assign a captured font to a type role (overrides derivation for that slot). */
  onAssign: (role: string, tokenId: string) => void;
  onExclude?: (tokenId: string) => void;
}

const TYPE_ROLE_LIST = TYPE_ROLES.map((r) => r.role);

/**
 * Every typography token the snap captured — shown verbatim so nothing the
 * user picked is hidden behind derivation.
 */
export function CapturedFonts({ tokens, assignments, onAssign, onExclude }: CapturedFontsProps) {
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

  if (captured.length === 0) {
    return (
      <p className="text-caption text-text-muted">
        No fonts in this snap — add a type token below or keep derived type roles.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {captured.map((token) => {
        const usedAs = rolesByToken.get(token.id) ?? [];
        const el = token.context?.element;
        const authored = token.context?.authoredName;
        const extras = [
          token.value.letterSpacing !== undefined
            ? `tracking ${token.value.letterSpacing}px`
            : null,
          token.value.textTransform && token.value.textTransform !== "none"
            ? token.value.textTransform
            : null,
        ].filter(Boolean);
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
                letterSpacing: token.value.letterSpacing,
                textTransform: token.value.textTransform,
              }}
              aria-hidden
            >
              Ag
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-mono text-caption text-text-primary">
                {token.value.fontFamily} · {token.value.fontSize}px / {token.value.fontWeight}
                {extras.length > 0 ? ` · ${extras.join(" · ")}` : ""}
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
                    e.target.value = "";
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
          </li>
        );
      })}
    </ul>
  );
}
