---
name: Style names in export
overview: Fix Figma Export Variables & Styles so every Color, Text, and Effect style keeps its full accordion path (`color/feedback/warning`, `type/body`, `shadow/md`) on the token as `name` + `context.authoredName`, and stop collapsing different role names that share the same value.
todos:
  - id: fix-dedupe
    content: "Rewrite preferSemanticNames: keep all role-path Color/Type/Effect styles; drop only non-role value dupes"
    status: completed
  - id: docs-rebuild
    content: Normalize full slash paths onto name + authoredName; rebuild plugin; note in FIGMA_HANDOFF / DECISIONS
    status: completed
isProject: false
---

# Preserve Color / Type / Effect style names in Figma → web export

## Problem

Your Local styles accordion paths are the system roles StyleSnap needs:

- Color: `color/action/primary`, `color/feedback/warning`, …
- Type: `type/body`, `type/heading`, …
- Effects: `shadow/md`, `blur/backdrop`, …

[`plugin/src/export-system.ts`](plugin/src/export-system.ts) already reads `style.name` (Figma’s full slash path) into `name` + `context.authoredName`. But `preferSemanticNames()` then **keeps only one token per identical value**. Same navy used for `color/action/primary`, `color/border/focus`, and `color/text/link` → one survivor; other role names never appear in the JSON. Hex primitives can also beat or replace role-named styles. StyleSnap then invents “derived” fills instead of harvesting authored names (same pattern as [`docs/fixtures/capture-figma-clean.json`](docs/fixtures/capture-figma-clean.json): roles live in `context.authoredName`).

## Fix (plugin only)

Rewrite dedupe in [`plugin/src/export-system.ts`](plugin/src/export-system.ts):

1. **Keep every distinct system-role path** — if `authoredName` / `name` starts with `color/`, `type/`, `space/`, `radius/`, `border-width/`, `shadow/`, `blur/`, `effect/`, or `gradient/`, emit that token even when the value matches another token.
2. **Drop only non-role duplicates** — e.g. Primitive `color/9f6b26` or a nameless duplicate when a role-named style/var already covers that value.
3. **Apply to all three style kinds** (already exported; just stop collapsing them):
   - Paint Styles → color / gradient  
   - Text Styles → typography (`type/…`)  
   - Effect Styles → shadow (`shadow/…`, `blur/…`)
4. **Normalize** Figma `style.name` / `variable.name`: trim; use the full slash path unchanged as both `name` and `context.authoredName` (fixture-compatible).
5. Sort role-named tokens first in the JSON for easier inspection.

No web-app changes — existing harvest / `deriveRoleCandidates` already key off exact `authoredName` matches.

## Docs

One line in [`docs/FIGMA_HANDOFF.md`](docs/FIGMA_HANDOFF.md) + DECISIONS §2.67 history: export keeps one token per style/role path; value-dedupe only drops hex/non-role duplicates.

## Verify

Reload plugin → Export Variables & Styles → JSON contains separate entries with e.g.:

```json
"name": "color/feedback/warning",
"context": { "authoredName": "color/feedback/warning" }
```

(and the same for `type/…` and `shadow/…`). Fresh paste into StyleSnap should seed those roles from capture, not “derived”.
