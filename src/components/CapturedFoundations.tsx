import { useMemo } from "react";
import type { StyleSnapToken, TokenType } from "../contract/types";
import {
  BORDER_WIDTH_SLOTS,
  RADIUS_SLOTS,
  SHADOW_SLOTS,
  SPACE_SLOTS,
} from "../engine/roles";
import { formatValue } from "../state/workspace";
import { Button } from "./Button";
import { InfoHint } from "./Tooltip";

type FoundationType = "spacing" | "border-radius" | "border-width" | "shadow";

const SLOTS: Record<FoundationType, string[]> = {
  spacing: SPACE_SLOTS.map((s) => s.role),
  "border-radius": RADIUS_SLOTS.map((s) => s.role),
  "border-width": BORDER_WIDTH_SLOTS.map((s) => s.role),
  shadow: SHADOW_SLOTS.map((s) => s.role),
};

const EMPTY_TIP: Record<FoundationType, string> = {
  spacing: "This snap didn’t capture spacing — add a token below or keep auto-derived slots.",
  "border-radius": "No corner radii in this snap — add one or keep derived radius slots.",
  "border-width": "No border widths captured — add a stroke or keep the default slot.",
  shadow: "No shadows/effects captured — add one or keep derived elevation slots.",
};

interface CapturedFoundationsProps {
  tokenType: FoundationType;
  tokens: StyleSnapToken[];
  assignments: Record<string, string>;
  onAssign: (role: string, tokenId: string) => void;
  onExclude: (tokenId: string) => void;
  emptyLabel: string;
  /** Extra slots beyond Appendix B (§2.30). */
  customRoles?: string[];
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
 * From-snap strip for spacing / radius / borders / effects — mirror of
 * CapturedColors / CapturedFonts.
 */
export function CapturedFoundations({
  tokenType,
  tokens,
  assignments,
  onAssign,
  onExclude,
  emptyLabel,
  customRoles = [],
}: CapturedFoundationsProps) {
  const captured = useMemo(
    () =>
      tokens.filter(
        (t) => t.type === (tokenType as TokenType) && !t.id.startsWith("derived_"),
      ),
    [tokens, tokenType],
  );

  const rolesByToken = useMemo(() => {
    const prefix =
      tokenType === "spacing"
        ? "space/"
        : tokenType === "border-radius"
          ? "radius/"
          : tokenType === "border-width"
            ? "border-width/"
            : "shadow/";
    const map = new Map<string, string[]>();
    for (const [role, id] of Object.entries(assignments)) {
      if (!role.startsWith(prefix)) continue;
      map.set(id, [...(map.get(id) ?? []), role]);
    }
    return map;
  }, [assignments, tokenType]);

  const slots = useMemo(() => {
    const prefix =
      tokenType === "spacing"
        ? "space/"
        : tokenType === "border-radius"
          ? "radius/"
          : tokenType === "border-width"
            ? "border-width/"
            : "shadow/";
    const extra = customRoles.filter((r) => r.startsWith(prefix));
    return [...SLOTS[tokenType], ...extra.filter((r) => !SLOTS[tokenType].includes(r))];
  }, [customRoles, tokenType]);

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

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              <label className="flex items-center gap-1">
                <span className="font-mono text-badge text-text-muted">Slot</span>
                <select
                  aria-label={`Assign ${formatValue(token)} to a scale slot`}
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
                  {slots.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </label>
              <Button size="sm" variant="ghost" onClick={() => onExclude(token.id)} title="Exclude from system (undoable)">
                Exclude
              </Button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
