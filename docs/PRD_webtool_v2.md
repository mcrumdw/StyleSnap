# StyleSnap Web Application — Product Requirements

**Status:** Draft v2 · building phase
**Owner:** makram (web application) · **Branch:** `makram`
**Last updated:** 2026-06-29
**Related docs:** `DESIGN.md` (UI design source of truth), `docs/types.ts` (shared token contract, v2.0), `docs/DECISIONS.md` (decision log)

> Scope note: this PRD specifies the **StyleSnap web application** in full. The
> browser extension (Murtaza) and Figma plugin (Theresa) are upstream token
> *producers*, described only as much as needed for context. The boundary with
> this app is the `types.ts` JSON contract (§4, §13).
>
> This PRD commits to **human review + completion** as the core value (§2, §8).

---

## 1. Overview

StyleSnap helps a UX/UI designer turn gathered inspiration into a **coherent,
exportable design system**. The ecosystem has three surfaces:

- **Browser extension** — capture styles from live web pages.
- **Figma plugin** — capture styles from a Figma file; also an export target.
- **Web application (this PRD)** — the full-screen workspace where captured
  styles are reviewed, cleaned, completed, and exported.

**North-Star outcome:**
> *A finished design becomes an exportable design system in under 10 minutes,
> with a `design.md` usable as context for Claude Code / Cursor.*

## 2. Problem & opportunity

The extension and plugin can only *collect* raw tokens, in small surfaces (a
plugin panel, a side panel) where you can't reasonably review dozens of values,
notice that `#FF46AF` and `#FF47AF` are "the same pink," decide what to call
things, or see what the system is still missing.

**The web app is the full-screen workspace** where the messy pile becomes a
clean system: import JSON → review → dedupe & merge → assign roles → complete
the gaps → export.

**Core principle — review is mandatory.** Captured JSON is *raw and untrusted*:
it carries duplicates, ambiguous roles, and holes a capture can never fill
(spacing scales, interaction states, semantic feedback colors). Shipping it
unreviewed is not safe or useful. The web app's value is precisely the human
(and AI-assisted) review and completion layer between capture and deliverable.

## 3. Goals & non-goals

**Goals**

- Ingest captured tokens from the extension and Figma plugin via the `types.ts`
  contract, from one or many capture sessions.
- Let the user **review** captured tokens clearly in a full-screen workspace.
- Detect and resolve **duplicates / near-duplicates** (the "30 blues" problem).
- Derive **semantic roles** from capture context, with human confirmation.
- **Complete** what a full design system needs — manually (core) or with AI
  assistance (accelerator).
- Export a `design.md` source of truth and Figma Variables/Styles.

**Non-goals (for this app)**

- The **capture** experience — browser extension (Murtaza).
- Figma **plugin** capture internals (Theresa).
- StyleSnap's own UI design — lives in `DESIGN.md`.
- Generating production application code (downstream of `design.md`).

The `types.ts` JSON contract is the boundary: upstream of it is out of scope;
everything the app does with that JSON is in scope.

## 4. Ecosystem context (light)

```
[Browser Extension] ──┐
                      ├──►  StyleSnapExport JSON (types.ts v2.0)  ──►  [Web App]  ──►  design.md
[Figma Plugin]      ──┘                                                          └──►  Figma Variables/Styles
```

- Each producer emits a `StyleSnapExport` (`meta` + `tokens[]`); `meta.source`
  distinguishes `"browser-extension"` vs `"figma"`.
- The web app accepts **multiple** exports and merges them into one project.
- Bridge is **copy/paste / file** JSON (no live sync). The contract is locked.

## 5. Users & primary job

Inherits the team personas:

- **Maya — design student.** Gathering inspiration, learning to build systems;
  wants structure without ceremony.
- **Jonas — freelance vibe coder.** Wants one file to drop into his AI coding
  tool so the build stays on-brand.

**Job to be done:**
> "I have a bag of raw tokens from my design. Help me see them clearly, collapse
> the duplicates, give them sensible names, fill what's missing, and hand me one
> file I can drop into my AI coding tool."

**Secondary consumer — the developer / AI coding tool** that ingests the
exported `design.md`. Not a direct user, but the quality bar: the export must be
unambiguous enough to apply without guessing.

## 6. Core user flow

```
Paste / upload JSON
      ↓  validate against types.ts ──fail──▶ friendly inline error
      ↓ ok
Token workspace (grouped, counts, duplicate flags, derived roles)
      ↓
Review · merge duplicates (reversible) · confirm/assign roles · name
      ↓
Detect gaps · complete (manual core · AI assist)
      ↓
Create System   (finalize: deduped + named + roles + gaps resolved)
      ↓
Export  →  design.md   and/or   cleaned JSON   and/or   Figma Variables
```

