/** Phase 10 — the four-step review pipeline (never locked, freely navigable). */
export type PipelineStep = 1 | 2 | 3 | 4;

export const PIPELINE_STEPS: ReadonlyArray<{
  step: PipelineStep;
  label: string;
  short: string;
}> = [
  { step: 1, label: "Clean up", short: "Merge duplicates" },
  { step: 2, label: "Give meaning", short: "Assign roles" },
  { step: 3, label: "Fill gaps", short: "Complete system" },
  { step: 4, label: "Review & export", short: "Ship it" },
] as const;

export function clampStep(value: unknown): PipelineStep {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 2 || n === 3 || n === 4) return n;
  return 1;
}

export function primaryCtaLabel(step: PipelineStep, created: boolean): string {
  switch (step) {
    case 1:
      return "Next: give your colors meaning";
    case 2:
      return "Next: fill the gaps";
    case 3:
      return "Review & export";
    case 4:
      return created ? "Copy design.md" : "Create System";
  }
}

export function stepPageTitle(step: PipelineStep): string {
  switch (step) {
    case 1:
      return "Clean up — merge duplicates";
    case 2:
      return "Give meaning — assign roles";
    case 3:
      return "Fill gaps — complete your system";
    case 4:
      return "Review & export — ship your design system";
  }
}

export interface PipelineProgress {
  openClusters: number;
  rolesMet: number;
  rolesTotal: number;
  gaps: number;
  created: boolean;
}

/**
 * Resume orientation (UX_RESEARCH P9): a restored draft lands on the furthest
 * incomplete step, measured along the pipeline — gaps outrank roles outrank
 * clusters. Everything done (or created) lands on Review & export.
 */
export function furthestIncompleteStep(p: PipelineProgress): PipelineStep {
  if (p.created) return 4;
  if (p.gaps > 0) return 3;
  if (p.rolesMet < p.rolesTotal) return 2;
  if (p.openClusters > 0) return 1;
  return 4;
}

/** The welcome-back toast shown alongside the resume orientation. */
export function welcomeBackMessage(p: PipelineProgress): string {
  switch (furthestIncompleteStep(p)) {
    case 1:
      return `Welcome back — ${p.openClusters} cluster${p.openClusters === 1 ? "" : "s"} to review.`;
    case 2:
      return `Welcome back — ${p.rolesTotal - p.rolesMet} role${
        p.rolesTotal - p.rolesMet === 1 ? "" : "s"
      } to assign.`;
    case 3:
      return `Welcome back — ${p.gaps} gap${p.gaps === 1 ? "" : "s"} left.`;
    case 4:
      return p.created
        ? "Welcome back — your system's ready. Ship it."
        : "Welcome back — review & export when you're ready.";
  }
}
