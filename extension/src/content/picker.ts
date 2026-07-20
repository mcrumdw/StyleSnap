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
let tornDown = false;
let captureCounter = 0;
const nextCaptureId = () => `cap-${++captureCounter}`;

// ── Overlay elements (created lazily) ──────────────────────────────
let outline: HTMLDivElement | null = null;
let chip: HTMLDivElement | null = null;

/** True while this content script still belongs to a living extension. */
function isExtensionAlive(): boolean {
  try {
    return Boolean(chrome.runtime?.id);
  } catch {
    return false;
  }
}

/**
 * After reload/update, orphaned picker scripts throw
 * "Extension context invalidated" on any chrome.runtime call.
 * Tear down quietly so the page console stays clean until refresh.
 */
function teardown() {
  if (tornDown) return;
  tornDown = true;
  active = false;
  hovered = null;
  hideOverlay();
  outline?.remove();
  chip?.remove();
  outline = null;
  chip = null;
  try {
    document.body.style.cursor = "";
  } catch {
    /* page may be unloading */
  }
  document.removeEventListener("mousemove", onMove, true);
  document.removeEventListener("click", onClick, true);
  document.removeEventListener("keydown", onKey, true);
  try {
    chrome.runtime.onMessage.removeListener(onRuntimeMessage);
  } catch {
    /* already dead */
  }
}

function safeSendMessage(msg: PickerMessage): boolean {
  if (tornDown || !isExtensionAlive()) {
    teardown();
    return false;
  }
  try {
    void chrome.runtime.sendMessage(msg);
    return true;
  } catch {
    teardown();
    return false;
  }
}

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
  if (tornDown || !isExtensionAlive()) {
    teardown();
    return;
  }
  ensureOverlay();
  const r = el.getBoundingClientRect();
  Object.assign(outline!.style, {
    display: "block",
    top: `${r.top}px`,
    left: `${r.left}px`,
    width: `${r.width}px`,
    height: `${r.height}px`,
  });
  const prefix = patternMode ? "Parent · " : "";
  try {
    chip!.textContent = prefix + previewLabel(el);
  } catch {
    chip!.textContent = prefix + describeSource(el);
  }
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
  return safeSendMessage(msg);
}

/**
 * :hover follows the real pointer — mouseleave events do not clear it.
 * Park a full-viewport shield under the cursor for one frame so computed
 * styles resolve to the resting (default) appearance before we extract.
 */
function withHoverCleared(run: () => void) {
  hideOverlay();
  hovered = null;
  const shield = document.createElement("div");
  shield.setAttribute("data-stylesnap-hover-shield", "");
  Object.assign(shield.style, {
    position: "fixed",
    inset: "0",
    zIndex: "2147483647",
    cursor: "crosshair",
    background: "transparent",
  } as CSSStyleDeclaration);
  document.documentElement.appendChild(shield);
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        if (!tornDown && isExtensionAlive()) run();
        else teardown();
      } finally {
        shield.remove();
      }
    });
  });
}

function onMove(e: MouseEvent) {
  if (tornDown) return;
  if (!isExtensionAlive()) {
    teardown();
    return;
  }
  if (!active) return;
  const el = e.target as Element;
  if (!el || el === hovered) return;
  if (el instanceof Element && el.closest?.("[data-stylesnap-hover-shield]")) return;
  hovered = el;
  showOverlay(el);
}

function onClick(e: MouseEvent) {
  if (tornDown) return;
  if (!isExtensionAlive()) {
    teardown();
    return;
  }
  if (!active) return;
  e.preventDefault();
  e.stopPropagation();
  const el = e.target as Element;
  if (!el || (el instanceof Element && el.closest?.("[data-stylesnap-hover-shield]"))) return;

  withHoverCleared(() => {
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
    // Brief success flash once overlay can show again on next move
    ensureOverlay();
    const r = el.getBoundingClientRect();
    Object.assign(outline!.style, {
      display: "block",
      top: `${r.top}px`,
      left: `${r.left}px`,
      width: `${r.width}px`,
      height: `${r.height}px`,
      borderColor: SUCCESS,
    });
    setTimeout(() => {
      if (outline) outline.style.borderColor = ACCENT;
      hideOverlay();
    }, 250);
  });
}

function onKey(e: KeyboardEvent) {
  if (tornDown) return;
  if (active && e.key === "Escape") setActive(false);
}

function setActive(next: boolean) {
  if (tornDown) return;
  active = next;
  document.body.style.cursor = next ? "crosshair" : "";
  if (!next) {
    hovered = null;
    hideOverlay();
  }
  safeSendMessage({ kind: "picker/state", active } as PickerMessage);
}

function onRuntimeMessage(
  msg: PickerMessage,
  _sender: chrome.runtime.MessageSender,
  sendResponse: (response: PickerMessage) => void,
): boolean {
  if (tornDown || !isExtensionAlive()) {
    teardown();
    return false;
  }
  try {
    if (msg.kind === "picker/ping") {
      sendResponse({ kind: "picker/pong" } satisfies PickerMessage);
      return false;
    }
    if (msg.kind === "picker/setActive") {
      setActive(msg.active);
      if (msg.patternMode !== undefined) patternMode = msg.patternMode;
      sendResponse({ kind: "picker/pong" } satisfies PickerMessage);
      return false;
    }
    if (msg.kind === "picker/setPatternMode") {
      patternMode = msg.enabled;
      sendResponse({ kind: "picker/pong" } satisfies PickerMessage);
      return false;
    }
    if (msg.kind === "picker/scanFoundations") {
      const foundations: CaptureFoundations = scanPageFoundations();
      sendResponse({ kind: "picker/foundations", foundations } satisfies PickerMessage);
      return false;
    }
  } catch {
    teardown();
  }
  return false;
}

document.addEventListener("mousemove", onMove, true);
document.addEventListener("click", onClick, true);
document.addEventListener("keydown", onKey, true);

chrome.runtime.onMessage.addListener(onRuntimeMessage);