The **Create System** step is the explicit gate between free editing and export:
everything before it is reversible; it produces the finalized, stable set.

## 7. Functional requirements

### 7.1 Ingest & validate
- **FR-1** Accept JSON via a **paste zone (primary)** and **file upload (secondary)** — producers hand off by copy/paste, so paste is the front door.
- **FR-2** Validate against `StyleSnapExport` (`types.ts` v2.0). On failure, show a specific, friendly error ("This doesn't look like StyleSnap JSON"); never crash on malformed input.
- **FR-3** Support **multiple imports in one session**, appended into one pool; preserve each token's `meta.source`, `source`, `captureId`, `occurrences`.
- **FR-4** Handle schema `version`; warn on mismatch.

### 7.2 Token workspace (review)
- **FR-5** Group tokens by `type` (color, gradient, typography, spacing, border-radius, border-width, shadow); show per-group **counts**; hide empty groups.
- **FR-6** Per token: **value preview** (swatch / type specimen / numeric chip / shadow & gradient preview), `source` provenance, `occurrences`, assigned `name` (or "unnamed"), derived-role chip, and a **duplicate/similar badge** when flagged.
- **FR-7** Search/filter (by type, source, named/unnamed, flagged).
- **FR-8** Reconstruct capture **groupings** via `captureId` (tokens from the same element) to support later component work.

### 7.3 Duplicate detection (rule-based, V1)
- **FR-9** Flag **exact duplicates** and **"similar"** values per type — a deliberate two-level distinction:
  - **Color:** exact hex = duplicate; within a small perceptual ΔE threshold = similar (Appendix A).
  - **Numeric (spacing / radius / border-width):** equal = duplicate; within a small relative tolerance = similar (Appendix A).
  - **Typography:** same `fontFamily` + `fontSize` + `fontWeight` = duplicate.
  - **Shadow:** all layer fields equal = duplicate.
- **FR-10** Rank a canonical candidate per cluster (by `occurrences` + context strength).
- **FR-11** Detection is **suggestive, never destructive** — flags only; the user decides.
- The exact clustering algorithm, per-type distance functions, and thresholds are specified in **Appendix A**.

### 7.4 Merge
- **FR-12** Select a duplicate/similar cluster → choose the surviving value → merge; set `merged: true` and record `mergedFrom` ids.
- **FR-13** Merges are **reversible (undo / un-merge) until Create System**.

### 7.5 Semantic role mapping (review)
- **FR-14** Derive candidate roles from `context` (e.g. `background-color` → surface/action; `color` on `<h1>` → heading text; `[role=alert]` → feedback).
- **FR-15** Prefer the author's own name (`authoredName`: CSS variable / utility class / Figma Variable) when present.
- **FR-16** Present roles for **human confirmation** — never finalize silently; allow override/rename.
- **FR-17** Maintain the two-tier model: primitives + semantic tokens referencing them (`DECISIONS.md` §2.3).

### 7.6 Completeness & completion (core)
- **FR-18** Evaluate the project against a "complete system" checklist (primitive palette → roles assigned → required foundations: spacing scale, radius, shadow, interaction states, semantic feedback colors, type scale); show status + specific gaps.
- **FR-19** Let the user **complete gaps manually** — add/edit tokens, build scales (color tonal, type, spacing) by hand. This is core, not optional.
- **FR-20 (AI accelerator)** Optionally **propose** values for gaps and roles — derive a hover shade from a base color, generate a spacing scale, suggest semantic colors, suggest names. AI **proposes; the human disposes** — every suggestion is reviewable and consistent with captured values. (Requires Anthropic API; layered on top of the manual flow.)

### 7.7 Naming
- **FR-21** Inline-editable `name` per token (e.g. `color/brand-primary`, `space/md`).
- **FR-22** Naming encouraged but not blocking — unnamed tokens export with a generated fallback name.

### 7.8 Create System & export
- **FR-23** **Create System** finalizes: dedupe applied, roles + names resolved, gaps reconciled, deterministic ordering.
- **FR-24** Export **`design.md`** (headline deliverable, §11): semantic-first, provenance-annotated, deterministically ordered.
- **FR-25** Export **cleaned JSON** (`StyleSnapExport`, `merged`/`name` populated).
- **FR-26** Export **Figma Variables/Styles** (slash-nested names; Variable aliasing for primitive→semantic).
- **FR-27** Flag any remaining gaps in every export so the consumer knows what's undefined.

