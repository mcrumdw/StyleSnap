# StyleSnap — Decision Log

A running record of the design and architecture decisions behind the StyleSnap
ecosystem, so that documentation, onboarding, and future changes stay grounded
in *why* things are the way they are.

Last updated: 2026-07-19

Tags in §6 change history (and on new §2.x when useful):

- **`[Bug fix]`** — corrects broken or incorrect behavior
- **`[New feature]`** — adds capability that did not exist
- **`[Change]`** — intentional UX/behavior change (not a bug, not wholly new)

---

## 1. System overview

StyleSnap helps a UX/UI designer build a **design system** for the product they
are working on — either from inspiration gathered on the web or from hands-on
work in Figma. It has three surfaces:

- **Browser extension** — the designer browses the web, and adds pages/elements
  they like into StyleSnap. Selections are captured as tokens.
- **Figma plugin** — captures tokens from a Figma file (layers, and ideally
  Variables/Styles).
- **Webtool (main web app)** — receives the captured tokens (as JSON), merges
  them, and assembles a coherent design system. Where the system is incomplete,
  it is completed manually or with AI assistance.

**Outputs of the Webtool:**
- `design.md` — a source-of-truth file that can be uploaded to an AI coding
  model to apply the design consistently.
- Direct export to **Figma** as Variables and Styles.

---

## 2. Architecture decisions

### 2.1 One shared `types.ts` as the single source of truth
All three codebases (extension, Figma plugin, Webtool) import the same token
type definitions from `docs/types.ts`. This keeps the contract identical
everywhere and makes the JSON hand-off between surfaces type-safe.

### 2.2 The JSON hand-off is a *raw capture / transport* format only
`types.ts` models **primitive values + capture context** — nothing more.
It deliberately does **not** model semantic roles, scales, or components.

**Why:** mixing "what we scraped" with "what we decided it means" in one schema
makes both jobs harder. The capture format should stay lossless and simple; the
*interpretation* (roles, scales, components) is a separate, richer model the
Webtool builds on top.

### 2.3 Two-tier token model (primitive → semantic)
A real design system has two token tiers:
- **Primitives** — raw named values (`blue-500: #3B82F6`).
- **Semantic tokens** — roles that point at primitives
  (`color.action.primary → blue-500`).

The transport JSON carries **primitives only**. Semantic roles are assigned in
the Webtool during assembly. The `design.md` and Figma Variables exports lead
with **semantic** tokens, because that is what makes the output usable by an AI
model and what maps cleanly to Figma Variables.

### 2.4 Capture semantic *context*, then derive roles — don't just predict
Much of a token's semantic role is **readable at capture time** rather than
guessed later. The schema stores a best-effort `context` object so the Webtool
can derive roles deterministically, falling back to AI prediction only when
context is missing. Signals, strongest first:

- **Author's own name** (`authoredName`): CSS custom properties
  (`--color-primary`), utility classes (`bg-blue-500`), or Figma
  Variable/Style names (`color/action/primary`). This is the real design-token
  name and requires no prediction.
- **CSS property** (`cssProperty`): `background-color` → surface, `color` →
  text, `border-color` → border.
- **DOM semantics** (`element`, `ariaRole`): a color on `<button>` → action; on
  `<h1>` → heading text; on `[role="alert"]` → feedback.
- **State** (`state`): `:hover`/`:focus`/`:disabled` rules → component states.

**Caveat:** context is best-effort. Hashed class names, inline styles, and
obfuscated markup mean it is sometimes absent — treat it as confidence-weighted
hints, not guarantees.

### 2.5 Runtime validation — a zod twin of `types.ts` (`docs/schema.ts`)
TypeScript types are erased at compile time, so `types.ts` cannot validate the
JSON a user pastes into the Webtool at runtime (PRD FR-2). The Webtool
validates every import with a zod schema, `docs/schema.ts`, that structurally
mirrors `types.ts` v2.0.

- **`types.ts` remains the canonical contract** all three codebases read; the
  zod schema is its runtime twin, used only by the Webtool's import step.
- **Drift protection:** compile-time assertions at the bottom of `schema.ts`
  make `tsc` fail if the schema and `types.ts` ever diverge structurally.
  Any future schema change (v2.x) must touch both files in the same commit.
- **Envelope only:** the schema checks structure (field types, 6-digit hex,
  0–1 opacity, known token types) — it deliberately does **not** judge design
  quality. Raw, messy, unconsolidated captures are valid by design (§2.2);
  consolidation is the Webtool's job, after import.
