/**
 * Vestigial pipeline type (the step chrome was removed in the 2026-07-06
 * fix-up — the app is one page now). Kept so pre-existing drafts with a
 * persisted `currentStep` still deserialize cleanly.
 */
export type PipelineStep = 1 | 2 | 3 | 4;

export function clampStep(value: unknown): PipelineStep {
  const n = typeof value === "number" ? value : Number(value);
  if (n === 1 || n === 2 || n === 4) return n;
  return 3;
}
