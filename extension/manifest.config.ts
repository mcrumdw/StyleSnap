import { defineManifest } from "@crxjs/vite-plugin";

// StyleSnap Web Picker — Manifest V3.
// Side panel is the workspace; the content script runs the in-page element picker.
export default defineManifest({
  manifest_version: 3,
  name: "StyleSnap Web Picker",
  version: "0.1.0",
  description:
    "Click any element on any website and capture its design tokens into StyleSnap.",
  action: {
    default_title: "Open StyleSnap",
  },
  permissions: ["sidePanel", "activeTab", "scripting", "clipboardWrite"],
  side_panel: {
    default_path: "src/sidepanel/index.html",
  },
  background: {
    service_worker: "src/background/service-worker.ts",
    type: "module",
  },
  content_scripts: [
    {
      matches: ["<all_urls>"],
      js: ["src/content/picker.ts"],
      run_at: "document_idle",
    },
  ],
});
