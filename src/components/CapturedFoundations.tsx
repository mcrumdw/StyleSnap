import { useMemo } from "react";
import type { StyleSnapToken, TokenType } from "../contract/types";
import { isManualToken } from "../state/pool";
import { formatValue } from "../state/workspace";
import { InfoHint } from "./Tooltip";

type FoundationType = "spacing" | "border-radius" | "border-width" | "shadow";

const EMPTY_TIP: Record<FoundationType, string> = {
  spacing: "No spacing in this snap. Add a token, or keep the auto ones.",
  "border-radius": "No corner radii in this snap. Add one, or keep the auto ones.",
  "border-width": "No border widths in this snap. Add one, or keep the default.",
  shadow: "No shadows in this snap. Add one, or keep the auto ones.",
};

interface CapturedFoundationsProps {
  tokenType: FoundationType;
  tokens: StyleSnapToken[];
  assignments: Record<string, string>;
  emptyLabel: string;
}

function FoundationPreview({ token }: { token: StyleSnapToken }) {
  const frame = "size-10 shrink-0 overflow-hidden rounded-sm border-2 border-border-default bg-surface-page";
  if (token.type === "spacing") {
    return (
      <span className={`${frame} flex items-center justify-center`} aria-hidden>
        <span className="h-1 rounded-sm bg-brand-primary" style={{ width: Math.min(token.value, 28) }} />
      </span>
    );
  }
  if (token.type === "border-radius") {
    return (
      <span className={`${frame} flex items-center justify-center`} aria-hidden>
        <span
          className="h-6 w-6 border-2 border-border-default bg-surface-card"
          style={{ borderRadius: `${Math.min(token.value, 12)}px 0 0 0` }}
        />
      </span>
    );
  }
  if (token.type === "border-width") {
    return (
      <span className={`${frame} flex items-center justify-center`} aria-hidden>
        <span
          className="w-6 border-border-default"
          style={{ borderTopWidth: Math.min(token.value, 6), borderTopStyle: "solid" }}
        />
      </span>
    );
  }
  return (
    <span className={`${frame} flex items-center justify-center p-1`} aria-hidden>
      <span className="h-5 w-5 rounded-sm bg-surface-card shadow-sm" />
    </span>
  );
}

/**
 * From snap inventory — read-only. Slot assignment lives in System roles (§2.40).
 */
export function CapturedFoundations({
  tokenType,
  tokens,
  assignments,
  emptyLabel,
}: CapturedFoundationsProps) {
  const captured = useMemo(
    () =>
      tokens.filter(
        (t) =>
          t.type === (tokenType as TokenType) &&
          !t.id.startsWith("derived_") &&
          !isManualToken(t),
      ),
    [tokens, tokenType],
  );

  const rolesByToken = useMemo(() => {
    const prefixes =
      tokenType === "spacing"
        ? ["space/"]
        : tokenType === "border-radius"
          ? ["radius/"]
          : tokenType === "border-width"
            ? ["border-width/"]
            : ["shadow/", "effect/", "blur/"];
    const map = new Map<string, string[]>();
    for (const [role, id] of Object.entries(assignments)) {
      if (!prefixes.some((p) => role.startsWith(p))) continue;
      map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }, [assignments, tokenType]);

  if (captured.length === 0) {
    return (
      <p className="flex items-center gap-2 text-caption text-text-muted">
        {emptyLabel}
        <InfoHint content={EMPTY_TIP[tokenType]} />
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {captured.map((token) => {
        const usedAs = rolesByToken.get(token.id) ?? [];
        const el = token.context?.element;
        const authored = token.context?.authoredName;
        const mergeCount = token.mergedFrom?.length ?? 0;
        return (
          <li
            key={token.id}
            className="flex flex-wrap items-center gap-3 rounded-md border-2 border-border-default bg-surface-page p-3"
          >
            <FoundationPreview token={token} />
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate font-mono text-caption text-text-primary">
                {formatValue(token)}
                {mergeCount > 0 ? ` · ${mergeCount + 1}-way merge` : ""}
              </span>
              <span className="truncate font-mono text-badge text-text-muted">
                {authored
                  ? `authored "${authored}"`
                  : el
                    ? `seen on <${el}>`
                    : "captured"}
                {token.context?.cssProperty ? ` · ${token.context.cssProperty}` : ""}{" "}
                · ×{token.occurrences}
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
