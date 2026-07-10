# StyleSnap — Decision Log

A running record of the design and architecture decisions behind the StyleSnap
ecosystem, so that documentation, onboarding, and future changes stay grounded
in *why* things are the way they are.

Last updated: 2026-07-04

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
