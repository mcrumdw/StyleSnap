import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.config";

export default defineConfig({
  plugins: [react(), crx({ manifest })],
  // Isolate from the Webtool's root postcss/tailwind config — the extension
  // ships plain CSS and must not inherit the parent project's pipeline.
  css: { postcss: {} },
});
