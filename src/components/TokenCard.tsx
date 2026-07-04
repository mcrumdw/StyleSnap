import type { RoleSuggestion } from "../engine/roles";
import type { PoolEntry } from "../state/workspace";
import { Badge } from "./Badge";
import { Button } from "./Button";
import { InlineName } from "./InlineName";
import { RolePicker } from "./RolePicker";
import { TokenPreview } from "./TokenPreview";

interface TokenCardProps {
  entry: PoolEntry;
  /** Dedup flag from the Phase 3 engine (FR-6). */
  flag?: "dup" | "sim";
  /** Live role suggestion from the Phase 4 engine. */
  roleSuggestion?: RoleSuggestion;
  /** User's confirmed role (string), explicit "no role" (null), or none yet. */
  roleDecision?: string | null;
  onDecideRole?: (role: string | null | undefined) => void;
  onSetName?: (name: string | undefined) => void;
  /** Opens the merge dialog for this token's cluster. */
  onReviewCluster?: () => void;
  /** Un-merge (FR-13) — only offered on merge survivors. */
  onUnmerge?: () => void;
}

/**
 * DESIGN.md §5.1 token card: value preview · mono name (or "unnamed" muted
 * italic) · role chip · source + occurrences caption · badges top-right.
 */
export function TokenCard({
  entry,
  flag,
  roleSuggestion,
  roleDecision,
  onDecideRole,
  onSetName,
  onReviewCluster,
  onUnmerge,
}: TokenCardProps) {
  const { token, meta } = entry;
  const sourceLabel = meta.source === "figma" ? "Figma" : "Web";

  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        {onSetName ? (
          <InlineName name={token.name} onSetName={onSetName} />
        ) : token.name ? (
          <span className="font-mono text-caption font-medium text-text-primary">{token.name}</span>
        ) : (
          <span className="text-caption italic text-text-muted">unnamed</span>
        )}
        <div className="flex gap-1">
          {flag && <Badge variant={flag} />}
          {token.merged && <Badge variant="merged" />}
        </div>
      </div>

      <TokenPreview token={token} />

      {onDecideRole && (
        <RolePicker
          tokenType={token.type}
          suggestion={roleSuggestion}
          decision={roleDecision}
          onDecide={onDecideRole}
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

      {(flag || (token.merged && onUnmerge)) && (
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
        </div>
      )}
    </div>
  );
}