### 7.9 Session & persistence
- **FR-28** V1 state is **in-session** (refresh = empty); **JSON export is the save mechanism**, clearly messaged.
- **FR-29** Optional **localStorage draft** to survive accidental refresh (stretch).

## 8. Design principles (the "confidence pattern")

- **Review is mandatory** — raw captured JSON is untrusted until a human confirms it.
- **Suggestive, never destructive** — the app flags and proposes; the user decides.
- **Preview before commit** — the user always sees exactly what Create System / Export will produce; actions are reversible until finalized.
- **AI proposes, human disposes** — no silent automation.
- **Low-friction entry, clarity over completeness** — a single paste zone to start; never overwhelm.

## 9. Data model

**Input (fixed contract):** `StyleSnapExport` = `meta` + `tokens[]`, each a
`StyleSnapToken` discriminated union (`types.ts` v2.0) — raw capture: primitives
+ context only.

**Assembled model (built by this app):** deduped **primitives** (optionally
scaled) → **semantic tokens** (role → primitive) → **capture groups**
(`captureId`) → **completeness state** (present/missing layers).

**Output format:** strongly consider aligning exported token JSON to the **W3C
Design Tokens** spec — Figma, Style Dictionary, and most tooling already speak
it (`DECISIONS.md` §5).

## 10. AI assistance — requirements & guardrails

- Assists with: duplicate/similar clustering, role suggestion from context,
  gap-fill proposals, naming.
- **Never finalizes silently** — every output is a reviewable proposal (FR-20).
- Suggestions must be **consistent with captured values** (a generated hover
  shade derives from the actual base color).
- Layered **on top of** the manual flow, which works without it. (Requires
  Anthropic API — see milestones.)

## 11. The `design.md` export (key deliverable)

A single file to paste into Claude Code / Cursor as design-system context.

- **Semantic-first, two-tier:** roles lead, primitives underneath (e.g.
  `color.action.primary → brand-indigo / #5B2EFF`); see `DECISIONS.md` §2.3 for the two-tier model.
- **Provenance annotated:** note where a value came from (e.g. `from Button/Primary`).
- **Foundations included:** spacing scale, radius, shadow, type scale, breakpoints.
- **Deterministic ordering** so re-exports diff cleanly in git / AI loops.
- **Plain Markdown** — no tool-specific syntax; works in any AI coding context.
- **Gaps flagged** explicitly so the consumer knows what's undefined.

## 12. Success metrics

- Raw export → exported `design.md` in **< 10 minutes**.
- Duplicate detection surfaces the obvious duplicates a user would merge by hand.
- A high share of tokens get a confident role without manual entry — and the
  user can complete the rest without friction.
- Exported `design.md` applies consistently in a downstream AI tool with no ambiguity.
- Round-trip to Figma produces correctly named Variables/Styles.

## 13. Milestones (proposed)

- **MVP** — paste/upload + validate, token workspace, **rule-based dedup +
  merge**, **manual role assignment**, **manual gap completion**, `design.md` +
  cleaned-JSON export, in-session state.
- **V2** — AI assistance (similarity/role suggestion, AI gap-fill, naming),
  completeness automation, localStorage draft.
- **V3** — Figma Variables/Styles export, project persistence/accounts,
  component reconstruction from `captureId`.

## 14. Tech & architecture

| Item | Choice |
|---|---|
| Frontend | React + Vite |
| Backend / DB | **None for V1** — state in-session (JSON export = save) |
| Data contract | `docs/types.ts` v2.0 — imported, never redefined |
| AI | Anthropic API (V2 — for FR-20 assistance) |
| Deployment | Vercel or Netlify (static) |
| Bridge | JSON copy/paste / file from plugin & extension (no live sync) |

## 15. Risks