- **Value constraints live only in the schema** (hex format, ranges, "2+
  gradient stops") because the type system can't express them — that is the
  schema's added value, not drift.
- `schema.ts` also exports `parseStyleSnapExport()`, the single paste-zone
  entry point: never throws, returns the typed export or a friendly error
  (FR-2) plus an FR-4 version warning on `meta.version` mismatch.

### 2.6 Contract distribution — copy the file, `version` catches drift
Decided 2026-07-04. The three codebases live in separate repos, so "all import
the same `types.ts`" needs a mechanism. **This repo's `docs/types.ts` is
canonical; Theresa (Figma plugin) and Murtaza (extension) copy it into their
repos verbatim** — no submodule, no npm package (overkill for this project).
Safety net: producers stamp `meta.version` from their copy, and the Webtool
warns on mismatch (FR-4, `parseStyleSnapExport`). Rule: **any change to
`types.ts` happens in this repo first** (with a version bump and a row in §3),
then gets re-copied; never edit a downstream copy directly.

### 2.7 Derivation-first completion ("the puzzle principle")
Decided 2026-07-05 (team feedback: app still felt complicated; completion was
a form-filling chore). The Webtool **auto-drafts every derivable gap
deterministically** from three anchors (primary color, body typography, base
spacing): interaction states and neutrals by OKLCH lightness/chroma math,
feedback colors as conventional hues wearing the brand's chroma (AA-enforced),
accents suggested via color-wheel harmonies (split-complementary default,
suitability rule in PRD Appendix C), type via modular scale, spacing/radius/
shadow via ramps. The user reviews a **complete draft** and edits only
intentionally.

Guardrails that keep this compatible with §2.2/§8 ("suggestive, never
destructive"): derived values are visibly badged + provenance-marked in every
export; captured values always beat derived for a role; re-derivation never
overwrites a human edit (dirty flags); accents are suggestion cards, never
auto-assigned. This is math, not AI — deterministic and testable; AI variants
remain V2 (FR-20).

### 2.8 Session undo/redo — decision-level history
Decided 2026-07-10 (UX_RESEARCH F10/F11; user testing on color edits). The
Webtool keeps a **session-only undo stack** (`src/state/history.ts`) over the
`TokenPool` — **not** persisted to localStorage (FR-29 still saves only the
current state; refresh restores the draft but clears undo history, same as
Figma/Docs).

**Undoable (one step per committed action):** derived-value edits (`derivedEdits`,
including "Reset to derived"), anchor overrides (primary color / body type /
base spacing), merges and un-merges.

**Not undoable:** imports (append-only + auto-merge — use Start over), navigation/
filters, project-name typing, role assignment (Phase B backlog).

**Limits & UX:** cap **50 steps**; standard undo + redo stacks (new action clears
redo); `⌘Z` / `⌘⇧Z` when not in a text field; Undo/Redo controls appear only
when available (§2.20 — desktop top-right, mobile bottom corners); toasts on
color save and merge offer a one-click Undo that calls the same stack. **Reset
to derived** stays as a semantic shortcut.

**Create System gate:** after finalize (FR-23), merge-related history entries are
skipped on undo/redo — color and anchor edits remain reversible until export.
Aligns with FR-13 (merges lock at Create System) without trapping users in a
bad hex.

### 2.9 Note completion via adjective-matched templates (FR-19b)
Decided 2026-07-10. System notes (mood, component principles, motion, voice,
layout) are **never-capturable** — leaving them as optional Gaps produced
low-quality exports (UX_RESEARCH S2/S3). **design.md** (Share with agent) is
blocked until all five note fields are filled; **cleaned JSON** (Share with
Figma) ships anytime — see §2.21. Copy/download design.md passes through a
completeness gate in `SessionProvider`.

**How it works (deterministic V1 — no AI):**
- User picks up to **five adjectives** from a fixed vocabulary (19 terms), or
  taps **Pick for me** (`autoAdjectives` — heuristics over anchor chroma, hue,
  radius, shadows; returns five stable picks per fixture).
- **Sixty field snippets** (12 per field × 5 fields) in
  `src/engine/templates/` — one mood snippet is scored first; other fields
  mix-and-match with a **family boost** (+0.25 when the snippet shares the
  mood winner's family). `assembleDescription` fills **only empty** note
  fields (`fillNotes` / `refreshNotesFromAssembly`).
- User-typed text always wins; each field records provenance (`noteSources`:
  `"user"` or a snippet id like `motion/luxury`). UI shows a **subtle per-field
  badge** (family label only — no global “best match” preview). Export
  confesses starter-filled prose (`*(from the "…" starter — edit to taste)*`).
  Legacy monolithic template ids migrate on draft load. AI-drafted descriptions
  remain V2 (FR-20).

**Rejected:** blocking export on unfilled *roles* — roles are auto-derived in
the Phase 10 draft; only the five note fields gate **design.md** export
(§2.21 — Figma / cleaned JSON is never gated).

### 2.10 Route-based session shell (post–Phase 10d)
Decided 2026-07-10. The single scrolling Home page (import + full draft +
captured grid + notes + export) was split into a **Figr-style route shell**:
left rail (`Overview` · `Describe` · `Export` + per-category token pages at
`/tokens/:category`), one concern per page, sticky bottom CTA (`BottomBar`).
`SessionProvider` hoists pool + view-model + export gate for the whole shell.
Reduces the "10-destination map" problem from UX_RESEARCH without reintroducing
the 4-step stepper (dropped in Phase 10d).

### 2.13 Responsive session shell + single chrome bar
Decided 2026-07-12. **No duplicate header on session routes:** the global
sticky header (logo only) appears on the landing page only; inside the shell,
the wordmark lives in `SessionNav` (top on mobile, left rail on desktop). Export
and undo/redo placement per **§2.20**; footer holds Create System only.

**Breakpoints (Tailwind defaults):** `sm` 640px · `md` 768px · `lg` 1024px.
- **&lt; lg:** see **§2.20** (logo + Share header, swipeable `NavTitleWheel`).
- **≥ lg:** vertical left rail + rail-bottom share links; undo/redo top-right
  when active (§2.20).

**Readable on small screens:** page titles scale `section-header` →
`page-title` at `sm`; content padding `px-4` → `px-6`; anchor cards and gap
rows stack; completion dialog is bottom-sheet style on phone (`items-end`),
centered modal on `sm+`; safe-area inset on footer.

### 2.14 Category-first user control (Phase 11)
Decided 2026-07-12 (user testing — tokens felt locked after §2.12). Editing
surfaces live on **category pages**, not by restoring Overview/Captured nav.

**Phase 1 (shipped):** click any filled role row on `/tokens/*` →
`RoleValueEditor` popover. Derived colors, spacing, radius, border-width, and
derived type sizes are editable; edits go to `derivedEdits` with undo toast.
Captured assignments are **reassign-only** (popover explains — no direct hex
edit on capture primitives for now). `auto` / edited-dot badges on rows.

**Locked product choices (later phases):**
- **Captured values:** reassign-only until a dedicated override path is designed.
- **Manual shadow add (Phase 3):** three kinds — outer drop, inner inset,
  background blur — prefilled from existing capture shadows when present.
- **Merge repair:** full **unmerge on demand** only (no import-time review
  modal); entry point TBD in Phase 4.

**Still unwired:** type-ratio picker, per-category Add token button, rename/unmerge
(Phases 2–4). Accent harmony is wired on the Secondary anchor card (§2.16).

### 2.15 Anchor cards split by category
Decided 2026-07-12. **Colors** shows **Primary** + **Secondary** color anchors
(`AnchorsStep`); secondary auto-detects a distinct second hue when present, else
falls back to harmony-derived `color/action/secondary`. **Typography** shows
text-style anchor (`TypeAnchorStep`). **Base unit** anchor UI removed — spacing
still auto-detects from capture.

### 2.16 Secondary harmony swap + color-family UX (Colors page)
Decided 2026-07-12 (user testing on Ember fixture — Secondary **Swap** exposed
only ~2 captured swatches; anchor cards and color-family preview felt noisy).
Builds on §2.7 (C.5 accent harmonies), §2.14 (derived-value edits), and §2.15
(primary + secondary anchors).

**Problem:** Listing captured colors as the only Secondary swap options fails when
a capture has one dominant hue plus one alert/error accent — users need **color
theory** to explore a real secondary CTA, not a second raw scrape.

**Secondary Swap (shipped):**
- **Harmony picker** always offers three theory options derived from the current
  primary via `harmonyFromPrimary()` (`complementary`, `split-complementary`,
  `analogous`) — independent of whether `deriveAccent()` returns null (second
  hue already in capture). Suggested harmony follows PRD Appendix C.5 suitability
  (high chroma → analogous; low → complementary; else split-complementary).
- **Fine-tune row:** native color picker + hex field + **Apply** writes
  `derivedEdits["color/action/secondary"]` (same C.8 precedence as
  `RoleValueEditor`); **Reset** drops the edit. Picking a new harmony clears
  the secondary derived edit and any `secondaryColorId` override.
- **From your capture:** when auto-detection finds a distinct second hue
  (`anchors.secondaryColorId`), that token appears as an optional one-click
  revert; choosing it clears `accentChoice.harmony` and secondary derived edits.

**Derivation precedence (updated):**
1. User edit — `derivedEdits["color/action/secondary"]` (view-model overlay).
2. Explicit harmony — `pool.accentChoice.harmony` → synthetic
   `color/action/secondary` from `harmonyFromPrimary(primary)` (AA-tuned).
3. Captured secondary anchor — auto-detected or user-picked capture token.
4. Default harmony suggestion — same synthetic path as (2) with suggested harmony.

`setAccentChoice({ harmony })` and `setAnchorOverride({ secondaryColorId })`
each clear the other's mode plus secondary derived edits so the two paths never
stack silently.

**Color family preview (shipped):**
- Six swatches (Primary, Hover, Secondary, Text, Surface, Success) stretch
  **full width** (`flex-1` per column) instead of fixed 32×32 clusters.
- Static explanatory paragraphs under anchor cards and under the preview are
  **removed**; copy moves to native `title` tooltips on hover targets (swatch,
  anchor name, name·hex line, per-swatch labels). Keeps cards compact; detail on
  demand.

**Still unwired from the old Overview accent card:** accent **Dismiss** and the
standalone mono-hue banner — harmony UX now lives inside the Secondary anchor
card only. Type-ratio picker remains Phase 2 (§2.14).

**Timeline / phase notes:**
| When | Milestone |
|---|---|
| 2026-07-12 §2.15 | Primary + Secondary anchor cards on Colors; secondary auto-detect. |
| 2026-07-12 §2.16 | Harmony swap + fine-tune + capture revert; engine precedence; full-width preview; tooltip copy. |
| Phase 2 (§2.14 backlog) | Type-ratio picker on Typography; any remaining accent UI cleanup. |

**Key files:** `src/components/AnchorsStep.tsx`,
`src/engine/derive-system/color.ts` (`harmonyFromPrimary`),
`src/engine/derive-system/index.ts` (secondary fill precedence),
`src/state/pool.ts` (`setAccentChoice`, `setAnchorOverride` cross-clear),
`src/routes/TokenCategory.tsx` (wires `setAccent`, `editDerivedValue`).

### 2.17 Description-first style bias (adjective → derivation)
Decided 2026-07-12 (branch `makram2`). Extends §2.9 (adjective snippets) into
§2.7 (derivation) without replacing capture anchors.

**Intent:** The mood **family** from adjective picks (same winner as snippet
matching) biases **derived** tokens — not captured primitives. User edits
(`derivedEdits`, C.8) and captured assignments are untouched.

**Style profile per family** (`src/engine/style-profile.ts`):
- `typeRatio` — modular scale (C.6)
- `harmony` — secondary color when no captured secondary anchor (C.5)
- `radiusScale` — multiplier on derived radius ramp slots only
- `shadowStyle` — `soft` | `hard` | `minimal` when no captured shadows

Applied in `applyNoteTemplate` / `applyStyleProfile` alongside note snippets.
Harmony updates on refresh only when not dismissed and harmony was unset (avoids
wiping secondary picks on every live adjective toggle). `pool.styleFamily`
persists in the draft.

**Flow:** Import → **Description** (`/describe`) first when no adjectives yet;
**Continue to colors** → `/tokens/colors`. Returning users with adjectives land
on Colors. Description stays in nav for later edits.

**Rejected for V1:** Regenerating primary/neutral hex math from adjectives;
per-adjective token mapping (use family only); blocking Colors until all note
fields are filled (export gate unchanged).

**Key files:** `src/engine/style-profile.ts`, `src/state/pool.ts`
(`applyStyleProfile`, `styleFamily`), `src/routes/Home.tsx`, `src/routes/Describe.tsx`,
`src/engine/derive-system/index.ts` + `ramps.ts`.

### 2.18 Production deploy — single path (GitHub Actions)
Decided 2026-07-12. **Problem:** After PR #16 merged `makram2` to `main`, GitHub
Actions built the correct bundle (`index-BqW_PkrE.js`, 414 KB) and aliased
`stylesnap-lac.vercel.app`, but production kept serving the pre-makram2 bundle
(`index-6MiPuC3G.js`, 394 KB) — missing `/describe`, style bias, and description-first
flow. Forensics: PR #15's prebuilt deploy uploaded only 4 KB; production
`last-modified` shifted ~1 min after the good deploy, consistent with a second
deploy path overwriting the alias.

**Decision:** GitHub Actions (`.github/workflows/deploy.yml`) is the **only**
production deploy path. Vercel dashboard Git auto-deploy for production must be
**disabled** (Settings → Git → uncheck automatic production deployments, or
disconnect Git deploy entirely). Preview deploys from branches may stay on.

**Guardrail (shipped):** deploy workflow verifies production HTML is not the
stale `index-6MiPuC3G.js` hash and that the served JS contains the makram2
marker string `Continue to colors`. Fails the job if alias drift recurs.

**Manual recovery:** Actions → "Deploy to Vercel" → Run workflow (`workflow_dispatch`
on `main`), or promote the latest successful Actions deployment in the Vercel
dashboard.

### 2.19 Effects page + human-readable role previews
Decided 2026-07-12 (user testing — raw shadow strings like `0 12 24 -4 #292524 @ 8%`
were opaque; tiny thumbs on spacing/radius/border rows were unclear).

**Nav rename:** session tab **Shadows** → **Effects** (`/tokens/effects`). Role ids
stay `shadow/*` (Appendix B taxonomy unchanged). `/tokens/shadows` redirects. Page
copy acknowledges future capture types (backdrop blur, etc.) — `types.ts` v2.0 still
only models `shadow` today; blur remains Phase 3 manual-add per §2.14.

**Role row layout:** filled semantic rows use `RoleTokenPreview` — a fixed preview
panel (card casting real `box-shadow`, spaced blocks, rounded square, border frame)
plus `humanValueLabel()` plain-language subtitle. Raw `formatValue()` stays in
search/export; hover `title` on the panel for experts.

**Captured design only (important):** preview strips decorate with **assigned roles
from the current draft** (`buildPreviewContext()` in `token-display.ts`) — e.g.
`color/surface/card` for tile fills, `color/surface/page` for strip backdrops,
`color/action/primary` for spacing bars, `color/border/default` for border-width
frames, `radius/md` for incidental corner rounding on non-radius rows. They must
**never** use StyleSnap app chrome (`shadow-card`, `bg-surface-card`,
`bg-brand-primary`, `text-text-primary`, etc.) — that would show the tool's UI
skin instead of the imported capture. When a decorating role is still empty,
neutral preview-only fallbacks apply (not DESIGN.md tokens). The **row chrome**
(outer card border, nav) stays app-styled; only the left preview strip is
capture-faithful. Strips are **flush to the row's left edge** with no separate
`rounded-l-*` — the row's `overflow-hidden rounded-md` clips corners so captured
backdrop fills the arc (no white wedges).

**Key files:** `src/components/RoleTokenPreview.tsx`, `src/state/token-display.ts`,
`src/components/RoleValueEditor.tsx` (`RoleFilledRow`).

### 2.20 Share destinations + mobile session chrome (third shell pass)
Decided 2026-07-12 (mobile nav consumed ~half the viewport; export actions were
scattered across the footer).

**Share (replaces footer Copy / Download / Save JSON):**
- **Share with agent** — `design.md` for AI coding tools (Copy or Download modal).
- **Share with Figma** — cleaned token JSON for the Figma plugin / Tokens Studio
  (native Variables export remains V3 per PRD).
- **Desktop:** both links at the bottom of the left rail (`ShareNavSection`).
- **Mobile:** single **Share** button (header right) → picker → same modals.
- Completeness gate (§2.9) applies to **design.md only** — Figma JSON is
  never blocked (§2.21).

**Footer:** removed (§2.21). No session-wide completeness strip; agent-export
hints live on Share with agent only.

**Undo/redo (supersedes §2.8 bottom-bar placement):** controls **hidden until
active** (`canUndo` / `canRedo`). Desktop: top-right (`UndoRedoToolbar`). Mobile:
floating **Undo** bottom-left, **Redo** bottom-right (`FloatingUndoRedo`). Keyboard
shortcuts unchanged.

**Mobile nav (&lt; lg):** sticky two-row header — (1) wordmark left, Share right;
(2) **`NavTitleWheel`** — horizontal scroll-snap carousel; active section title
stays centered; swipe changes route. Replaces the interim stacked tabs + stacked
share rows.

**Role-row display fix:** `buildRoleDisplayTokens()` ensures `derivedEdits` appear
on filled rows immediately after save (pool + UI stay in sync; undo shows after
edit, not redo).

**Key files:** `ShareMenuButton.tsx`, `ShareExportModal.tsx`, `NavTitleWheel.tsx`,
`FloatingUndoRedo.tsx`, `SessionNav.tsx`, `useSessionViewModel.ts`.

### 2.21 Agent-only export gate (design.md vs Figma)
Decided 2026-07-13 (UX review — session footer said "Complete description
before sharing" while users edited tokens; the requirement was unclear and
applied to both share destinations equally).

**Problem:** System notes (mood, principles, motion, voice, layout) exist so
**design.md** gives an AI agent context tokens cannot capture. Blocking *all*
export — including cleaned JSON for Figma — and showing a global footer warning
on every token page made the gate feel like a workflow step users had to finish
before reviewing colors.

**Decision — split export gates:**
- **Share with agent** (`design.md` copy/download): blocked until all five
  system-note fields are filled (`agentExportReady` = `notesComplete`). Attempt
  opens the finish-notes dialog (`SessionProvider`) with progress (`X/5`),
  missing field names, inline `AdjectivePicker` ("Fill & continue"), and
  **Go to system notes** → `/describe`.
- **Share with Figma** (cleaned token JSON): **never gated** — no modal, no
  warning, no disabled state. JSON is the save file; tokens are useful without
  prose.
- **Checklist / role gaps** (`GapPanel`, `checklist.complete`): informational
  only — never block either export path.

**UI changes:**
- **Removed `BottomBar`** — no session-wide "complete description" footer.
- **Share with agent** shows optional `X/5` badge in rail + mobile picker when
  notes incomplete; **Share with Figma** has no badge.
- **`ShareExportModal`:** warning copy only on the design-md kind.
- **`ExportSection`:** gate copy/download on the design.md tab only.
- Copy on `/describe` and `SystemNotesPanel`: notes required for design.md,
  optional for Figma.

**Rejected:** global footer nag; gating Figma JSON; conflating token checklist
gaps with the design.md notes requirement.

**Key files:** `src/state/agentExportBlockers.ts`, `SessionProvider.tsx`
(`withAgentExportReady`), `useSessionViewModel.ts` (`agentExportReady`),
`ShareExportModal.tsx`, `ShareNavSection.tsx`, `ShareMenuButton.tsx`,
`ExportSection.tsx`.

### 2.22 Feedback color harvest + derivation (C.4 three-tier)
Decided 2026-07-13. Semantic feedback colors (`color/feedback/*`) are required
for a complete system (PRD B.5) but rarely appear in full in browser captures.
The original C.4 rule derived all four from the primary anchor using
**conventional OKLCH hues** (error 25°, warning 70°, success 150°, info 250°)
with the brand's chroma (`max(0.08, min(brand C, 0.18))`) and AA tuning — not
fixed hexes, but **primary hue was ignored**, so two vivid brands could share
identical warning colors.

**Three-tier precedence (per role):**
1. **Captured + assigned** — e.g. `[role=alert]` → error; never derived over.
2. **Harvest** (`feedback-harvest.ts`) — unassigned colors matched by authored
   name, keywords, expanded B.4 context (`status` → success, `note` → info,
   `.alert-warning`, etc.), then OKLCH hue bands. Hue-only matches skip when
   within 15° of primary unless a keyword names the role.
3. **Derive** (`deriveFeedback`) — conventional-hue fallback with collision
   guard (shift start L −0.08 when primary hue within 20° of feedback hue).

**Why not always the same colors:** chroma comes from the primary; lightness is
AA-tuned per role; harvest uses real capture values when present. Figma JSON
export is unaffected — this is token completeness only.

**Rejected:** AI feedback palettes (FR-20 V2); global fixed hex palette;
deriving feedback from primary *hue* (would break learned semantics).

**Key files:** `src/engine/derive-system/feedback-harvest.ts`,
`src/engine/derive-system/color.ts`, `src/engine/derive-system/index.ts`,
`src/engine/roles/derive.ts`.

### 2.23 Modal portals escape sticky shell stacking
Decided 2026-07-16. Share with agent / Share with Figma dialogs were painted
*under* token cards on the main column: the overlays lived inside the sticky
left rail (`DesktopSessionRail`), so `position: fixed` + `z-modal` still
competed inside that ancestor's stacking context.

**Decision:** mount session modals with `createPortal(…, document.body)` via
`ModalPortal`. Share export modal and the mobile share picker use it; other
shell dialogs should follow the same pattern when they open from sticky
chrome.

**Rejected:** raising `z-modal` alone (does not escape a nested stacking
context); removing `lg:sticky` from the rail (breaks viewport-tall nav).

**Key files:** `src/components/ModalPortal.tsx`, `ShareExportModal.tsx`,
`ShareMenuButton.tsx`. Also applied to `StartOverConfirmModal` and
`ImportCaptureModal` (2026-07-19) — same sticky-rail trap.

### 2.24 Captured fonts claim type slots (multi-family typography)
Decided 2026-07-17 (Claude Code session). Typography derivation was
**single-family**: the most-frequent font became `type/body`, and every other
slot (`heading`, `display`, …) was derived as a modular-scale size of that
same face. Distinct hero or heading typefaces in the capture were ignored —
violating C.8 precedence (captured > derived) for type roles.

**Decision — capture claims before scale derive:**
1. Body anchor detection unchanged (most-frequent typography).
2. For each other type role, if `deriveRoleCandidates` finds a **captured**
   token for that role (context: `<h1>` ≥40px → `type/display`, `<h1..h3>` →
   `type/heading`; or exact `authoredName`), that token **claims the slot
   verbatim**.
3. Only still-empty slots fill from the modular type scale (C.6) / mono derive.
4. **UI:** `CapturedFonts` on `/tokens/typography` lists every captured
   typeface (specimen + where seen) and a "Use as…" picker so the user can
   assign any captured font to any `type/*` role — captured always beats
   derived.

**Rejected:** forcing one family across the system; inventing a second
"heading family" anchor (context/authoredName claims are enough for V1).

**Key files:** `src/engine/derive-system/index.ts`, `src/engine/roles/derive.ts`,
`src/components/CapturedFonts.tsx`, `src/routes/TokenCategory.tsx`.

---

### 2.25 Captured colors, accents, and subtle origin chips
Decided 2026-07-17. Multi-capture snaps from the browser extension were losing
colors: hover preview zeroed `tokenCounter`, so ids restarted at `ext_001` and
the webtool's `Map(id → token)` clobbered earlier colors. Primary detection on
all-`occurrences: 1` snaps felt arbitrary. Distinct snap colors (FIFA gold,
navy) vanished into derivation instead of staying visible.

**M1 — Duplicate ids are malformations:**
- Extension: `previewLabel` save/restores `tokenCounter` (never zeroes it).
- Schema: `parseStyleSnapExport` rejects duplicate ids with an FR-2 detail
  (`token ids must be unique — ext_001 appears N×…`).

**M2 — Primary is a visible choice:** `CapturedColors` on `/tokens/colors`
lists every captured color with Make primary · Make secondary · Role · Add to
accents. `setAnchor({ primaryColorId })` re-cascades derivation; dirty edits
survive (C.8).

**M3 — Accents + 4-way origin vocabulary:**
- Unassigned non-neutral captured colors auto-seed into "Design accents — use
  sparingly" (`accentIds` undefined = auto; user touch materializes the list).
- Origin chips (muted mono `text-badge`, quieter than the old yellow `auto`
  badge): **snap** (no chip) · **auto** (seeded) · **derived** · **default** ·
  edited (dot). Mapping: user-assigned capture → snap; auto-placed capture →
  seeded; synthetic from a token → derived; `derivedFrom: "convention"` →
  default.
- `design.md` gains an Accents table; cleaned JSON carries `accents`.

**Rejected:** keeping silent Map overwrite; loud yellow auto badges; forcing
users to hand-pick every accent before export.

**Key files:** `extension/src/content/extract.ts`, `docs/schema.ts`,
`src/engine/accents.ts`, `CapturedColors.tsx`, `DesignAccents.tsx`,
`useSessionViewModel.ts`, `RoleValueEditor.tsx`.

---

### 2.26 Extension: side panel owns unique token ids
Decided 2026-07-17. After the hover-preview counter fix (§2.25), multi-site
sessions still exported colliding `ext_001…` ids: the side panel keeps captures
across navigations, but each page gets a fresh content-script `tokenCounter`.
Copy then concatenates both → webtool FR-2 reject.

**Fix:** on `picker/captured`, the side panel remaps `token.id` and
`captureId` to a panel-local sequence (`ext_001…`, `cap-1…`) before storing.
Content-script ids remain provisional for extraction only.

**Rejected:** clearing the panel on navigation (surprising); assigning ids only
at copy time without remapping capture groups (harder to reason about in UI).

### 2.27 Three-layer category review (From snap → Primitives → System roles)
Decided 2026-07-18. Every `/tokens/:category` page is one composition with three
labeled bands:

1. **From snap** — capture inventory (colors/fonts already had strips; spacing /
   radius / borders / effects get `CapturedFoundations`).
2. **Primitives** — named post-merge inventory (`PrimitiveInventory`): rename,
   un-merge, soft-exclude captures, hard-delete manuals.
3. **System roles** — Appendix B slots with reassignment pickers on every filled
   row (including foundations).

**Delete policy:** imported captures are **soft-excluded** (`excludedIds` on the
pool — reversible, undoable, dropped from derivation/export). Manual tokens are
hard-deleted via `removeManual`. Matches “suggestive, never destructive.”

**Intelligence without a redundant system:** `src/engine/insights.ts` surfaces
base spacing unit, radius profile, and type-scale ratio in UI insight strips and
design.md Foundations/Typography — still only Appendix B roles.

**Rejected / deferred:** resurrecting CleanupStep / `/tokens/captured` as a nav
destination (§2.11 stays); editing raw capture hex without an override model
(§2.14); new Appendix B roles.

### 2.28 Layer UX polish — Add labels, collapse, effect kinds, reassign-in-editor
Decided 2026-07-18. Follow-up to §2.27 / §2.14 Phase 3:

- **Category Add CTAs:** “Add color / type / spacing / radius / border width /
  effect” (not generic “Add token”).
- **Layer collapse:** From snap starts **collapsed**; Primitives and System roles
  start **open**; each band has Show / Collapse. Jump chips expand then scroll.
- **Effect kinds** without changing `types.ts`: outer drop, inner inset, and
  **background blur** encoded as a `shadow` token with
  `context.cssProperty: "backdrop-filter"` + `source: "manual entry:backdrop-blur"`.
  Display/preview treat it as blur, not box-shadow.
- **Type add:** font family dropdown from snap-captured families.
- **Reassign** moved into `RoleValueEditor` (no under-card “Reassign…” strip).

---

### 2.29 From snap visual differentiation
Decided 2026-07-18. On every token category page, **From snap** must read as
raw capture inventory — not the same chrome as the exportable system.

- **From snap band:** dashed `border-default`, `surface-page` fill, no
  `shadow-card`, yellow `brand-pop` “capture” badge, short caption that the
  system below is what exports.
- **Primitives / System roles:** unchanged solid card + `shadow-card`.
- **Jump chips:** From snap uses dashed border + page surface; the other two
  stay solid card chips.

Uses only DESIGN.md tokens (dashed border already used for import drag zones
in §5.1).

---

### 2.30 Custom semantic roles + CSS border model
Decided 2026-07-18.

**CSS border ≠ one StyleSnap token.** A CSS `border` shorthand packs width,
style, and color (and can be per-side). StyleSnap keeps a **lean split** that
matches the capture contract (`types.ts` unchanged):

| CSS concept | StyleSnap home |
|---|---|
| `border-*-width` / stroke thickness | `border-width/*` primitives + roles |
| `border-*-color` | `color/border/*` (and custom `color/border/…`) |
| `border-*-radius` | `border-radius` / `radius/*` |
| `border-style` (solid/dashed/dotted/double/…) | **Not a token type in V1** — deferred |
| Per-side (`border-left`, `border-top`, …) | Hint via `context.cssProperty` on capture |
| `outline` / `box-shadow` inset | Separate (outline not captured; inset → shadow) |

**Custom semantic roles (beyond Appendix B):** users may add slash-nested roles
under the type prefix — e.g. `border-width/card`, `border-width/table-cell`,
`color/border/card`, `space/section` — and assign a primitive.

Implementation:
- Engine: `src/engine/roles/custom.ts` (`buildCustomRole`, `isAllowedCustomRole`,
  `inferCustomRoles`). Kebab-case path segments; cannot collide with Appendix B.
- Pool: `customRoles?: string[]` on `TokenPool`; `addCustomRole` /
  `removeCustomRole`; assigning a non-canonical role auto-registers it.
  Draft load merges declared + inferred customs. Completeness (`B.5`) ignores
  customs; `roleOrderIndex` sorts them after Appendix B (secondary sort by name).
- UI: **Add role** form on every category’s System roles band (`EditRolesPanel`);
  yellow **custom** badge on gap slots; **Remove role** drops declaration +
  assignment. From-snap foundation Slot dropdowns include declared customs;
  `cssProperty` shown on foundation capture rows when present.
- There is no bare `border/` prefix — width vs color stay split.

Component-level composites (`button/border` as one object) remain V3
(PRD Appendix B deferral).

---

### 2.31 Type-matched rename / add-token placeholders
Decided 2026-07-18. Rename and Add-token name fields used a hardcoded
`color/brand-blue` placeholder on every type — fonts suggested a color path.

**Fix:** `namePlaceholder(tokenType)` in `src/engine/roles/naming.ts` returns a
type-correct example (`type/…`, `space/md`, `border-width/default`, …).
`InlineName` takes optional `tokenType` + `suggestedName` (prefill from
`fallbackName` when unnamed). `AddTokenDialog` uses the same helper.

No taxonomy or export change — display-only correctness.

---

### 2.32 Post-capture welcome modal
Decided 2026-07-18. The Description page led with a dense caption about vibe /
derived gaps / export. That orientation belongs at **import time**, not as
page chrome.

**Modal** (`PostCaptureWelcomeModal`): after a successful import with
`location.state.fromImport`, show once on `/describe` — headline, source +
per-type counts, three-step map (review snap → set vibe → name roles & export),
trust line (captured stay yours; vibe only fills derived gaps), CTAs **Set the
vibe** / **Skip to colors**. Uses `ModalPortal` + `useDialog` (§2.23).

**Triggers:** `Home` always passes `fromImport` on first create; in-session
“Add new capture” passes it only when `!pool.adjectives?.length`. Not shown on
draft restore, routine Description visits, or import-another when vibe is set.
Location state cleared with `replace` so refresh does not re-open.

**Describe page:** long intro replaced by a one-liner + `InfoHint` (“Why vibe
first?”). Adjective picker stays on the page (not in the modal).

---

### 2.33 From snap shows all captures; survivor pick is explicit
Decided 2026-07-18. CapturedColors was fed `workingTokens` (post-`applyMerges`),
so absorbed snap colors vanished from From snap and primary felt tied to an
invisible merge choice.

**Rule:** From snap = raw pool captures (every snapped color). Primitives /
derivation = merge survivors. Auto-merge at import still creates records; it
does not hide members in the snap list.

**Survivor pick:** `setMergeSurvivor` rewrites a merge record (same members,
new `survivorId`) and remaps primary/secondary/accent ids that pointed at the
old survivor. CapturedColors + PrimitiveInventory open `MergeSurvivorDialog`.
Make primary / secondary on an absorbed color promotes it to survivor first
(`makePrimaryColor` / `makeSecondaryColor`).

**Rejected:** keeping From snap merge-collapsed; rewriting token hexes in place.

---

### 2.34 Reassign primitive inside the role click popover
Decided 2026-07-18. Filled role rows had a separate under-card **Change
primitive…** control next to the click-to-edit popover. Users expect one place:
click the card → see provenance and pick another primitive.

**Fix:** `RoleFilledRow` passes a `reassignSlot(close)` render prop into
`RoleValueEditor`; compact `PrimitivePicker` (+ custom Remove role) lives in
the dialog after provenance. Assign closes the popover. Gap-row pickers
unchanged. Hex/number Save for derived values unchanged.

**Rejected:** creating a new primitive from the dropdown (still
`assignRole` → existing pool primitive only).

---

### 2.35 System-created colors in Primitives + color pickers
Decided 2026-07-18. Derived fill colors (`derived_*` — hover/active, feedback,
neutrals, etc.) were real system values but hidden from Primitives and excluded
from `PrimitivePicker`, so users could not see or reassign them as primitives.

**Primitives (Colors):** snap/manual stay in the main list; derived colors live
in a **System-created** band (collapsed by default) with caption *“Colors the
system made for missing semantic roles.”* Rename only — no exclude/un-merge.

**Color pickers:** `PrimitivePicker` includes derived colors and splits the
list into **From snap** vs **System-created** (muted `system` chip). Non-color
pickers and primary/secondary anchors stay snap-only.

---

### 2.36 One-step undo / redo (barrier + commit decisions)
Decided 2026-07-18. One Undo could wipe several UI actions: (1) after Create
System, merge-flagged history frames were **skipped** and an older `before`
snapshot restored (multi-jump); (2) role assign / accents / rename used
`silent()`, so they rode along inside neighboring commit snapshots and vanished
on a single Undo.

**Fix:**
- **Barrier** (§2.8 Create System gate, corrected): when locked, a top-of-stack
  `affectsMerges` entry blocks undo/redo — never jump under it.
- **`affectsMerges` only when merges change** (survivor promote may be false).
- **Commit** assign / unassign / accents / rename / add·update manual so each
  is one undo step (supersedes §2.8 “role assignment not undoable”).
- Toast Undo shows when `canUndo` and calls the same stack.

---

### 2.37 Role value edit → new linked primitive `[New feature]`
Decided 2026-07-19. Editing a semantic role's value (derived / default / prior
overlay) no longer only dirty-flags `derivedEdits`. After the user confirms
**Save as a new primitive?**:

1. A `manual_*` primitive is created (`source: "manual entry"`).
2. The role is **assigned** to that primitive.
3. Any `derivedEdits` overlay for the role is cleared.

Cancel aborts with no pool change. Accept is one undoable commit
(`saveRoleAsPrimitive`). Captured / assigned roles stay reassign-only
(§2.34 provenance). `editDerived` remains for draft round-trip / legacy
overlays; the UI save path uses the promote API.

---

### 2.38 Secondary opt-in + fine-tune stays editable `[Bug fix]` `[Change]`
Decided 2026-07-19. Two related secondary-anchor issues:

1. **Auto-synthetic lock-in:** when no distinct secondary was captured,
   derivation still filled `color/action/secondary` from the default harmony.
   Users never chose to add a second CTA color.
2. **Fine-tune freeze:** Apply routed through `saveRoleAsPrimitive` (§2.37),
   which *assigned* the role to a manual token. Harmony swaps clear
   `derivedEdits` / `secondaryColorId` but not assignments — so the slot
   stayed locked and Fine-tune Apply disabled.

**Decision:**
- Derivation fills secondary only from a **captured** secondary anchor, or
  when the user has set `accentChoice.harmony` (opt-in).
- Empty secondary card → **Use secondary color** sets the suggested harmony
  (existing picker + fine-tune).
- Fine-tune writes `derivedEdits` again (§2.16); picking a harmony also
  **unassigns** `color/action/secondary` so a prior promote cannot stick.
- Color-family Secondary swatch is dashed/empty until instantiated.

---

### 2.39 Mobile layout + teaching tips `[Bug fix]` `[Change]` `[New feature]`
Decided 2026-07-19. Small-screen chrome and teaching affordances:

**Bug fixes**
- Start over / Import capture / Create System / merge dialogs paint above token
  cards via `ModalPortal` or bottom sheets (§2.23 follow-up).
- Layer nav sticky `top` = mobile session header height (no overlap with
  StyleSnap + section wheel).
- Toast sits above floating Undo on narrow viewports; Home/Create CTAs stack
  so labels fit.

**Changes**
- Teaching copy shortened (layers, welcome, Describe, gaps, provenance).
- Undo/Redo: desktop in sticky layer nav; mobile always `FloatingUndoRedo`.
- `?` InfoHint lives **inside** each layer chip; tips portal instantly (not
  native `title` delay).
- Capture-row actions denser on mobile (“More” menu); shorter Add / wheel labels.

**New**
- Instant portaled teaching tooltip + brand-pop `?` affordance (`Tooltip.tsx`).

---

### 2.12 Simplified session shell (second pass)
Decided 2026-07-12 (nav redundancy after §2.11). The route shell shrinks again:

**Removed from the left rail:** Overview (`/system`), Export (`/export`),
Anchors (`/tokens/anchors` — merged into **Colors**), and the footer status
link ("N auto-filled · M gaps").

**Left rail now:** **Description** (`/describe`, renamed from "Describe") +
six token categories (Colors … Effects). Colors shows brand-color anchor then
color roles; Typography shows text-style anchor then type roles; default route
is `/tokens/colors`.

**Footer now (superseded by §2.20):** was Undo/Redo · Create System · Copy/
Download design.md · Save JSON. **Current:** Create System only (+ completeness
hint); share actions in left rail / mobile Share; undo/redo when active per §2.20.

**Migrated from the old Overview page:** project name + import another /
Start over → **Description**; gap panel → bottom of **Colors**; welcome toast
→ first visit to Colors.

**Legacy redirects:** `/system`, `/export`, `/tokens/anchors`, `/tokens/captured`
→ `/tokens/colors`.

### 2.11 Hide captured-token workspace from the shell
Decided 2026-07-12 (derivation-first golden path; user testing). The **Captured
tokens** page (`CleanupStep` — raw primitive grid, merge queue, rename,
manual add/remove) is **removed from the route shell**: no side-nav entry, no
`/tokens/captured` category; legacy URL redirects to `/tokens/colors` (§2.12).

**Why:** Phase 10d + §2.7 already land users on a complete draft; near-duplicate
merges run **automatically at import** (`autoMergeClusters`). Exposing the full
raw inventory as a ninth nav destination duplicated Overview and reintroduced
the "bag of tokens" mental model the route shell was meant to shrink.

**What still works:**
- Import → auto-merge → derive → review on category pages (§2.12).
- Per-category role pages (`/tokens/colors`, spacing, type, …) for
  review-by-exception.
- Gap **Add token** routes to the matching category via
  `routeForAddToken()` (`src/routes/nav.ts`) and opens `AddTokenDialog` on
  that page — not the old captured grid.

**What is no longer user-facing:** merge-queue review, un-merge, primitive
rename, and "show everything" filters on the captured grid. `CleanupStep.tsx`
remains in the repo but is unwired; re-expose only if user testing shows
auto-merge mistakes need a dedicated repair surface (Phase 11 P5/P6 territory).

---

## 3. Token schema changes — v1.0 → v2.0 (`docs/types.ts`)

Committed 2026-06-29 (`b60664a`).

| Change | Rationale |
|---|---|
| Added `gradient` token type (`GradientValue` with stops + kind/angle) | Web buttons/backgrounds are frequently gradients; v1.0 would silently drop the most visually important style on a page. |
| Color alpha lives **only** in `opacity`, never baked into the hex | v1.0 could represent transparency two ways (rgba hex vs `opacity` field). One rule = no ambiguity. Colors are normalized to 6-digit hex on capture. |
| `ShadowValue` is now an **array** of `ShadowLayer`, each with `inset` | CSS `box-shadow` can stack multiple layers and can be inset; v1.0 modeled only a single drop shadow. |
| Typography gained `fontStack`, `fontStyle`, `letterSpacing`, `textTransform` | v1.0 lost the CSS fallback stack, italics, tracking, and casing — all common and meaningful. |
| Added `captureId` to every token | Groups tokens captured from the **same element/selection** so the Webtool can later reconstruct components. v1.0 flattened this away. |
| Added `occurrences` (frequency count) | Best heuristic for ranking primitives (which blue is the *brand* blue) and for auto-suggesting semantic roles. |
| `id` documented as **globally unique** (UUID / source-prefixed) + added `mergedFrom` | Merging multiple exports is the whole point; independent `token_001` ids would collide. `mergedFrom` traces which duplicates were collapsed. |
| Added `context` object (`cssProperty`, `element`, `ariaRole`, `state`, `selector`, `authoredName`) | Enables deriving semantic roles instead of predicting them (see 2.4). |
| `source` clarified for both surfaces | v1.0 only defined it for Figma ("layer name"); now also covers the extension (selector / element descriptor). |
| Schema `version` bumped to `"2.0"` | Signals a breaking change to consumers building/reading the payload. |

---

## 4. Reference — what a complete design system contains

The Webtool assembles captured tokens into these layers. Auto-extractability
notes which layers the capture surfaces can fill vs. what needs manual/AI help.

| Layer | Contents | Auto-extractable? | Completed where |
|---|---|---|---|
| **Foundations (primitives)** | color, typography, spacing, sizing, radius, border, shadow/elevation, opacity, z-index, breakpoints, grid, motion | Mostly yes | Webtool dedupes & builds scales |
| **Semantic tokens** | role aliases (`color.text.primary`, `spacing.inset.card`) | No — derived from context | AI suggests, user confirms |
| **Components** | buttons, inputs, cards… with anatomy, variants, states, token references | Partially (styles, not full matrix) | Manual + AI fill |
| **Patterns** | forms, empty states, search/filter, auth flows | Rarely | Manual / AI |
| **Iconography & imagery** | icon style, image guidelines, brand assets | Rarely | Manual |
| **Content & voice** | tone, casing, terminology, error/empty wording | No | Manual |
| **Accessibility** | contrast ratios, focus indicators, touch targets, reduced motion | Validatable at token stage | Auto-flag + manual |

**Completeness check the Webtool runs:** do we have a primitive palette → are
semantic roles assigned → do components reference semantic tokens? Anything
missing is what the "complete manually or with AI" step resolves before export.

---

## 5. Open questions / deferred decisions

- ~~**Token naming convention.**~~ **Decided 2026-07-04: slash-nested**
  (`color/action/primary`) — Figma Variables' native format, so the round-trip
  is free. Canonical role list = PRD Appendix B.
- **Align JSON token output to the W3C Design Tokens spec?** Strongly worth it —
  Figma, Style Dictionary, and most tooling already speak it, which would make
  the export targets nearly free. Applies to the Webtool's *output* model, not
  the capture format.
- **Component reconstruction.** `captureId` enables grouping captured tokens
  back into components, but the inference logic (variant/state matrix) is
  unspecified.
- **Handling messy/obfuscated sources.** Define the fallback path when `context`
  signals are absent (hashed classes, inline styles).

---

## 6. Change history

| Date | Change | Commit |
|---|---|---|
| 2026-07-19 | `[Bug fix]` `[Change]` `[New feature]` **Mobile layout + teaching tips** (§2.39): chips/`?`/undo chrome; stacked CTAs; toast vs undo; bottom-sheet dialogs; shorter copy. | `eb38f79` |
| 2026-07-19 | `[Change]` **Simpler teaching copy:** shorter tips on layers, anchors, welcome, Describe, merges, and role provenance. | `eb38f79` |
| 2026-07-19 | `[New feature]` **Instant teaching tips:** portaled hover tooltips; InfoHint brand-pop “?”. | `eb38f79` |
| 2026-07-19 | `[Bug fix]` **Layer nav under mobile chrome:** sticky `top` = session header height. | `eb38f79` |
| 2026-07-19 | `[Change]` **Undo in layer nav (desktop):** sticky `CategoryLayerNav`; mobile uses floating undo (§2.39). | `eb38f79` |
| 2026-07-19 | `[Bug fix]` `[Change]` **Secondary opt-in** (§2.38): no auto-synthetic secondary; Use secondary color; fine-tune uses derivedEdits; harmony unassigns role. | `eb38f79` |
| 2026-07-19 | `[Bug fix]` **Start over / Import portals** (§2.23 follow-up): `ModalPortal` above sticky-rail token cards. | `eb38f79` |
| 2026-07-19 | `[New feature]` **Role edit → new primitive** (§2.37): confirm Save as primitive; create manual token + assign role. | `debecac` |
| 2026-07-18 | `[Bug fix]` **One-step undo/redo** (§2.36): barrier instead of skip-jump after Create System; assign/accents/rename/manual commit to history; toast Undo when canUndo. | — |
| 2026-07-18 | `[New feature]` **System-created colors** (§2.35): derived colors in collapsed Primitives band; color PrimitivePicker splits From snap / System-created. | — |
| 2026-07-18 | `[Change]` **Reassign in role popover** (§2.34): Change primitive (+ Remove role) moves into `RoleValueEditor` click dialog; under-card button removed; assign closes popover. | — |
| 2026-07-18 | `[Change]` **From snap vs merge survivors** (§2.33): CapturedColors lists all raw snap colors; `setMergeSurvivor` + dialog to pick which hex a merge keeps; Make primary promotes absorbed members. | — |
| 2026-07-18 | `[New feature]` **Post-capture welcome modal** (§2.32): orientation dialog after import (summary + 3-step map + trust line); Describe intro → one-liner + InfoHint; `fromImport` from Home / first in-session import. | — |
| 2026-07-18 | `[Change]` **Type-matched name placeholders** (§2.31): `namePlaceholder(tokenType)` for InlineName / AddTokenDialog — fonts no longer suggest `color/brand-blue`. | — |
| 2026-07-18 | `[New feature]` **Custom semantic roles + CSS border model** (§2.30): Add role under type prefix (e.g. `border-width/card`); `pool.customRoles`; customs export, not completeness; CSS border stays split (width/color/radius); `cssProperty` on foundation capture; customs in Slot dropdowns. | — |
| 2026-07-18 | `[Change]` **From snap visual differentiation** (§2.29): dashed/page-surface capture band + badge; solid shadowed cards for Primitives/System roles; matching jump-chip treatment. | — |
| 2026-07-18 | `[Change]` **Layer UX polish** (§2.28): category Add labels; From snap collapsed by default; effect kinds (drop/inset/backdrop-blur); snap font dropdown; reassign inside RoleValueEditor. | — |
| 2026-07-18 | `[New feature]` **Three-layer token review** (§2.27): From snap → Primitives → System roles on every category; soft-exclude; foundation capture strips; PrimitivePicker reassign; scale intelligence in UI + design.md; shadow Add token. | — |
| 2026-07-17 | `[Bug fix]` **Extension panel-owned ids** (§2.26): remapping `ext_*` / `cap-*` in the side panel so multi-site sessions export unique ids. | — |
| 2026-07-17 | `[Bug fix]` `[New feature]` **Captured colors + accents + origin chips** (§2.25): fix extension id counter + schema rejects duplicate ids; CapturedColors / DesignAccents panels; subtle snap/auto/derived/default origin vocabulary; FIFA fixture. | — |
| 2026-07-17 | `[New feature]` **Captured fonts claim type slots** (§2.24): multi-family typography — context/authoredName captures claim heading/display before modular-scale derive; `CapturedFonts` panel on Typography; single-font snaps unchanged. | `2f6b4d7` |
| 2026-07-16 | `[Bug fix]` **Modal portals** (§2.23): `ModalPortal` mounts Share dialogs on `document.body` so sticky rail stacking no longer covers them with token cards. | — |
| 2026-07-13 | **Feedback color harvest** (§2.22): three-tier precedence (captured → harvest → C.4 derive); `feedback-harvest.ts`; collision guard + chroma floor in `deriveFeedback`; expanded B.4 context for success/warning/info. | — |
| 2026-07-13 | **Agent-only export gate** (§2.21): system notes gate design.md only; Figma JSON always exportable; removed global `BottomBar`; `withAgentExportReady` + `agentExportBlockers.ts`; Share with agent shows `X/5` badge; checklist gaps informational only. | — |
| 2026-07-12 | **Share + mobile chrome** (§2.20): Share with agent / Share with Figma modals; footer slimmed to Create System; mobile `NavTitleWheel` + header Share; undo/redo when-active (desktop top-right, mobile bottom corners); `roleDisplayTokens` immediate edit display. | — |
| 2026-07-12 | **Effects page + role previews** (§2.19): Shadows → Effects nav; human shadow/spacing/radius/border labels; `RoleTokenPreview` panel on filled rows; **preview strips use captured roles only** (`buildPreviewContext`), not app chrome. | — |
| 2026-07-12 | **Production deploy single-path** (§2.18): disable duplicate Vercel Git production deploys; post-deploy bundle verification in `deploy.yml`; manual `workflow_dispatch` recovery documented. | — |
| 2026-07-12 | **Description-first style bias** (§2.17, branch `makram2`): mood family → type ratio, harmony, radius scale, shadow style; import routes to Description; `styleFamily` in draft. | — |
| 2026-07-12 | **Secondary harmony swap** (§2.16): Secondary Swap → color-theory picker (`harmonyFromPrimary`) + fine-tune hex + capture revert; explicit harmony overrides auto-detected secondary anchor; full-width color-family swatches; anchor/preview info text → hover tooltips. | — |
| 2026-07-12 | **Primary + Secondary anchors** (§2.15): Colors page two-card grid; `secondaryColorId` in anchors + derivation for `color/action/secondary`; Typography gets text-style anchor; base-unit UI removed. | — |
| 2026-07-12 | **Category-first editing** (§2.14 Phase 1): `RoleValueEditor` on category role rows — derived value edit + reset; captured reassign-only; undo toast. | — |
| 2026-07-12 | **Modular description snippets** (§2.9): 60 field snippets (12×5), five adjective picks, family-boost scoring, per-field badges, `autoAdjectives` returns five; legacy template ids migrate on draft load. | — |
| 2026-07-12 | **Responsive shell** (§2.13): session routes drop global header; `SessionNav` mobile tabs + desktop rail; footer wraps with safe-area; landing keeps `SiteHeader` only. | — |
| 2026-07-12 | **Simplified session shell** (§2.12): removed Overview/Export/Anchors from nav; default route `/tokens/colors` (anchors + color roles + gaps); **Description** rename; export actions in footer (Copy/Download design.md, Save JSON); footer status link removed; project name + import/start-over on Description. | — |
| 2026-07-12 | **Hide captured-token workspace** (§2.11): removed `Captured` from `SideNav`; gap **Add token** uses `routeForAddToken()` → category page + `AddTokenDialog`. Auto-merge on import unchanged; `CleanupStep` unwired. | — |
| 2026-07-10 | **Undo/redo bugfix:** history entries now store explicit `before`/`after` pool snapshots (redo was restoring the wrong snapshot); `derivedEdits` overlay applies for every role, not only `derived_*` token ids — edits now show immediately on save. | — |
| 2026-07-10 | **Session undo/redo** (§2.8): `src/state/history.ts` — 50-step decision stack over `TokenPool`, session-only; undoable derived edits, anchor swaps, merges/un-merges; merge undo blocked after Create System; `⌘Z`/`⌘⇧Z`, bottom-bar buttons, toast Undo on color save & merge. `Reset to derived` retained. | — |
| 2026-07-10 | **FR-19b template completion** (§2.9): adjective picker + 8-starter library (`src/engine/templates/`); `autoAdjectives` heuristics; fills only empty System-notes fields; `noteSources` provenance; export gate in `SessionProvider` — Create/copy/download blocked until all five note fields filled. AI notes remain V2. | — |
| 2026-07-10 | **Route-based session shell** (§2.10): React Router layout — `/system`, `/describe`, `/export`, `/tokens/:category`; `AppShell` + `SideNav` + `BottomBar`; `SessionProvider` replaces per-page pool wiring. Home is import-only. | — |
| 2026-07-10 | **Foundation ramps** (PRD Appendix C.7): `deriveSpacingRamp`, `deriveRadiusRamp`, `deriveShadowRamp` in `src/engine/derive-system/ramps.ts` — captured values claim slots; empty spacing/radius/shadow roles derive from anchors; multi-radius captures map to sm/md/lg. | — |
| 2026-07-10 | Added **`docs/fixtures/capture-ember-app.json`** — warm-orange browser capture (27 tokens, 3-way color dedup cluster, radial hero, states, inset shadow) for manual testing; distinct from lumen / verdantly / thin fixtures. | — |
| 2026-07-06 | **Phase 10d shipped** (`4a354d1`): one-page draft after import — auto-merge at import time (exact always; near-dup only in clusters of 3+), inline gaps on Overview, 4-step stepper removed, sensitivity/merge queue simplified. Golden path = land on draft, repair by exception. | `4a354d1` |
| 2026-06-29 | Token schema v1.0 → v2.0 | `b60664a` |
| 2026-06-29 | Added this decision log | — |
| 2026-06-29 | DESIGN.md scaffold v1 → v2: added agent-instruction block, foundations (spacing/radius/shadow/layout/breakpoints), color interactive+semantic states, data-states, iconography, motion, accessibility | — |
| 2026-06-29 | Added PRD.md (web-app draft v1, scope = web app + light ecosystem context; types.ts v2.0 as input boundary) | — |
| 2026-06-29 | Filled DESIGN.md (bold & expressive direction): electric indigo `#5B2EFF` primary, hot-pink accent, hard offset shadow signature, Space Grotesk/Inter/JetBrains Mono, light-first (dark mode deferred) | — |
| 2026-06-29 | PRD draft v2: integrated ideas from the earlier v0.1 PRD (North-Star <10min, Maya/Jonas personas + JTBD, paste-first ingest, rule-based dedup with duplicate-vs-"similar", suggestive-never-destructive + reversible merges + Create System gate, deterministic+provenance design.md, in-session MVP architecture, tech stack, risks). **Decision: human review + gap completion (manual core, AI as accelerator) is the product's core value — raw JSON without review is untrusted.** | — |
| 2026-06-29 | Doc reorg: old v0.1 PRD deleted; root `PRD.md` v2 renamed and moved to **`docs/PRD_webtool_v2.md`** — now the canonical web-app PRD. | — |
| 2026-07-05 | **Phase 10 UX hardened after re-walkthrough** (UX_RESEARCH §7): flow inverted to **review-by-exception** — land on the complete draft + summary strip ("4 proposed merges · 3 anchors · 14 derived"), steps become repair shops; derivation runs on **cluster canonicals** pre-merge and refines live (fixes the merge→anchor sequencing hole); merge review is a queue, not a badge hunt; **10c cognitive-load rules** added (≤3 decisions above fold, one primary CTA, no-jargon copy, confess-automation-in-place, 3 badge states max). New risks R1–R3 tracked in acceptance. | — |
| 2026-07-05 | **Derivation-first completion adopted** (§2.7; agreed makram + team feedback): PRD **FR-19 revised** + **Appendix C** (anchor detection, OKLCH state/neutral math, conventional-hue feedback colors with brand chroma, color-wheel accent suggestions w/ suitability rule, modular type scale, foundation ramps, dirty-flag cascade). PRD → v2.2. **Phase 10 rewritten** as "auto-completed draft + stepper": engine first (10a), flow UI (10b) with steps Clean up → Anchors & meaning → Your system → Review & export; Phase 11 P5 absorbed; golden-path target tightened to < 5 min. | — |
| 2026-07-05 | **Simulated usability study added** (`docs/UX_RESEARCH.md`): 10 scenarios × 12 hypothetical users against the 8c/8d UI; 22 friction points → 13 ranked pain points. Explicitly hypotheses, not data — real 5-user validation recommended before Phase 11. Outcomes: Phase 10 extended with export guardrail (P2), resume-to-step (P9), stepper a11y (P11); **Phase 11 added** (batch suggestion accept, reopen-after-finalize + toast undo, scale builders, ignore-token, error-copy quick fixes); P7/P8 sent to backlog. | — |
| 2026-07-05 | **Phase 10 spec added** (UX review vs the Maya persona): 8c's two stacked tab levels + drawers presented the pipeline as a ~10-destination map; replaced by a **4-step flow** (Clean up → Give meaning → Fill gaps → Review & export) with one context-aware primary CTA, inline gaps/export (no overlays), user-vocabulary labels, free navigation. 8c plumbing (view-model, deep links, 8d picker) retained. Open-phase order set to **10 → 9**; Phase 9's System-notes panel placed in step 4. | — |
| 2026-07-04 | **Phase 9 spec added** (user testing): `design.md` export gains **descriptive layers** (PRD §11 extended) — computed Accessibility section (measured WCAG ratios per assigned text/surface pair, failures also listed in Gaps), computed component sketches from `captureId` groups, and a user-authored **System notes** panel (mood, component principles, motion, voice, layout; empty fields become Gaps lines; notes round-trip via cleaned JSON). Oracle `design.example.md` extended accordingly (ratios machine-verified). AI-drafted descriptions deferred to V2/FR-20. | — |
| 2026-07-04 | **Phase 8 spec added to BUILD_PLAN.md** after user testing of the MVP build: role storage inverted from per-token `role` field (1:1 — couldn't express one primitive holding several roles, contradicting §2.3 and the oracle's dual-use `color/ink`) to an `assignments: role → primitiveId` map; additive multi-role UI; new **System view** grouped by role subcategory (Text/Surface/Action/Border/Feedback) showing primitives with all their semantic uses. Alternative considered and rejected: keeping 1:1 and displaying colors in usage subcategories — would require duplicate same-hex tokens, breaking value-based dedup (Appendix A.6) and the single-source-of-truth property of primitives. | — |
| 2026-07-04 | Agent instructions made tool-agnostic (build will span Claude Code + Cursor): full instructions moved to **`AGENTS.md`** (single source of truth); `CLAUDE.md` and `.cursor/rules/stylesnap.mdc` are pointers to it. Rule: edit only AGENTS.md. | — |
| 2026-07-04 | Added **`CLAUDE.md`** (agent instructions: doc map, fixtures/oracle, hard product rules, engine-first conventions) and **`docs/BUILD_PLAN.md`** (7 phases, one Claude Code session each, acceptance checks tied to the fixtures and the design.example.md oracle test). | — |
| 2026-07-04 | Added **`docs/fixtures/`** (messy browser capture w/ 4-way blue cluster + 15-vs-16 spacing + lineHeight-variant typography; clean Figma capture w/ `authoredName`s; malformed file for FR-2) — all three verified against `schema.ts` (2 pass, 1 rejected with specific errors). Added **`docs/examples/design.example.md`** — hand-written oracle for the `design.md` export (semantic-first, provenance, gaps section, deterministic ordering); it is what the webtool must produce from the two good fixtures. | — |
| 2026-07-04 | PRD v2.1 follow-ups: **localStorage draft promoted to MVP** (FR-29 — refresh must not kill a demo); **de-scope order locked in §13** (golden path paste→dedup→merge→name→export is untouchable); FR-8 scoped to *display* of `captureId` groups (reconstruction = V3); Appendix A tightened — opacity ε 0.01 in `colorDistance`, canonical sort key (type → role → name → value → id), sensitivity slider = 3 positions ×0.5/×1/×1.5. **§2.6: contract distribution = copy `types.ts` verbatim from this repo (canonical); `meta.version` + FR-4 warning catch drift.** | — |
| 2026-07-04 | PRD v2 → v2.1: FR-9/A.4 typography dup key unified, **`lineHeight` added to the key** (differs-only-in-lineHeight ⇒ "similar", never silent merge); **Appendix B canonical role taxonomy** (lean core: 17 color roles, 6 type roles, foundation scale slots, context→role hint table, completeness = ✅ rows); **naming locked: slash-nested**; **project name: derived from `meta` + editable**; Figma-export ownership leaning plugin (V3). | — |
| 2026-07-04 | DESIGN.md v1 → v1.1 (accessibility audit): `error` #F23030 → **#DC2626** (white-on-error was 4.0:1, failed AA on the destructive button); added `error-hover`, `success-text`/`warning-text`/`info-text` variants + **fills-only rule** (semantic fills & `brand-accent`/`brand-pop` never used as text on light; `text-primary` on fills); measured contrast table in §11; touch-target rule scoped (44px default, 36px `sm` only in dense desktop lists); §0 rule changed from "nearest Tailwind token" to "all values are custom tokens in tailwind.config"; skeleton shimmer tokenized (`state-disabled-bg`); z-index scale; per-variant button hover states; new **§5.1 token-workspace component specs** (swatches, badges, role chip, merge dialog, sensitivity slider). | — |
| 2026-07-04 | Added `docs/schema.ts` — zod runtime twin of `types.ts` v2.0 for FR-2 paste validation (envelope-only rule, compile-time drift assertions, `parseStyleSnapExport()` helper). Documented in §2.5. | — |
| 2026-06-29 | Added Appendix A (dedup algorithm) to `docs/PRD_webtool_v2.md`: occurrence-led leader clustering; color = OKLab ΔEOK (dup ≤0.02 / similar ≤0.05) via culori; numeric = 1-D gap clustering w/ hybrid tol + 4px grid snap; typography composite key + size-scale; shadow/gradient field epsilons. **Adopted value-based dedup** (survivor inherits all contexts). Removed remaining v0.1 references. | — |
