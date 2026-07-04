import { Badge } from "./Badge";
import { TokenPreview } from "./TokenPreview";
import type { PoolEntry } from "../state/workspace";

interface TokenCardProps {
  entry: PoolEntry;
  /** Dedup flags arrive with the Phase 3 engine; unflagged until then. */
  flag?: "dup" | "sim";
}

/**
 * DESIGN.md §5.1 token card: value preview · mono name (or "unnamed" muted
 * italic) · source + occurrences caption · badges top-right.
 */
export function TokenCard({ entry, flag }: TokenCardProps) {
  const { token, meta } = entry;
  const sourceLabel = meta.source === "figma" ? "Figma" : "Web";

  return (
    <div className="flex flex-col gap-3 rounded-md border-2 border-border-default bg-surface-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-2">
        {token.name ? (
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

      <p className="text-caption text-text-muted">
        {sourceLabel} · {token.source} · ×{token.occurrences}
        {token.context?.authoredName && (
          <>
            {" · "}
            <span className="font-mono">{token.context.authoredName}</span>
          </>
        )}
      </p>
    </div>
  );
}
