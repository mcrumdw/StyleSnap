import { useRef } from "react";
import { Button } from "./Button";
import { PIPELINE_STEPS, primaryCtaLabel, type PipelineStep } from "../state/pipeline";

export interface StepProgress {
  openClusters: number;
  rolesMet: number;
  rolesTotal: number;
  gaps: number;
  derivedCount: number;
  created: boolean;
}

interface StepBarProps {
  step: PipelineStep;
  onStepChange: (step: PipelineStep) => void;
  projectName: string;
  onProjectNameChange: (name: string) => void;
  progress: StepProgress;
  onPrimaryAction: () => void;
}

function stepHint(step: PipelineStep, progress: StepProgress): string {
  switch (step) {
    case 1:
      return progress.openClusters > 0
        ? `${progress.openClusters} merge${progress.openClusters === 1 ? "" : "s"} proposed`
        : "Merges reviewed ✓";
    case 2:
      return `${progress.rolesMet}/${progress.rolesTotal} required roles`;
    case 3:
      return progress.derivedCount > 0
        ? `${progress.derivedCount} value${progress.derivedCount === 1 ? "" : "s"} made for you`
        : "All values captured";
    case 4:
      return progress.created ? "Created ✓" : "Not finalized yet";
  }
}

/**
 * Phase 10 — numbered pipeline stepper with per-step progress and one
 * context-aware primary CTA (replaces SessionBar).
 */
export function StepBar({
  step,
  onStepChange,
  projectName,
  onProjectNameChange,
  progress,
  onPrimaryAction,
}: StepBarProps) {
  // Roving tabindex (UX_RESEARCH P11): one tab stop for the whole stepper;
  // arrows move focus and selection together.
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const onTablistKeyDown = (e: React.KeyboardEvent) => {
    const idx = PIPELINE_STEPS.findIndex((s) => s.step === step);
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (idx + 1) % PIPELINE_STEPS.length;
    if (e.key === "ArrowLeft" || e.key === "ArrowUp")
      next = (idx + PIPELINE_STEPS.length - 1) % PIPELINE_STEPS.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = PIPELINE_STEPS.length - 1;
    if (next === -1) return;
    e.preventDefault();
    onStepChange(PIPELINE_STEPS[next].step);
    tabRefs.current[next]?.focus();
  };

  return (
    <div className="sticky top-btn-lg z-sticky -mx-6 border-b-2 border-border-default bg-surface-page px-6 py-3 shadow-card">
      <div className="mx-auto flex max-w-container flex-col gap-3">
        <nav
          role="tablist"
          aria-label="Review steps"
          className="flex flex-wrap gap-2"
          onKeyDown={onTablistKeyDown}
        >
          {PIPELINE_STEPS.map(({ step: id, label }, i) => {
            const active = step === id;
            const hint = stepHint(id, progress);
            return (
              <button
                key={id}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                role="tab"
                aria-selected={active}
                aria-current={active ? "step" : undefined}
                tabIndex={active ? 0 : -1}
                onClick={() => onStepChange(id)}
                className={`flex min-w-0 flex-col rounded-sm border-2 px-3 py-1.5 text-left ${
                  active
                    ? "border-border-default bg-surface-card text-text-primary shadow-card"
                    : "border-transparent text-text-muted hover:border-border-default hover:text-text-primary"
                }`}
              >
                <span className="font-heading text-caption font-bold">
                  {id}. {label}
                </span>
                <span className="truncate font-mono text-badge">{hint}</span>
              </button>
            );
          })}
        </nav>

        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="sr-only">Project name</span>
            <input
              value={projectName}
              onChange={(e) => onProjectNameChange(e.target.value)}
              aria-label="Project name"
              className="h-btn-sm w-36 rounded-sm border-2 border-border-default bg-surface-card px-2 text-caption text-text-primary sm:w-48"
            />
          </label>
          <Button size="sm" className="ml-auto" onClick={onPrimaryAction}>
            {primaryCtaLabel(step, progress.created)}
          </Button>
        </div>
      </div>
    </div>
  );
}