| Risk | Mitigation |
|---|---|
| Schema drift across the three codebases | `types.ts` v2.0 locked; web app imports it directly |
| Rule-based dedup misses "visually same" colors | Tune threshold; mark as "similar" (suggest, don't force); AI matching in V2 |
| In-session-only state loses work on refresh | Clear messaging; JSON export as save; localStorage draft (stretch) |
| `design.md` not actually useful to AI tools | Validate by pasting a real export into Claude Code / Cursor during testing |
| AI suggestions erode trust if wrong | Human-in-the-loop everywhere; proposals only; consistent-with-capture rule |

## 16. Dependencies & open questions

- **`types.ts` contract stability** — the hard dependency; changes coordinated across surfaces.
- **Project name** for the `design.md` header — derive from `meta.figmaFile` / `meta.pageUrl`, or ask the user?
- **Naming convention default** — `color/brand-primary` vs `brand-primary`; pick one, consistent with `design.md` output and `DESIGN.md`.
- **Who owns the Figma export** (this app vs the Figma plugin)?
- **Output token format** — adopt W3C Design Tokens? (recommended, §9).

## 17. Out of scope (V1)

- The capture experience (browser extension — Murtaza) and Figma plugin internals.
- StyleSnap's own UI design (see `DESIGN.md`).
- Generating production application code (downstream of `design.md`).
- Dependency graph (which text style uses which color).
- User accounts / backend / persistence (V1 is in-session).
- Mobile-responsive layout — desktop-first for the demo.

---

## Appendix A — Deduplication algorithm (rule-based, V1)

Implements FR-9–FR-13. **One shared clustering routine + a per-type distance
function.** Output is always *suggestive* — clusters the user confirms; nothing
auto-applies.

### A.1 Shared clustering — occurrence-led "leader" clustering

Measure every candidate against a fixed leader (not transitively) to avoid
**chaining** (A≈B, B≈C, but A≠C collapsing into one).

```
cluster(tokens, distance, dupT, simT):
  pool = tokens sorted by (occurrences desc, value asc)    # deterministic
  clusters = []
  while pool not empty:
    leader = pool.shift()                  # most-used remaining value = survivor
    members, rest = [], []
    for t in pool:
      d = distance(leader, t)
      (d <= simT ? members : rest).push({ t, d })
    clusters.push({
      canonical:  leader,
      duplicates: members where d <= dupT,
      similar:    members where dupT < d <= simT })
    pool = rest
  return clusters
```

O(n²) (fine for hundreds of tokens), stable output. On merge:
`survivor.occurrences = Σ cluster`, and `mergedFrom` keeps the originals' ids
**and their `context`**, so the survivor inherits every role hint for §7.5.

### A.2 Color — perceptual distance (never raw hex distance)

Convert sRGB → OKLab and use Euclidean distance (ΔEOK); or CIEDE2000 (ΔE00).
Recommended library: **`culori`**. Never cluster across differing `opacity`.

```
colorDistance(a, b) = (a.opacity !== b.opacity) ? Infinity : dEOK(a.value, b.value)
```

| Level | ΔEOK (OKLab) | ΔE00 (CIEDE2000) |
|---|---|---|
| exact | 0 | 0 |
| **duplicate** | ≤ 0.02 | ≤ 1.0 |
| **similar** | ≤ 0.05 | ≤ 3.0 |

Expose the dup/similar cutoffs as **one "merge sensitivity" slider**.

### A.3 Numeric (spacing / radius / border-width) — 1-D gap clustering

Hybrid absolute+relative tolerance, so it behaves at 4px and 64px alike.

```
tol(v) = max(1, round(0.05 * v))           # border-width: floor 0.5px
sort unique values ascending
walk; start a new cluster when  v - clusterMax > tol(clusterMax)
exact-equal members = duplicate; within tol = similar
canonical = highest occurrence; tie-break → nearest 4px grid step
```

So 14/15/16 cluster (canonical snaps toward a clean scale) while 4 and 8 never collapse.

### A.4 Typography — normalize, then composite key + size-scale

```
normalize: family = first-in-stack, lowercased, de-quoted; weight numeric
           ("bold"→700, "normal"→400); size rounded to 0.5px
dupKey  = family | size | weight | style | letterSpacing | textTransform
          → identical key = duplicate
similar = same (family, weight, style) AND |Δsize| within tol()   # reveals a type scale
```

Keep `letterSpacing` / `textTransform` in the key — a tracked uppercase label is
a *different* token from body text at the same size/weight.

### A.5 Shadow & gradient

```
shadow duplicate: same layer count AND for every layer →
   inset equal, |Δ offset/blur/spread| ≤ 1px, colorDistance ≤ 0.02, |Δ opacity| ≤ 0.02
shadow similar:   same count & inset pattern, geometry within ~2px, color ≤ 0.05
gradient (conservative): same kind & stop count, each stop colorDistance ≤ 0.02
   AND |Δposition| ≤ 2%, (linear) |Δangle| ≤ 3°; otherwise leave for manual review
```

### A.6 Cross-cutting rules

- **Value-based dedup (adopted):** collapse primitives by value regardless of
  context; the survivor inherits all contexts, which then drive role mapping
  (§7.5). Revisit only if it proves too aggressive.
- **Deterministic ordering** everywhere → clean export diffs.
- **Suggest, never auto-apply**; reversible until Create System (FR-13).
- **One sensitivity slider** controls dup/similar thresholds, not per-type knobs.
- **Library:** `culori` covers all color math; numeric/typography logic is plain JS.

---

*PRD version: draft v2 — review + completion is core.*
