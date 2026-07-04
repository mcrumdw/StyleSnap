# StyleSnap Figma Plugin — PRD

**Project Vibe:** *One click to extract your design tokens — one click to import them back.*

**Date:** June 2026 · **Owner:** Theresa Buchner · **Version:** v0.1

**Repo:** https://github.com/mcrumdw/StyleSnap.git · **Part of:** StyleSnap system PRD

---

## 1. Core Context

**Problem**

Figma has no built-in way to extract design tokens from a finished design in a structured, machine-readable format. Designers either export nothing, or manually copy values into spreadsheets or token tools. There is also no way to push a cleaned token set back into Figma as styles and variables without manual entry or a PAT-gated tool.

**Solution**

A Figma Side Panel plugin with two modes:

- **Export mode:** select a frame or component → extract all design tokens → copy as JSON to clipboard
- **Import mode:** paste cleaned JSON from StyleSnap Webtool → automatically create Paint Styles, Text Styles, and Variables in Figma

**Target Users**
- Designers using StyleSnap to build a design system from a finished Figma design
- Primarily the StyleSnap team and demo audience (Figma Education accounts)

**Non-Goals**
- No direct API connection to the StyleSnap Webtool (JSON bridge only)
- No authentication or Figma Personal Access Token required
- No support for extracting tokens from multiple files simultaneously
- No auto-sync or live update of tokens

---

## 2. Plugin UI

**Layout:** Figma Side Panel (~300px wide). Not a popup — full panel for comfortable review.

**Two tabs:**
- **Export** (default): shows extracted token list + Copy to StyleSnap button
- **Import**: paste zone + preview + Create Styles/Variables button

**Design principles:**
- Compact but readable — mono labels, clear value display
- Status feedback on every action (extracting, copied, creating styles...)
- Error states for empty selections or invalid JSON

---

## 3. User Flows

### Flow 1 — Export JSON

```
1. Designer opens Figma file
2. Selects a frame or component on the canvas
3. Opens StyleSnap plugin → Side Panel appears, Export tab active
4. Plugin scans selection → token list renders in panel
   → each row shows: token type, value, source layer name
5. Designer reviews list
6. Clicks "Copy to StyleSnap"
   → JSON (StyleSnapExport format) is copied to clipboard
   → Panel shows confirmation: "✓ Copied — paste into StyleSnap Webtool"
7. Designer opens StyleSnap Webtool and pastes JSON
```

**Edge cases:**
- Empty selection → panel shows "Select a frame or component to get started"
- Selection with no extractable tokens → panel shows "No tokens found in this selection"
- Very large selection (100+ layers) → show loading indicator during scan

---

### Flow 2 — Import Design System (Round-Trip)

```
1. Designer has finished working in StyleSnap Webtool
   (merged duplicates, created system, exported cleaned JSON)
2. Opens StyleSnap plugin → switches to Import tab
3. Pastes cleaned JSON into paste zone
4. Plugin validates JSON against StyleSnapExport schema
   → Preview renders: list of styles/variables to be created
   → Each entry shows: type, name, value
5. Designer reviews preview
6. Clicks "Create Styles & Variables"
   → Plugin calls Figma API:
      - color tokens → figma.createPaintStyle()
      - typography tokens → figma.createTextStyle()
      - spacing / border-radius / border-width / shadow → figma.variables.createVariable()
7. Success state: "✓ X styles and Y variables created"
   → Designer closes plugin and finds new styles/variables in Figma assets panel
```

**Edge cases:**
- Invalid JSON → "Invalid format — paste a StyleSnap export"
- Style with same name already exists → skip + show warning: "X styles already existed and were skipped"
- Figma API error → show error message with type and suggested fix

---

## 4. Tech Stack

| Layer | Choice |
|---|---|
| Language | TypeScript |
| Plugin API | Figma Plugin API (Education plan — full API access) |
| UI | HTML/CSS in Figma iframe (Side Panel) |
| UI Framework | Vanilla HTML or lightweight React (TBD based on complexity) |
| Data Format | StyleSnapExport JSON — defined in docs/types.ts |
| Build Tool | esbuild or Vite (Figma plugin standard) |
| Dev Tools | Claude Code (CLI) + Cursor |

---

## 5. Token Extraction — Scope

The plugin extracts all 6 token types defined in `docs/types.ts`:

| Token Type | Figma API Source | Output Format |
|---|---|---|
| `color` | `node.fills` (solid fills) | hex string + opacity |
| `gradient` | `node.fills` (gradient fills) | GradientValue object (kind, angle, stops) |
| `typography` | `node.fontName`, `node.fontSize`, `node.fontWeight`, `node.lineHeight` | TypographyValue object |
| `spacing` | `node.paddingTop/Bottom/Left/Right`, `node.itemSpacing` | number (px) |
| `border-radius` | `node.cornerRadius` | number (px) |
| `border-width` | `node.strokeWeight` | number (px) |
| `shadow` | `node.effects` (DROP_SHADOW + INNER_SHADOW types) | ShadowValue array (one ShadowLayer per effect) |

