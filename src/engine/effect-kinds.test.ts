import { describe, expect, it } from "vitest";
import { backdropBlurPx, isBackdropBlurToken } from "./effect-kinds";
import { formatValue } from "../state/workspace";
import { humanValueLabel } from "../state/token-display";
import type { StyleSnapToken } from "../contract/types";

const blurToken: StyleSnapToken = {
  id: "manual_blur",
  captureId: "manual-blur",
  source: "manual entry:backdrop-blur",
  name: null,
  occurrences: 1,
  merged: false,
  context: { cssProperty: "backdrop-filter" },
  type: "shadow",
  value: [
    {
      inset: false,
      offsetX: 0,
      offsetY: 0,
      blur: 16,
      spread: 0,
      color: "#000000",
      opacity: 0,
    },
  ],
};

const dropToken: StyleSnapToken = {
  id: "manual_drop",
  captureId: "manual-drop",
  source: "manual entry",
  name: null,
  occurrences: 1,
  merged: false,
  type: "shadow",
  value: [
    {
      inset: false,
      offsetX: 0,
      offsetY: 4,
      blur: 8,
      spread: 0,
      color: "#101828",
      opacity: 0.1,
    },
  ],
};

describe("backdrop blur effect kind", () => {
  it("detects backdrop-filter encoding", () => {
    expect(isBackdropBlurToken(blurToken)).toBe(true);
    expect(isBackdropBlurToken(dropToken)).toBe(false);
    expect(backdropBlurPx(blurToken)).toBe(16);
  });

  it("formats as backdrop blur, not box-shadow", () => {
    expect(formatValue(blurToken)).toBe("backdrop blur 16px");
    expect(humanValueLabel(blurToken)).toBe("Backdrop blur 16px");
    expect(formatValue(dropToken)).toContain("0 4 8");
  });
});
