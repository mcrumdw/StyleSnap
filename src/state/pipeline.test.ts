import { describe, expect, it } from "vitest";
import {
  clampStep,
  furthestIncompleteStep,
  welcomeBackMessage,
  type PipelineProgress,
} from "./pipeline";

const base: PipelineProgress = {
  openClusters: 0,
  rolesMet: 18,
  rolesTotal: 18,
  gaps: 0,
  created: false,
};

describe("clampStep", () => {
  it("clamps garbage to step 1 and passes valid steps through", () => {
    expect(clampStep(undefined)).toBe(1);
    expect(clampStep("7")).toBe(1);
    expect(clampStep(3)).toBe(3);
    expect(clampStep("4")).toBe(4);
  });
});

describe("furthestIncompleteStep", () => {
  it("lands on gaps before roles before clusters", () => {
    expect(furthestIncompleteStep({ ...base, openClusters: 2, rolesMet: 3, gaps: 5 })).toBe(3);
    expect(furthestIncompleteStep({ ...base, openClusters: 2, rolesMet: 3 })).toBe(2);
    expect(furthestIncompleteStep({ ...base, openClusters: 2 })).toBe(1);
  });

  it("lands on review & export when everything is done or created", () => {
    expect(furthestIncompleteStep(base)).toBe(4);
    expect(furthestIncompleteStep({ ...base, gaps: 9, created: true })).toBe(4);
  });
});

describe("welcomeBackMessage", () => {
  it("counts the work at the landing step", () => {
    expect(welcomeBackMessage({ ...base, gaps: 3 })).toBe("Welcome back — 3 gaps left.");
    expect(welcomeBackMessage({ ...base, gaps: 1 })).toBe("Welcome back — 1 gap left.");
    expect(welcomeBackMessage({ ...base, rolesMet: 17 })).toBe(
      "Welcome back — 1 role to assign.",
    );
    expect(welcomeBackMessage({ ...base, openClusters: 4 })).toBe(
      "Welcome back — 4 clusters to review.",
    );
    expect(welcomeBackMessage({ ...base, created: true })).toBe(
      "Welcome back — your system's ready. Ship it.",
    );
  });
});
