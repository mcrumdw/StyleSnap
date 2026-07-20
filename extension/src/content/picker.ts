// In-page element picker (content script).
// Draws a hover outline + inspector chip, captures tokens on click, and reports
// them to the side panel via the background worker. Pick mode is toggled by message.

import type { CaptureFoundations, PickerMessage } from "../shared/types";
import { extractTokens, previewLabel, describeSource } from "./extract";
import { scanPageFoundations } from "./foundations";

// DESIGN.md brand-primary / success — high-contrast outline over arbitrary pages.
const ACCENT = "#5B2EFF";
const SUCCESS = "#1FB877";
let active = false;
let patternMode = false;
let hovered: Element | null = null;
let captureCounter = 0;
const nextCaptureId = () => `cap-${++captureCounter}`;

// ── Overlay elements (created lazily) ──────────────────────────────
let outline: HTMLDivElement | null = null;
let chip: HTMLDivElement | null = null;

function ensureOverlay() {
  if (outline) return;
  outline = document.createElement("div");
  Object.assign(outline.style, {
    position: "fixed",
    pointerEvents: "none",
    border: `2px solid ${ACCENT}`,
    borderRadius: "8px",
    zIndex: "2147483646",
    transition: "all 150ms ease-out",
    boxShadow: `4px 4px 0 0 #14121F`,
  } as CSSStyleDeclaration);

  chip = document.createElement("div");
  Object.assign(chip.style, {
    position: "fixed",
    pointerEvents: "none",
    background: "#14121F",
    color: "#FFFFFF",
    font: "500 13px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
    padding: "4px 8px",
    borderRadius: "8px",
    border: `2px solid ${ACCENT}`,
    zIndex: "2147483647",
    maxWidth: "320px",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  } as CSSStyleDeclaration);

  document.documentElement.append(outline, chip);
}

function showOverlay(el: Element) {
  ensureOverlay();
  const r = el.getBoundingClientRect();
  Object.assign(outline!.style, {
    display: "block",
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
  const prefix = patternMode ? "Pattern · " : "";
  chip!.textContent = prefix + previewLabel(el);
  chip!.style.display = "block";
  chip!.style.top = `${Math.max(4, r.top - 28)}px`;
  chip!.style.left = `${r.left}px`;
}

function hideOverlay() {
  if (outline) outline.style.display = "none";
  if (chip) chip.style.display = "none";
}

function emitCapture(el: Element, patternId?: string) {
  const captureId = nextCaptureId();
  const tokens = extractTokens(el, captureId);
  if (tokens.length === 0) return false;
  const msg: PickerMessage = {
    kind: "picker/captured",
    capture: {
      captureId,
      source: describeSource(el),
      tokens,
      patternId,
    },
    pageUrl: location.href,
  };
  chrome.runtime.sendMessage(msg);
  return true;
}

function onMove(e: MouseEvent) {
  if (!active) return;
  const el = e.target as Element;
  if (!el || el === hovered) return;
  hovered = el;
  showOverlay(el);
}

function onClick(e: MouseEvent) {
  if (!active) return;
  e.preventDefault();
  e.stopPropagation();
  const el = e.target as Element;
  let ok = false;
  if (patternMode) {
    const patternId = `pat-${Date.now()}`;
    ok = emitCapture(el, patternId);
    const parent = el.parentElement;
    if (parent && parent !== document.body && parent !== document.documentElement) {
      emitCapture(parent, patternId);
    }
  } else {
    ok = emitCapture(el);
  }
  if (!ok) return;
  if (outline) {
    outline.style.borderColor = SUCCESS;
    setTimeout(() => outline && (outline.style.borderColor = ACCENT), 250);
  }
}

function onKey(e: KeyboardEvent) {
  if (active && e.key === "Escape") setActive(false);
}

function setActive(next: boolean) {
  active = next;
  document.body.style.cursor = next ? "crosshair" : "";
  if (!next) {
    hovered = null;
    hideOverlay();
  }
  chrome.runtime.sendMessage({ kind: "picker/state", active } as PickerMessage);
}

document.addEventListener("mousemove", onMove, true);
document.addEventListener("click", onClick, true);
document.addEventListener("keydown", onKey, true);

chrome.runtime.onMessage.addListener((msg: PickerMessage, _sender, sendResponse) => {
  if (msg.kind === "picker/setActive") {
    setActive(msg.active);
    if (msg.patternMode !== undefined) patternMode = msg.patternMode;
  } else if (msg.kind === "picker/setPatternMode") {
    patternMode = msg.enabled;
  } else if (msg.kind === "picker/scanFoundations") {
    const foundations: CaptureFoundations = scanPageFoundations();
    sendResponse({ kind: "picker/foundations", foundations } satisfies PickerMessage);
    return true;
  }
  return undefined;
});
