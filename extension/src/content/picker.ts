// In-page element picker (content script).
// Draws a hover outline + inspector chip, captures tokens on click, and reports
// them to the side panel via the background worker. Pick mode is toggled by message.

import type { PickerMessage } from "../shared/types";
import { extractTokens, previewLabel } from "./extract";

const ACCENT = "#6E56F7"; // placeholder StyleSnap accent until DESIGN.md lands
let active = false;
let hovered: Element | null = null;

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
    borderRadius: "3px",
    zIndex: "2147483646",
    transition: "all 60ms ease-out",
    boxShadow: `0 0 0 2px rgba(110,86,247,0.25)`,
  } as CSSStyleDeclaration);

  chip = document.createElement("div");
  Object.assign(chip.style, {
    position: "fixed",
    pointerEvents: "none",
    background: "#111317",
    color: "#fff",
    font: "12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace",
    padding: "4px 8px",
    borderRadius: "6px",
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
  chip!.textContent = previewLabel(el);
  chip!.style.display = "block";
  chip!.style.top = `${Math.max(4, r.top - 28)}px`;
  chip!.style.left = `${r.left}px`;
}

function hideOverlay() {
  if (outline) outline.style.display = "none";
  if (chip) chip.style.display = "none";
}

// ── Event handlers ─────────────────────────────────────────────────
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
  const tokens = extractTokens(el);
  if (tokens.length === 0) return; // "Nothing to grab here" — no-op
  const msg: PickerMessage = {
    kind: "picker/captured",
    tokens,
    pageUrl: location.href,
  };
  chrome.runtime.sendMessage(msg);
  // brief confirmation pulse
  if (outline) {
    outline.style.borderColor = "#22C55E";
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

chrome.runtime.onMessage.addListener((msg: PickerMessage) => {
  if (msg.kind === "picker/setActive") setActive(msg.active);
});
