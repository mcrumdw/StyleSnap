# StyleSnap Web App — Build Plan for Claude Code

**Owner:** makram · **Created:** 2026-07-04 · **Target:** MVP per PRD v2.1 §13

Phases 0–7 = the MVP (shipped). Phases 8+ are post-MVP fixes driven by user
testing. One agent session per phase (Claude Code or Cursor — AGENTS.md rules
apply to both). Every phase ends with a passing acceptance check and a git
commit — never start a phase on top of uncommitted work.

**Recommended order for open phases: 10 → 9** (Phase 10 restructures
navigation; Phase 9's System-notes panel then lands in its final home, step 4).

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

## Phase 8 — Role-model inversion + System view (post-MVP fix)

**Why (found in user testing, 2026-07-04):** roles are stored as a single
`role` field per token (`decisions[tokenId].role` in `src/state/pool.ts`) —
a 1:1 relationship. That's backwards per DECISIONS.md §2.3: **roles point at
primitives**, and one primitive routinely carries several roles (the merged
green = `color/action/primary` AND `color/text/link`; ink = text AND border
AND shadow color). The current model cannot even reproduce the oracle, where
`color/ink` backs both `color/text/primary` and `color/surface/overlay`.
Additionally there is no view showing the main primitives with their semantic
uses.

**8a — Data model (do first, engine/state only):**

- Replace per-token `role` with one map in pool state:
  `assignments: Partial<Record<Role, string /* tokenId */>>`.
  Each role → exactly one primitive (map key uniqueness enforces it); a
  primitive may be referenced by any number of roles. `decisions` keeps only
  `name`.
- Migration on localStorage load: `decisions[id].role = r` →
  `assignments[r] = id`, then strip the old field. Old drafts must load
  without data loss.
- Merge interaction: when a merge absorbs token ids (or un-merge restores
  them), remap `assignments` values pointing at absorbed ids to the survivor
  (and back on undo). Add unit tests for both directions.
- `derive.ts` output becomes role-keyed: `Map<Role, Array<{tokenId,
  confidence}>>` — a token with hints for two roles suggests both.
- Completeness = required Appendix B keys missing from `assignments`.
- Export reads the map: primitives listed once; the roles table may reference
  the same primitive repeatedly. Deterministic sort unchanged (role order =
  Appendix B).

**8b — UI:**

- **RolePicker → additive.** "Assign role…" adds a chip; a token card shows
  ALL roles pointing at it; chips removable individually. If the chosen role
  is already assigned to another token, show "currently → `<name>` — 
  reassign?" (explicit confirm; never steal silently).
- **New System view** (nav tab next to the workspace) — the "main variables +
  their semantic use" screen, grouped by role subcategory:
  - **Colors first**, subsections in Appendix B order: **Text · Surface ·
    Action · Border · Feedback**. Each entry = swatch + primitive name + hex +
    the role it fills. A primitive appearing in several subsections shows the
    SAME name/swatch each time — visibly "one primitive, many uses," never a
    suspected duplicate.
  - A **Primitives strip** on top: every color primitive ordered by
    occurrences, with count of roles referencing it; role-less primitives
    visibly flagged ("unused — assign or drop").
  - Same pattern (lighter) for Type, Spacing, Radius, Shadow.
  - Unfilled required roles render as gap slots (dashed border, per DESIGN.md
    drag affordance) linking to the checklist.
- Workspace token cards: role chip becomes role chips (plural).

**Accept:**

- Merged green carries `color/action/primary` + `color/text/link`
  simultaneously; removing one leaves the other.
- Oracle reproduces exactly: `color/ink` referenced by `color/text/primary`
  AND `color/surface/overlay` from one primitive entry.
- Reassigning an occupied role asks for confirmation and updates both cards.
- Merge + un-merge with assigned roles keeps assignments pointing at the
  right survivor (unit-tested).
- Old localStorage drafts (pre-Phase-8) migrate losslessly.
- System view: every color subsection populated from fixtures; a role-less
  primitive is flagged; no console errors; export unchanged except now
  reflecting multi-role reality.

---

## Phase 8c — Edit/System UX restructure (post-Phase 8)

**Why (user testing, 2026-07-05):** Phase 8 fixed the data model
(`assignments: role → primitive`) but the Edit view still presented a flat
token grid — primitives vs semantics were indistinguishable. The checklist
rendered as a full-page scroll wall; Create System and Edit/System toggles
scrolled away; export forced a full design.md preview before confirming.

**Build:**

- **`SessionBar`** — sticky chrome below the wordmark: Edit ↔ System toggle,
  completeness pill (opens gap drawer), project name, Create System / Copy
  design.md + Export drawer.
- **`useSessionViewModel`** — shared derived state (checklist, exportInput,
  designMd, gapCount) so Home/SessionBar/Edit/System don't duplicate memos.
- **Edit sub-tabs:** Roles (semantic, `EditRolesPanel`) · Captured (primitive
  grid, de-emphasized cards) · All (power grid). Gap drawer actions deep-link
  to `#role-…` slots in Roles.
- **`GapDrawer`** — gaps only; met items collapsed; no inline checklist in
  main scroll.
- **`ExportDrawer`** + lightweight **`CreateSystemDialog`** — summary confirm,
  lazy JSON stringify; one-click Copy from SessionBar after create.
- Collapsed "Import another capture" section; keyboard `1`/`2` (Edit/System),
  `Esc` closes drawers.

**Accept:** Edit visibly separates roles from primitives; SessionBar always
visible; checklist never inline; Copy design.md works without scrolling;
System tab read-only mirror unchanged; oracle tests green; `docs/DEMO.md`
golden path updated.

---

## Phase 8d — Visual primitive picker (post-Phase 8c)

**Why (user testing, 2026-07-05):** `EditRolesPanel`'s `PrimitivePicker` used
a native `<select>` — browsers render options as text only, so gap rows like
`color/text/muted` showed a wall of indistinguishable auto-names
(`color/17a673 (#17A673)`) with no swatch. Users could not tell which color
they were assigning.

**Build (`src/components/EditRolesPanel.tsx`):**

- Replace `<select>` with a **custom popover** (same pattern as
  `RolePicker`): trigger button → anchored listbox, Esc / backdrop to close.
- **Per-row preview:** 24×24 color swatch (checkerboard when opacity < 1);
  type-aware thumbnails for spacing, radius, border-width, typography, shadow.
- **Row metadata:** user or fallback name + `formatValue()`; "· N captures"
  when duplicate values are collapsed to one list entry.
- **Dedupe by value** for colors (hex + opacity); prefer user-named token as
  the representative when picking.
- **Search** at top of popover (filter by name or value).
- **Suggested** section pinned at top when the engine has a top candidate.
- One-click suggestion path also shows a swatch beside the confirm chip.

**Accept:** Assigning a color role from a gap slot shows visible swatches for
every candidate; duplicate hex rows collapse to one entry with capture count;
non-color foundation roles show type-appropriate thumbnails; no engine or
export changes.

---

## Phase 9 — Descriptive layers in design.md (post-MVP fix)

**Why (user testing, 2026-07-04):** the export is token tables only. A real
`design.md` (see this repo's own DESIGN.md) also describes the design — mood,
component behavior, accessibility, voice. PRD §11 "Descriptive layers" is the
spec. Depends on Phase 8 (assignments map).

**9a — Computed sections (no user input needed):**

- **Accessibility:** for every assigned text-role/surface-role pair (from
  `assignments`), compute the WCAG contrast ratio (relative-luminance math —
  reuse/extend the culori utilities). Emit a table: pair · ratio · AA
  pass/fail (4.5:1 normal text). Failing pairs also appear in **Gaps** with a
  warning. Pure function in `src/engine/export/accessibility.ts` + unit tests
  (assert exact ratios for the fixture palette: ink/white 17.7:1, white on
  brand-blue 4.5:1, gray-500/white 5.0:1).
- **Component sketches:** for each `captureId` group containing ≥ 2 assigned
  tokens, emit one line: element descriptor + its role references ("`button.cta`
  → bg `color/action/primary` · radius `radius/sm` · hover →
  `color/action/primary-hover`"). Groups with unassigned tokens list them as
  raw values with a "(unassigned)" marker.

**9b — "System notes" panel (user-authored):**

- New collapsible panel with optional fields: **Mood / vibe** (textarea),
  **Component principles** (textarea), **Motion** (duration/easing + notes),
  **Voice & microcopy** (textarea), **Layout** (container/grid notes). Stored
  in pool state + localStorage, covered by the draft migration. **Placement
  (post-Phase 10): step 4 "Review & export", above the export actions.**
- Export renders each filled field as a section (fixed order, after
  Foundations, before Gaps). Every empty field adds a Gaps line ("No motion
  spec — define durations/easing before build"). Deterministic output.
- Cleaned-JSON export carries the notes under a `notes` key so re-import
  round-trips them.

**Accept:**

- Fixture flow: accessibility table appears with the exact ratios above;
  white-on-brand-blue shows "4.5:1 — passes AA with no margin".
- `cap-btn-1` produces the button sketch line referencing its roles.
- Filling only Mood: export contains the Mood section AND Gaps lines for the
  four empty fields; export is deterministic across repeated runs.
- Notes survive refresh (localStorage) and round-trip through cleaned JSON.
- Oracle test updated and green against the extended
  `docs/examples/design.example.md`.

---

## Phase 10 — From map to path: the 4-step flow (supersedes 8c chrome)

**Why (user testing, 2026-07-05):** after 8c the UI has two stacked tab
levels (Edit ↔ System, then Roles / Captured / All) plus two drawers and a
6-control SessionBar — ~10 destinations with no indicated order. The product
is a **pipeline** (PRD §6: import → merge → roles → gaps → export) but the UI
presents a **map**. The Maya persona (student-level design-system knowledge)
doesn't know where to go next; the vocabulary ("captured primitives") assumes
expertise. **8c's plumbing survives** (useSessionViewModel, deep links,
dialogs, 8d's PrimitivePicker); only its navigation chrome is replaced.

**Build:**

- **One stepper, four steps** — numbered, always visible, freely navigable
  (never locked), keyboard `1`–`4`:
  1. **Clean up** — the captured grid + merge flow (old Captured tab). The
     "All" tab dies; add a "Show everything" filter toggle here (manual +
     merged-away tokens).
  2. **Give meaning** — `EditRolesPanel` (old Roles tab), 8d picker intact.
  3. **Fill gaps** — `GapDrawer` content rendered **inline as the step body**
     (met items collapsed), not an overlay. Gap actions deep-link to step 2
     slots / Add-token dialog exactly as today.
  4. **Review & export** — `SystemView` summary on top; `ExportDrawer`
     content inline below (single export home); Create System gate + Copy
     design.md as the step's actions. (Phase 9's System-notes panel lands
     here.)
- **StepBar replaces SessionBar:** step indicator with per-step progress
  (1: open DUP/SIM clusters · 2: required roles assigned · 3: open gaps ·
  4: created ✓), project name, and **one context-aware primary CTA**:
  "Next: give your colors meaning" → "Next: fill the gaps" → "Review &
  export" → "Copy design.md". The completeness pill folds into step 3's
  indicator.
- **Vocabulary pass (user-facing labels only):** steps named as above;
  jargon ("primitive", "semantic role") moves to tooltips/captions that
  *teach* ("a primitive is a raw value — roles say what it's for"). Engine
  and export terminology unchanged.
- **Celebrate transitions** per DESIGN.md §9 voice ("Nice — 4 blues just
  became 1. Next: give them meaning.").
- Keep: Esc behavior, focus traps, toasts, collapsed "Import another
  capture", localStorage (persist current step too). Update `docs/DEMO.md`
  to the step flow.
- **Export guardrail (UX_RESEARCH.md P2):** the copy/export CTA reflects
  quality state; exporting with unmerged clusters / unassigned required roles
  shows a one-time interstitial ("12 unnamed · 4 clusters · 5 gaps — export
  anyway, or fix the big ones?"). Never blocks — informs once.
- **Resume orientation (P9):** on draft restore, land on the furthest
  incomplete step + toast ("Welcome back — 3 gaps left").
- **Stepper a11y (P11):** roving tabindex + arrow keys on the step control.

**Explicitly removed:** Edit ↔ System toggle · Roles/Captured/All sub-tabs ·
GapDrawer and ExportDrawer as overlays (content reused inline) · "Copy
design.md" + "Export…" + "Create System" as three separate always-visible
buttons.

**Accept:**

- A first-time tester (no instructions) goes paste → export touching only
  steps 1→4; the only overlays they meet are merge/add-token dialogs.
- Exactly one primary CTA visible at any time; pressing it repeatedly walks
  the whole pipeline to a copied design.md.
- Step indicators live-update (merging a cluster decrements step 1's count;
  assigning a role updates step 2's).
- Gap deep links land correctly in the new structure; 8d picker untouched.
- No engine/state changes beyond view-model + persisted step; all tests and
  the oracle stay green; keyboard-only run-through works with visible focus.
- `docs/DEMO.md` rewritten for the step flow; golden path still < 10 min.

---

## Phase 11 — Friction fixes from the usability study (after 10 & 9)

Source: `docs/UX_RESEARCH.md` §4 (validate with real users first — §6).

- **P3 Batch suggestions:** "Accept N high-confidence suggestions" — one
  review list, one confirm (human-in-the-loop preserved; nothing silent).
- **P4 Commitment relief:** Create System reframed ("you can reopen until
  export"); **Reopen for editing** action; **Undo** directly in merge toasts.
- **P5 Scale builders:** deterministic quick actions — "generate spacing
  scale from base step", "derive hover shade from base color" (proposals,
  user confirms; AI variants stay V2).
- **P6 Ignore token:** reversible dismiss on captured tokens; hidden behind
  the show-everything filter; excluded from exports.
- Quick fixes bundled: two-layer error copy + "get the extension/plugin"
  link (P10); completeness-pill first-run hint (P13).

**Accept:** S2 speed-run reaches a *decent* export in < 4 min via guardrail +
batch accept; S5 thin-capture completion drops from ~70 to ~30 clicks; junk
tokens excluded from export; all prior tests green.

---

## Backlog (do NOT pull into MVP)

AI assist (FR-20), Figma Variables export, W3C token output format, component
reconstruction, accounts, per-source cluster breakdown + persistent filters
(P7), custom role names within standard categories (P8 — decide with team).
De-scope order if behind: PRD §13.

## Definition of done (MVP)

All phase acceptance checks green · engine unit tests pass in CI ·
`design.example.md` oracle test passes · demo script executable end-to-end on
the deployed URL.
