// Background service worker.
// Opens the side panel on action click and relays picker messages between the
// content script and the side panel.

import type { PickerMessage } from "../shared/types";

chrome.runtime.onInstalled.addListener(() => {
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch(() => {});
});

// Relay captures/state from the content script to any open side panel.
// (Side panel listens on the same runtime channel, so no extra forwarding is
// strictly required — this worker exists mainly to own panel behavior and could
// host future routing logic.)
chrome.runtime.onMessage.addListener((_msg: PickerMessage) => {
  // Intentionally pass-through; runtime broadcasts reach the side panel directly.
});
