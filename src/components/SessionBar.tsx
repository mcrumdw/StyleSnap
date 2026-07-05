import type { Checklist } from "../engine/completeness";
import { Button } from "./Button";

export type SessionView = "edit" | "system";

interface SessionBarProps {
  view: SessionView;
  onViewChange: (view: SessionView) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  checklist: Checklist;
  gapCount: number;
  created: boolean;
  onOpenGaps: () => void;
  onCreateSystem: () => void;
  onCopyDesignMd: () => void;
  onOpenExport: () => void;
}

/**
 * Persistent session chrome — Edit/System toggle, completeness pill, and
 * Create System / Copy export CTAs stay visible at every scroll position.
 */
export function SessionBar({
  view,
  onViewChange,
  projectName,
  onProjectNameChange,
  checklist,
  gapCount,
  created,
  onOpenGaps,
  onCreateSystem,
  onCopyDesignMd,
  onOpenExport,
}: SessionBarProps) {
  const requiredOpen = checklist.requiredTotal - checklist.requiredMet;

  return (
    <div className="sticky top-btn-lg z-sticky -mx-6 border-b-2 border-border-default bg-surface-page px-6 py-3 shadow-card">
      <div className="mx-auto flex max-w-container flex-wrap items-center gap-3">
        {/* Edit ↔ System */}
        <nav role="tablist" aria-label="Session views" className="flex gap-1">
          {(
            [
              ["edit", "Edit"],
              ["system", "System"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={view === id}
              onClick={() => onViewChange(id)}
              className={`rounded-sm border-2 px-3 py-1.5 font-heading text-caption font-bold ${
                view === id
                  ? "border-border-default bg-surface-card text-text-primary shadow-card"
                  : "border-transparent text-text-muted hover:text-text-primary"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        <span className="hidden h-6 w-0.5 bg-border-default sm:block" aria-hidden />

        {/* Completeness pill → gap drawer */}
        <button
          type="button"
          onClick={onOpenGaps}
          className={`flex items-center gap-2 rounded-sm border-2 px-3 py-1.5 font-mono text-caption ${
            requiredOpen > 0
              ? "border-warning bg-surface-card text-warning-text"
              : "border-success bg-surface-card text-success-text"
          }`}
          title="Open gaps"
        >
          <span>
            {checklist.requiredMet}/{checklist.requiredTotal} required
          </span>
          {gapCount > 0 && (
            <span className="text-text-muted">· {gapCount} gap{gapCount === 1 ? "" : "s"}</span>
          )}
        </button>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="sr-only">Project name</span>
            <input
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              aria-label="Project name"
              className="h-btn-sm w-36 rounded-sm border-2 border-border-default bg-surface-card px-2 text-caption text-text-primary sm:w-48"
            />
          </label>

          {created ? (
            <>
              <Button size="sm" onClick={onCopyDesignMd}>
                Copy design.md
              </Button>
              <Button size="sm" variant="secondary" onClick={onOpenExport}>
                Export…
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={onCreateSystem}>
              Create System
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
