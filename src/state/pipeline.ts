/**
 * Phase 10 — the four-step review pipeline, derivation-first (never locked,
 * freely navigable). Step 3 "Your system" is HOME: the user lands on the
 * complete draft, and steps are repair shops, not a work queue.
 */
export type PipelineStep = 1 | 2 | 3 | 4;

export const PIPELINE_STEPS: ReadonlyArray<{
  step: PipelineStep;
  label: string;
  short: string;
}> = [
  { step: 1, label: "Merges", short: "Review proposals" },
  { step: 2, label: "Anchors & meaning", short: "Swap the corners" },
  { step: 3, label: "Your system", short: "The complete draft" },
  { step: 4, label: "Review & export", short: "Ship it" },
] as const;

export const HOME_STEP: PipelineStep = 3;

export function clampStep(value: unknown): PipelineStep {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 1 || n === 2 || n === 4) return n;
  return HOME_STEP;
}

export function primaryCtaLabel(step: PipelineStep, created: boolean): string {
  switch (step) {
    case 1:
      return "Next: check your anchors";
    case 2:
      return "Next: see your system";
    case 3:
      return "Review & export";
    case 4:
      return created ? "Copy design.md" : "Create System";
  }
}

export function stepPageTitle(step: PipelineStep): string {
  switch (step) {
    case 1:
      return "Merges — review what we grouped";
    case 2:
      return "Anchors & meaning — the corners of your system";
    case 3:
      return "Your system — a complete draft, yours to change";
    case 4:
      return "Review & export — ship your design system";
  }
}

export interface PipelineProgress {
  openClusters: number;
  rolesMet: number;
  rolesTotal: number;
  gaps: number;
  derivedCount: number;
  created: boolean;
}

/**
 * Resume orientation (UX_RESEARCH P9, derivation-first): a restored draft
 * lands on HOME — the complete system — unless it's already created (then
 * the export step). The summary strip carries the to-do counts.
 */
export function furthestIncompleteStep(p: PipelineProgress): PipelineStep {
  return p.created ? 4 : HOME_STEP;
}

/** The welcome-back toast shown alongside the resume orientation. */
export function welcomeBackMessage(p: PipelineProgress): string {
  if (p.created) return "Welcome back — your system's ready. Ship it.";
  if (p.openClusters > 0) {
    return `Welcome back — your draft is ready; ${p.openClusters} merge${
      p.openClusters === 1 ? "" : "s"
    } to review.`;
  }
  return "Welcome back — your draft is ready to review.";
}
