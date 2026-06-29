# StyleSnap Webtool — Product Requirements Document

**Surface:** Webtool (the review & export hub) · **Owner:** Makram Daou · **Branch:** `makram`
**Parent doc:** [StyleSnap master PRD](../StyleSnap_PRD%20(2).docx) · **Schema:** [`docs/types.ts`](./types.ts)
**Version:** v0.1 · **Date:** June 2026

> Scope note. This PRD covers **only the Webtool**. The Figma Plugin (Theresa) and the
> Browser Extension (Murtaza) are upstream token *producers*; the Webtool is the place
> where their output is reviewed, cleaned, and turned into a deliverable. All three speak
> the same JSON defined in [`docs/types.ts`](./types.ts) — that contract is locked.

---

## 1. Why the Webtool exists

The Figma plugin and browser extension can only *collect* raw tokens. They live in small
surfaces (a plugin panel, a side panel) where you can't reasonably review dozens of values,
spot that `#FF46AF` and `#FF47AF` are "the same pink," or decide what to call things.

**The Webtool is the full-screen workspace** where the messy pile becomes a clean design
system: paste JSON → review → dedupe & merge → name → export `design.md` + cleaned JSON.

It is the surface that delivers the product's North-Star outcome:
> *A finished design becomes an exportable design system in under 10 minutes, with a
> `design.md` usable as context for Claude Code / Cursor.*

## 2. Users & primary job

Inherits the master personas (Maya, the design student; Jonas, the freelance vibe coder).
For the Webtool specifically, the job to be done is:

> "I have a bag of raw tokens from my design. Help me see them clearly, collapse the
> duplicates, give them sensible names, and hand me one file I can drop into my AI coding
> tool."

## 3. Scope

### In scope (MVP / V1)
1. **Ingest** — paste or upload a `StyleSnapExport` JSON; validate against the schema; merge
   tokens from multiple sources (Figma + extension) into one working pool.
2. **Token list** — full-screen, grouped by `TokenType`; each row shows value preview,
   `source`, and a duplicate flag.
3. **Duplicate detection** — flag exact and near-identical values per type (heuristic, not AI).
4. **Merge UI** — combine flagged duplicates into one token; user confirms the surviving
   value; merged tokens get `merged: true`.
5. **Naming** — assign a human name to each kept token (writes `name` in the schema).
6. **Create System** — produce the cleaned, deduplicated, named token set.
7. **Export** — download **`design.md`** (primary deliverable) and/or cleaned JSON.

### Out of scope (V1)
- AI-powered similarity/auto-naming (needs Anthropic API — future). V1 dedup is rule-based.
- Dependency graph (which text style uses which color).
- User accounts, backend, persistence — **all state is in-session** (refresh = empty).
- Mobile responsive layout — desktop only for the demo.
- Editing raw token *values* beyond what merging requires.

## 4. Core flow

```
Paste/upload JSON
      ↓
Validate against docs/types.ts  ──fail──▶ inline error ("This doesn't look like StyleSnap JSON")
      ↓ ok
Token list (grouped, duplicate flags shown)
      ↓
Review · merge duplicates (confirm surviving value) · name tokens
      ↓
Create System  (cleaned + deduped + named set)
      ↓
Export  →  design.md   and/or   cleaned StyleSnapExport JSON
```

## 5. Functional requirements

### 5.1 Ingest & validate
- Accept JSON via **paste zone** (primary) and **file upload**.
- Validate shape against `StyleSnapExport`. On failure show a specific, friendly error; never
  crash on malformed input.
- Support **multiple imports in one session** — appending a second export (e.g. extension
  tokens after Figma tokens) adds to the same pool. Track origin via `meta.source`.

### 5.2 Token list
- Group by type: Color, Typography, Spacing, Border Radius, Border Width, Shadow.
- Per row: **value preview** (color swatch / type specimen / numeric chip / shadow preview),
  the `source` label, the assigned `name` (or "unnamed"), and a **duplicate badge** if flagged.
- Counts per group. Empty groups hidden.

