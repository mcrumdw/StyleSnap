import type { PipelineStep } from "../state/pipeline";

interface SummaryStripProps {
  proposedMerges: number;
  anchorsPicked: number;
  derivedCount: number;
  onGoToStep: (step: PipelineStep) => void;
}

/**
 * Phase 10b — the app's honest confession and the only to-do list: what was
 * automated, each count linking to its repair shop. ≤ 3 interactive
 * decisions above the fold (10c).
 */
export function SummaryStrip({
  proposedMerges,
  anchorsPicked,
  derivedCount,
  onGoToStep,
}: SummaryStripProps) {
  const item = (label: string, step: PipelineStep, emphasis = true) => (
    <button
      type="button"
      onClick={() => onGoToStep(step)}
      className={`rounded-sm border-2 px-2 py-1 font-mono text-caption hover:border-brand-primary ${
        emphasis
          ? "border-border-default bg-surface-card text-text-primary"
          : "border-transparent text-text-muted"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border-2 border-border-default bg-surface-page p-3">
      <span className="text-caption text-text-muted">Built from your capture:</span>
      {item(
        proposedMerges > 0
          ? `${proposedMerges} proposed merge${proposedMerges === 1 ? "" : "s"}`
          : "merges reviewed ✓",
        1,
        proposedMerges > 0,
      )}
      <span className="text-caption text-text-muted">·</span>
      {item(`${anchorsPicked} anchor${anchorsPicked === 1 ? "" : "s"} picked`, 2)}
      <span className="text-caption text-text-muted">·</span>
      {item(`${derivedCount} value${derivedCount === 1 ? "" : "s"} derived`, 3)}
    </div>
  );
}
