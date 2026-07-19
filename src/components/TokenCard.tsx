import type { PoolEntry } from "../state/workspace";
import { fallbackName } from "../engine/roles";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { InlineName } from "./InlineName";
import { RolePicker } from "./RolePicker";
import { TokenPreview } from "./TokenPreview";

interface TokenCardProps {
  entry: PoolEntry;
  /** Dedup flag from the Phase 3 engine (FR-6). */
  flag?: "dup" | "sim";
  /** Visual layer: primitive cards are de-emphasized in Captured view. */
  variant?: "default" | "primitive";
  /** Count of roles pointing at this token (Phase 8). */
  roleCount?: number;
  /** ALL confirmed roles pointing at this token (Phase 8 — multi-role). */
  assignedRoles?: string[];
  /** Live engine suggestions for this token. */
  suggestedRoles?: string[];
  /** Name of the primitive currently holding a role (reassign confirm). */
  holderLabel?: (role: string) => string | undefined;
  onAssignRole?: (role: string) => void;
  onUnassignRole?: (role: string) => void;
  onSetName?: (name: string | undefined) => void;
  /** Opens the merge dialog for this token's cluster. */
  onReviewCluster?: () => void;
  /** Un-merge (FR-13) — only offered on merge survivors. */
  onUnmerge?: () => void;
  /** Manual tokens (FR-19) can be edited and removed. */
  onEditManual?: () => void;
  onRemoveManual?: () => void;
}

const ORIGIN_LABELS = { figma: "Figma", "browser-extension": "Web", manual: "Manual" } as const;

/**
 * DESIGN.md §5.1 token card: value preview · mono name (or "unnamed" muted
 * italic) · role chip · source + occurrences caption · badges top-right.
 */
export function TokenCard({
  entry,
  flag,
  variant = "default",
  roleCount = 0,
  assignedRoles = [],
  suggestedRoles = [],
  holderLabel = () => undefined,
  onAssignRole,
  onUnassignRole,
  onSetName,
  onReviewCluster,
  onUnmerge,
  onEditManual,
  onRemoveManual,
}: TokenCardProps) {
  const { token } = entry;
  const sourceLabel = ORIGIN_LABELS[entry.origin];

  return (
    <div
      className={`flex flex-col gap-3 rounded-md border-2 p-4 ${
        variant === "primitive"
          ? "border-border-default bg-surface-page"
          : "border-border-default bg-surface-card shadow-card"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        {onSetName ? (
          <InlineName
            name={token.name}
            onSetName={onSetName}
            tokenType={token.type}
            suggestedName={fallbackName(token)}
          />
        ) : token.name ? (
          <span className="font-mono text-caption font-medium text-text-primary">{token.name}</span>
        ) : (
          <span className="text-caption italic text-text-muted">unnamed</span>
        )}
        <div className="flex flex-col items-end gap-1">
          <div className="flex gap-1">
            {flag && <Badge variant={flag} />}
            {token.merged && <Badge variant="merged" />}
          </div>
          {variant === "primitive" && (
            <span
              className={`font-mono text-badge ${
                roleCount > 0 ? "text-brand-primary" : "text-warning-text"
              }`}
            >
              {roleCount > 0 ? `${roleCount} role${roleCount === 1 ? "" : "s"}` : "unused"}
            </span>
          )}
        </div>
      </div>

      <TokenPreview token={token} />

      {onAssignRole && onUnassignRole && (
        <RolePicker
          tokenType={token.type}
          assigned={assignedRoles}
          suggested={suggestedRoles}
          holderLabel={holderLabel}
          onAssign={onAssignRole}
          onUnassign={onUnassignRole}
        />
      )}

      <p className="text-caption text-text-muted">
        {sourceLabel} · {token.source} · ×{token.occurrences}
        {token.context?.authoredName && (
          <>
            {" · "}
            <span className="font-mono">{token.context.authoredName}</span>
          </>
        )}
      </p>

      {(flag || (token.merged && onUnmerge) || onEditManual || onRemoveManual) && (
        <div className="flex gap-2">
          {flag && onReviewCluster && (
            <Button size="sm" variant="secondary" onClick={onReviewCluster}>
              Review cluster
            </Button>
          )}
          {token.merged && onUnmerge && (
            <Button size="sm" variant="ghost" onClick={onUnmerge}>
              Un-merge
            </Button>
          )}
          {onEditManual && (
            <Button size="sm" variant="ghost" onClick={onEditManual}>
              Edit
            </Button>
          )}
          {onRemoveManual && (
            <Button size="sm" variant="ghost" onClick={onRemoveManual}>
              Remove
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
