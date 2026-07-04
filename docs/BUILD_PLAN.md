# StyleSnap Web App — Build Plan for Claude Code

**Owner:** makram · **Created:** 2026-07-04 · **Target:** MVP per PRD v2.1 §13

Seven phases, each one Claude Code session. Every phase ends with a passing
acceptance check and a git commit — never start a phase on top of uncommitted
work.

## How to run each session

1. Start fresh (`/clear`), state the phase: *"Execute Phase N of
   docs/BUILD_PLAN.md."* CLAUDE.md loads the context automatically.
2. Let it plan first (plan mode), sanity-check the plan against the PRD
   sections listed for the phase, then execute.
3. Before accepting: run the phase's acceptance check yourself.
4. Commit with `phase-N: <summary>`. Small fix-ups within the phase are fine;
   new scope is not — put it in the backlog section below.

---

## Phase 0 — Scaffold & design foundation

**Build:** Vite + React + TS(strict) + Tailwind project in repo root. All
DESIGN.md values as custom tokens in `tailwind.config` (colors incl. `-text`
variants, radius 8/14/24, hard shadows, fonts via Google Fonts link, 13px
caption, button heights, z-index scale). Copy `docs/types.ts` +
`docs/schema.ts` into `src/contract/` (keep docs/ copies canonical). Install
zod, culori, vitest. Build a `/kitchen-sink` dev route rendering: all 4 button
variants with press effect, card, input, badges (DUP/SIM/MERGED), role chip,
empty state.

**Accept:** app runs; kitchen sink visually matches DESIGN.md §5/§5.1 (hard
offset shadows, 2px borders, Space Grotesk headings); `tsc --noEmit` passes
(schema sync assertions compile).

## Phase 1 — Import & persistence

**PRD:** §7.1 (FR-1–4), FR-28/29. **Build:** paste zone (primary) + file
upload + drag-drop per DESIGN.md §5; `parseStyleSnapExport()` wired; friendly
error banner with per-issue details; version-mismatch warning; multiple
imports append into one pool (provenance preserved); pool auto-saves to
localStorage and restores on load; "Start over" clears it.

**Accept:** both good fixtures import (31 + 9 tokens, sources shown);
malformed fixture → friendly error listing its 4 issues; refresh mid-session
loses nothing.

## Phase 2 — Token workspace (read-only)

**PRD:** §7.2 (FR-5–8). **Build:** groups by type with counts (empty groups
hidden); token cards per DESIGN.md §5.1 (swatch/specimen/chip/gradient/shadow
previews, name-or-unnamed, source, occurrences); search + filters (type,
source, named/unnamed, flagged); captureId "same element" grouping filter.
Loading/empty states per DESIGN.md §6.

**Accept:** both fixtures render correctly grouped; the #101828 color at
opacity 0.5 (Figma scrim) displays distinctly from opacity 1; filter combos
work.

## Phase 3 — Dedup engine + merge (the core)

**PRD:** §7.3–7.4, Appendix A — implement exactly as specified. **Build:**
`src/engine/dedup/` pure functions first: leader clustering, per-type
distances (culori OKLab, numeric gap clustering w/ 4px snap, typography
composite key incl. lineHeight, shadow/gradient epsilons, opacity ε 0.01).
**Unit tests before UI**, driven by the fixtures:

- blues → one cluster, canonical #2E6BFF, #2456CC (hover) NOT in it
- 15px joins 16px as similar; 4 and 8 never cluster
- body 1.5 vs 1.45 lineHeight → similar, not duplicate
- uppercase label never clusters with caption
- ext_006/ext_007 (#101828 ×2) → exact duplicates
- deterministic: same input → identical cluster output

Then UI: DUP/SIM badges, merge dialog per DESIGN.md §5.1, survivor inherits
occurrences + contexts (`mergedFrom`), un-merge until Create System,
sensitivity slider (×0.5/×1/×1.5, re-flags live, never re-merges).

**Accept:** all engine tests green; merging the blues shows "Nice — 4 blues
just became 1."-style toast; undo restores exactly.

## Phase 4 — Roles & naming

**PRD:** §7.5 (FR-14–17), §7.7, Appendix B. **Build:** taxonomy as data
(`src/engine/roles/taxonomy.ts` — the B.1–B.3 lists incl. required flags);
derivation from context per B.4 (authoredName wins; parse Figma-style names
directly); role chips (dashed = unconfirmed, solid = confirmed); role picker
(dropdown from taxonomy, searchable); inline name editing with slash-name
validation; generated fallback names for export.

**Accept:** Figma fixture's `authoredName`s auto-suggest correct roles;
browser fixture derives `color/surface/page` for #F9FAFB (body bg),
action/primary for the button blue, hover role for #2456CC; user can override
everything; nothing finalizes without confirmation.

## Phase 5 — Completeness & manual gap-fill

**PRD:** §7.6 (FR-18–19), Appendix B.5. **Build:** checklist panel computing
the ✅ requirements against current state, each unmet item an actionable gap;
manual add/edit token forms (color picker, type fields, numeric); assign
spacing/radius/shadow slots. Skip AI assist (FR-20 = V2).

**Accept:** after Phase 4 state, checklist flags exactly the gaps listed in
`design.example.md` §Gaps; adding a focus color clears its gap live.

## Phase 6 — Create System & exports

**PRD:** §7.8 (FR-23–27), §11. **Build:** Create System gate (preview →
finalize → locks merges); `design.md` generator in `src/engine/export/` as a
pure function; cleaned-JSON export (`StyleSnapExport`, merged/name populated —
must re-validate against `schema.ts`); copy-to-clipboard + file download;
remaining gaps flagged in both exports; deterministic ordering.

**Accept (the oracle test):** import both fixtures → apply the merges/roles/
names from `docs/examples/design.example.md` → export. Output matches the
oracle's structure and resolutions (unit test on section order + token set;
manual diff for prose). Export twice → byte-identical. Cleaned JSON round-trips
through `parseStyleSnapExport()`.

## Phase 7 — Polish, a11y, demo

**Build:** keyboard focus ring everywhere (§11), `prefers-reduced-motion`,
error-state audit (no dead ends), microcopy per DESIGN.md §9, empty states,
favicon/wordmark. Write `docs/DEMO.md`: the golden-path script (paste messy
fixture → 4 blues → merge → roles → export → paste design.md into Claude Code
live). Deploy to Vercel.

**Accept:** full golden path in < 10 min by someone who isn't you; keyboard-
only run-through works; deployed URL works.

---

## Backlog (do NOT pull into MVP)

AI assist (FR-20), Figma Variables export, W3C token output format, component
reconstruction, accounts. De-scope order if behind: PRD §13.

## Definition of done (MVP)

All phase acceptance checks green · engine unit tests pass in CI ·
`design.example.md` oracle test passes · demo script executable end-to-end on
the deployed URL.
