import { describe, expect, it } from "vitest";
import {
  defaultInkForSurface,
  defaultInverseForSurface,
  firstInverseCandidate,
  firstReadableOnSurface,
  isInverseSurfaceFill,
  isLightSurface,
  passesTextOnSurface,
} from "./text-on-surface";

describe("text-on-surface pairing (§2.72)", () => {
  it("treats near-white as a light page", () => {
    expect(isLightSurface("#FFFFFF")).toBe(true);
    expect(isLightSurface("#F9FAFB")).toBe(true);
    expect(isLightSurface("#101828")).toBe(false);
  });

  it("rejects white body ink on a light page", () => {
    expect(passesTextOnSurface("#FFFFFF", "#F9FAFB")).toBe(false);
    expect(passesTextOnSurface("#101828", "#F9FAFB")).toBe(true);
  });

  it("picks the first AA-readable candidate for body ink", () => {
    const picked = firstReadableOnSurface(
      [
        { value: "#FFFFFF", opacity: 1 },
        { value: "#101828", opacity: 1 },
      ],
      "#FFFFFF",
    );
    expect(picked?.value).toBe("#101828");
  });

  it("picks near-white for inverse on a light page", () => {
    const picked = firstInverseCandidate(
      [
        { value: "#101828", opacity: 1 },
        { value: "#FFFFFF", opacity: 1 },
      ],
      "#F5F5F5",
    );
    expect(picked?.value).toBe("#FFFFFF");
  });

  it("defaults ink/inverse from page polarity", () => {
    expect(defaultInkForSurface("#FFFFFF", "#1A1A1A")).toBe("#1A1A1A");
    expect(defaultInverseForSurface("#FFFFFF", "#1A1A1A")).toBe("#FFFFFF");
    expect(defaultInkForSurface("#111111", "#1A1A1A")).toBe("#FFFFFF");
    expect(defaultInverseForSurface("#111111", "#1A1A1A")).toBe("#1A1A1A");
  });

  it("detects dark / brand section fills as inverse surfaces", () => {
    expect(isInverseSurfaceFill("#1A1A1A", "#FFFFFF")).toBe(true);
    expect(isInverseSurfaceFill("#C8102E", "#FFFFFF")).toBe(true);
    expect(isInverseSurfaceFill("#FFFFFF", "#FFFFFF")).toBe(false);
    expect(isInverseSurfaceFill("#F9FAFB", "#FFFFFF")).toBe(false);
  });
});