**Extraction rules:**
- Only extract from directly selected nodes and their children (no deep recursion beyond 3 levels)
- Skip hidden layers (`node.visible === false`)
- Deduplicate identical values at extraction time (same value + same type = one token); set `occurrences` to the count of duplicates collapsed
- Generate globally unique IDs: source-prefixed (`fig_` + UUID, e.g. `fig_a1b2c3d4`)
- Group tokens from the same node under the same `captureId` (one UUID per node)
- Set `name: null` — naming happens in the Webtool
- Set `merged: false`, `mergedFrom: undefined` — merge happens in the Webtool
- Populate `context.authoredName` from Figma Variable/Style name when available (strongest role signal)

---

## 6. Data Model

The plugin outputs and accepts `StyleSnapExport` as defined in `docs/types.ts`. Do not define local token types — always import from the shared schema.

**Export output example:**
```json
{
  "meta": {
    "source": "figma",
    "exportedAt": "2026-06-28T10:00:00Z",
    "figmaFile": "MyApp Design",
    "version": "2.0"
  },
  "tokens": [
    {
      "id": "fig_a1b2c3d4",
      "captureId": "cap_e5f6g7h8",
      "type": "color",
      "value": "#FF46AF",
      "opacity": 1,
      "source": "Button/Primary",
      "name": null,
      "occurrences": 1,
      "merged": false,
      "context": {
        "authoredName": "color/action/primary"
      }
    }
  ]
}
```

**Import input:** same `StyleSnapExport` format, with `name` fields populated by the Webtool user.

---

## 7. Feature Modules

### Module 1 — Plugin Scaffold
**Priority: P0**

- Figma plugin project initialized with TypeScript + Plugin API template
- Side Panel manifest configured (`"ui": { "themeColors": true }`)
- Build pipeline working (esbuild/Vite → dist/)
- Plugin loads in Figma Education account without errors

### Module 2 — Token Extraction Engine
**Priority: P0**

- Reads selected node tree (max 3 levels deep)
- Extracts all 7 token types per extraction scope table above (incl. gradient)
- Maps to `StyleSnapExport` format (docs/types.ts v2.0): source-prefixed IDs, captureId, occurrences, context.authoredName
- Skips hidden layers, deduplicates identical values

### Module 3 — Export UI
**Priority: P0**

- Side Panel renders token list after extraction
- Columns: Type, Value, Source layer
- Token count shown per type
- "Copy to StyleSnap" button → copies valid JSON to clipboard
- Confirmation state after copy
- Empty/error states handled

### Module 4 — Import UI & Style Creation
**Priority: P0**

- Import tab with paste zone
- JSON validation on paste (checks against StyleSnapExport schema)
- Preview list of styles/variables to be created
- "Create Styles & Variables" button triggers Figma API calls
- Success/skip/error feedback per token
- Summary state: "X created, Y skipped"

---

## 8. Task Breakdown

### Dependencies
- `docs/types.ts` must be committed before Module 2 (extraction mapping)
- Module 2 must be done before Module 3 (UI needs real token data to render)
- Module 3 must be testable before Makram starts Webtool JSON upload (Task 2)
- Module 4 depends on Makram's JSON export (Webtool Task 7) being available for testing

### Tasks
- Task 1: Scaffold plugin project (TypeScript + Side Panel manifest + build pipeline)
- Task 2: Extraction engine — read selection, extract all 6 token types, map to types.ts
- Task 3: Export UI — token list render + Copy to StyleSnap button + confirmation state
- Task 4: Import UI — paste zone + JSON validation + preview list
- Task 5: Style/Variable creation — Figma API calls + success/skip/error feedback
- ✅ Done: Plugin exports valid JSON to clipboard + imports cleaned tokens as Figma styles/variables

---

## 9. Definition of Done

- Selecting any frame or component exports valid `StyleSnapExport` JSON to clipboard
- JSON validates against `docs/types.ts` without errors
- All 6 token types are extracted correctly (verified with a test Figma file)
- Pasting cleaned Webtool JSON creates corresponding styles and variables in Figma
- Skips duplicates gracefully without crashing
- Side Panel loads without errors on Figma Education account
- End-to-end tested with Makram's Webtool at least once before deadline

---

## 10. Out of Scope
- Extracting tokens from Remote Library components (requires PAT — contradicts zero-setup value)
- Gradient fills are included in MVP scope (see §5)
- Multiple selection across different frames simultaneously
- Undo support for import (Figma handles this natively via Cmd+Z)

---

*PRD version: v0.1 · StyleSnap Figma Plugin · June 2026*
