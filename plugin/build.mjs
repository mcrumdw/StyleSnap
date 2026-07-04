import * as esbuild from "esbuild";
import { mkdirSync, copyFileSync } from "node:fs";

const watch = process.argv.includes("--watch");

mkdirSync("dist", { recursive: true });

const codeCtx = {
  entryPoints: ["src/code.ts"],
  bundle: true,
  outfile: "dist/code.js",
  target: "es2017",
  // Figma's plugin sandbox has no module system — everything must be one plain script.
  format: "iife",
  logLevel: "info",
};

function copyUi() {
  copyFileSync("src/ui.html", "dist/ui.html");
}

if (watch) {
  const ctx = await esbuild.context(codeCtx);
  await ctx.watch();
  copyUi();
  console.log("watching src/ — press Ctrl+C to stop");
} else {
  await esbuild.build(codeCtx);
  copyUi();
}
