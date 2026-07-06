import { describe, expect, it } from "vitest";
import {
  clampStep,
  furthestIncompleteStep,
  HOME_STEP,
  welcomeBackMessage,
  type PipelineProgress,
} from "./pipeline";

const base: PipelineProgress = {
  openClusters: 0,
  rolesMet: 18,
  rolesTotal: 18,
  gaps: 0,
  derivedCount: 14,
  created: false,
};

describe("clampStep", () => {
  it("clamps garbage to HOME (the complete draft) and passes valid steps through", () => {
    expect(clampStep(undefined)).toBe(HOME_STEP);
    expect(clampStep("7")).toBe(HOME_STEP);
    expect(clampStep(1)).toBe(1);
    expect(clampStep("4")).toBe(4);
  });
});

describe("furthestIncompleteStep (derivation-first)", () => {
  it("a restored draft always lands on HOME — never a work queue", () => {
    expect(furthestIncompleteStep(base)).toBe(HOME_STEP);
    expect(furthestIncompleteStep({ ...base, openClusters: 4, gaps: 9 })).toBe(HOME_STEP);
  });

  it("a created system lands on review & export", () => {
    expect(furthestIncompleteStep({ ...base, created: true })).toBe(4);
  });
});

describe("welcomeBackMessage", () => {
  it("mentions the merge queue when proposals wait", () => {
    expect(welcomeBackMessage({ ...base, openClusters: 4 })).toBe(
      "Welcome back — your draft is ready; 4 merges to review.",
    );
    expect(welcomeBackMessage({ ...base, openClusters: 1 })).toBe(
      "Welcome back — your draft is ready; 1 merge to review.",
    );
  });

  it("celebrates a created system, else points at the draft", () => {
    expect(welcomeBackMessage({ ...base, created: true })).toBe(
      "Welcome back — your system's ready. Ship it.",
    );
    expect(welcomeBackMessage(base)).toBe("Welcome back — your draft is ready to review.");
  });
});