### 5.3 Duplicate detection (rule-based, V1)
- **Color:** exact hex match = duplicate; near-match within a small ΔE / hex-distance threshold = "similar."
- **Numeric (spacing / radius / border-width):** equal values = duplicate; within ±1px = similar.
- **Typography:** same `fontFamily` + `fontSize` + `fontWeight` = duplicate.
- **Shadow:** all `ShadowValue` fields equal = duplicate.
- Detection is **suggestive, never destructive** — flags only; the user decides.

### 5.4 Merge
- Select a duplicate cluster → choose the surviving value → merge.
- Surviving token keeps one canonical value; `merged: true` is set; other ids collapse into it.
- Merge is **reversible before Create System** (undo / un-merge).

### 5.5 Naming
- Inline-editable `name` per token (e.g. `color/brand-primary`, `space/md`).
- Naming is optional but encouraged; unnamed tokens still export with a generated fallback name.

### 5.6 Create System & Export
- **Create System** finalizes: dedupe applied, names resolved, ordering stable.
- **`design.md` export** — the headline deliverable. Human-readable + AI-context-friendly
  (see §6).
- **JSON export** — cleaned `StyleSnapExport` (same schema, `merged`/`name` populated).
- Both download client-side; nothing leaves the browser.

## 6. The `design.md` export (key deliverable)

This is what makes StyleSnap worth using for vibe coders — a single file to paste into
Claude Code / Cursor as design-system context. Target shape:

```markdown
# Design System — <project name>
> Generated by StyleSnap · <date> · <n> tokens

## Colors
- `brand-primary` — #FF46AF (from Button/Primary)
- `surface-page`  — #0F1115

## Typography
- `heading-lg` — Inter 32px / 700 / 1.2
- `body`       — Inter 16px / 400 / 1.5

## Spacing
- `space-sm` 8px · `space-md` 16px · `space-lg` 24px

## Radius / Border / Shadow
- `radius-md` 10px
- `border-hairline` 1px
- `shadow-card` 0 2px 8px rgba(0,0,0,0.12)
```

Requirements:
- Grouped by token type, names as headings/keys, raw values inline, `source` as provenance.
- Deterministic ordering so re-exports diff cleanly.
- Plain Markdown — no tool-specific syntax, so it works in any AI coding context.

## 7. UX & design

- Follows the team [`DESIGN.md`](../DESIGN.md) (currently `<TODO>` — visual identity pending).
- **Vibe principles** (from master PRD): clarity over completeness, low-friction entry,
  confidence at every step.
- **Accessibility:** WCAG 2.1 AA, keyboard-navigable, AA contrast, touch targets ≥ 44×44px.
- **Empty state:** a single paste zone + one line — "Paste your StyleSnap JSON to begin."
- **Confidence pattern:** the user always previews exactly what Create System / Export will
  produce before committing; merges are reversible until finalized.

## 8. Tech & architecture

| Item | Choice |
|---|---|
| Frontend | React + Vite |
| Backend / DB | **None** — all state in-session |
| Data contract | [`docs/types.ts`](./types.ts) — imported, never redefined |
| Token types | color, typography, spacing, border-radius, border-width, shadow |
| Deployment | Vercel or Netlify (static) |
| Bridge | JSON copy/paste from plugin & extension (no live sync) |

## 9. Success metrics
- A user turns a raw export into an exported `design.md` in **< 10 minutes**.
- Zero manual token entry required — everything comes from imported JSON.
- Duplicate detection surfaces the obvious duplicates a user would otherwise merge by hand.

## 10. Risks
| Risk | Mitigation |
|---|---|
| Schema drift between the three codebases | `docs/types.ts` is locked; Webtool imports it directly |
| Rule-based dedup misses "visually same" colors | Tune threshold; mark as "similar" (suggest, don't force); AI matching is future work |
| In-session-only state loses work on refresh | Clear messaging; JSON export as the save mechanism; (optional) localStorage draft as stretch |
| `design.md` format not actually useful to AI tools | Validate by pasting a real export into Claude Code / Cursor during testing |

## 11. Open questions
- Project name for the `design.md` header — derive from `meta.figmaFile` / `meta.pageUrl`, or ask the user?
- Naming convention defaults (`color/brand-primary` vs `brand-primary`) — pick one for consistency with `design.md` output.
- Should a localStorage "draft" be a V1 stretch goal to survive accidental refresh?

---

*Webtool PRD v0.1 — scoped from the StyleSnap master PRD. Can be exported to .docx on request.*
