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
- **FR-8** **Display** capture groupings via `captureId` (tokens from the same element) — a "from the same element" grouping/filter in the workspace, nothing more in MVP. Component *reconstruction* from these groups is V3 (§13).

### 7.3 Duplicate detection (rule-based, V1)
- **FR-9** Flag **exact duplicates** and **"similar"** values per type — a deliberate two-level distinction:
  - **Color:** exact hex = duplicate; within a small perceptual ΔE threshold = similar (Appendix A).
  - **Numeric (spacing / radius / border-width):** equal = duplicate; within a small relative tolerance = similar (Appendix A).
  - **Typography:** identical normalized composite key = duplicate — the key is `fontFamily + fontSize + fontWeight + fontStyle + letterSpacing + textTransform + lineHeight` (full definition in A.4). Tokens equal in everything **except `lineHeight`** are flagged **similar**, never auto-merged.
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
- **FR-19 (revised 2026-07-05 — derivation-first completion)** The app
  **auto-drafts every derivable gap deterministically** from anchor tokens
  (primary color, body typography, base spacing), like completing a puzzle
  from its corner pieces: interaction states, feedback colors, tinted
  neutrals, type scale, spacing/radius/shadow ramps (algorithms in
  **Appendix C**). Derived values are visibly badged and carry provenance;
  captured values always win over derived; user edits are never overwritten
  by re-derivation (dirty flags). Manual add/edit remains available but is
  the *intentional-change* path, not the default chore. Truly underivable
  layers (motion, voice, breakpoints) remain explicit gaps.
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
- **FR-28** V1 has no backend; **JSON export is the save mechanism**, clearly messaged.
- **FR-29** **localStorage draft (MVP, promoted 2026-07-04)** — the working state auto-saves to localStorage and is restored on load, so an accidental refresh never loses work (a refresh mid-demo must not be fatal). Not a substitute for JSON export.

## 8. Design principles (the "confidence pattern")

- **Review is mandatory** — raw captured JSON is untrusted until a human confirms it.
- **Suggestive, never destructive** — the app flags and proposes; the user decides. Derivation-first completion (FR-19) obeys the same rule: derived values are visibly badged proposals the user can change in one click, never silent inventions — and re-derivation never overwrites a human edit.
- **Complete by default, edit by intent** — the user reviews a finished draft and changes what they disagree with, instead of filling a long gap list.
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

**Descriptive layers (added 2026-07-04)** — a usable design system is more
than token tables. Each layer has a distinct source:

- **Computed by the app:** an **Accessibility** section with measured WCAG
  contrast ratios for every assigned text/surface role pair (pass/fail
  annotated), and **component sketches** derived from `captureId` groups
  ("Button = `action/primary` bg · `radius/sm` · hover → `-hover` shade").
- **User-authored ("System notes" panel):** mood/vibe, component principles,
  motion, voice/microcopy, layout notes — optional structured text fields
  filled before export. Empty fields are reported in **Gaps**, never silently
  omitted.
- **AI-drafted (V2, FR-20):** propose descriptions *derived from* the tokens
  (e.g. hard shadows + dark borders + saturated primary → "neobrutalist,
  confident"); user edits before export.

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
  cleaned-JSON export, localStorage draft (FR-29).
- **V2** — AI assistance (similarity/role suggestion, AI gap-fill, naming),
  completeness automation.
- **V3** — Figma Variables/Styles export, project persistence/accounts,
  component reconstruction from `captureId`.

**De-scope order (locked 2026-07-04).** The golden demo path — *paste → see
the 30-blues problem → dedupe/merge → name → export `design.md`* — is
untouchable. If the timeline compresses, simplify in this order: (1) the
completeness checklist shrinks to a static gap list, (2) manual scale-builders
shrink to plain add/edit token forms, (3) role assignment falls back to a
simple dropdown per token (taxonomy from Appendix B). Never cut dedup, merge,
or the `design.md` export.

## 14. Tech & architecture

| Item | Choice |
|---|---|
| Frontend | React + Vite |
| Backend / DB | **None for V1** — state in-browser (localStorage draft, FR-29; JSON export = save) |
| Data contract | `docs/types.ts` v2.0 — imported, never redefined |
| AI | Anthropic API (V2 — for FR-20 assistance) |
| Deployment | Vercel or Netlify (static) |
| Bridge | JSON copy/paste / file from plugin & extension (no live sync) |

## 15. Risks

| Risk | Mitigation |
|---|---|
| Schema drift across the three codebases | `types.ts` v2.0 locked; web app imports it directly |
| Rule-based dedup misses "visually same" colors | Tune threshold; mark as "similar" (suggest, don't force); AI matching in V2 |
| Losing work on refresh | localStorage draft (FR-29, MVP); JSON export as the real save; clear messaging |
| `design.md` not actually useful to AI tools | Validate by pasting a real export into Claude Code / Cursor during testing |
| AI suggestions erode trust if wrong | Human-in-the-loop everywhere; proposals only; consistent-with-capture rule |

## 16. Dependencies & open questions

- **`types.ts` contract stability** — the hard dependency; changes coordinated across surfaces.
- ~~**Project name** for the `design.md` header~~ — **Decided 2026-07-04:** prefill from `meta.figmaFile` / the domain of `meta.pageUrl` on first import; editable field in the workspace; exports use it. No blocking prompt.
- ~~**Naming convention default**~~ — **Decided 2026-07-04: slash-nested** (`color/action/primary`, `space/md`) everywhere — UI, `design.md`, cleaned JSON. It is Figma Variables' native nesting, so the Figma export needs no name mapping. Role taxonomy in **Appendix B**.
- **Who owns the Figma export** (this app vs the Figma plugin)? *Leaning plugin: a static web app with no backend can't do Figma REST OAuth; deferred to V3.*
- **Output token format** — adopt W3C Design Tokens? (recommended, §9).

## 17. Out of scope (V1)

- The capture experience (browser extension — Murtaza) and Figma plugin internals.
- StyleSnap's own UI design (see `DESIGN.md`).
- Generating production application code (downstream of `design.md`).
- Dependency graph (which text style uses which color).
- User accounts / backend / server-side persistence (V1 is local: localStorage draft + JSON export).
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
colorDistance(a, b) = (|a.opacity - b.opacity| > 0.01) ? Infinity : dEOK(a.value, b.value)
```

(Opacity uses an ε of 0.01, not strict equality — float noise like `0.8` vs
`0.7999999` must not split a cluster.)

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
           ("bold"→700, "normal"→400); size rounded to 0.5px;
           lineHeight rounded to 0.05 (kills float noise: 1.4999 ≡ 1.5)
dupKey  = family | size | weight | style | letterSpacing | textTransform | lineHeight
          → identical key = duplicate
similar = same (family, weight, style) AND |Δsize| within tol()   # reveals a type scale
        OR identical key except lineHeight                        # lineHeight conflict
```

Keep `letterSpacing` / `textTransform` in the key — a tracked uppercase label is
a *different* token from body text at the same size/weight.

`lineHeight` is in the key (decided 2026-07-04): merging two tokens that differ
only in line-height would silently drop one value, violating "suggestive, never
destructive." Instead they surface as **similar**, and the merge dialog shows
the line-height conflict so the user picks the survivor knowingly.

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
- **Deterministic ordering** everywhere → clean export diffs. The canonical
  sort key (workspace, exports, cleaned JSON): **`type` (fixed order: color,
  gradient, typography, spacing, border-radius, border-width, shadow) → role
  (Appendix B order, role-less last) → `name` (asc, unnamed last) → value
  (asc) → `id`** as final tiebreak.
- **Suggest, never auto-apply**; reversible until Create System (FR-13).
- **One sensitivity slider** controls dup/similar thresholds, not per-type
  knobs. Three positions scaling every type's thresholds uniformly:
  **strict = ×0.5 · default = ×1 · loose = ×1.5** (e.g. color similar ΔEOK
  0.025 / 0.05 / 0.075; numeric tol 2.5% / 5% / 7.5%). Changing it re-flags
  live; it never re-merges or un-merges anything by itself.
- **Library:** `culori` covers all color math; numeric/typography logic is plain JS.

---

## Appendix B — Canonical role taxonomy (V1, lean core set)

Decided 2026-07-04. This is the fixed vocabulary behind role assignment
(§7.5), the completeness checklist (FR-18), and the `design.md` structure
(§11). **Naming is slash-nested** (`color/action/primary`) — Figma Variables'
native nesting, so the Figma export needs no name mapping. Component-level
roles (`button/bg`, …) are deliberately deferred to V3.

Semantic roles point at user-named **primitives** (two-tier, `DECISIONS.md`
§2.3). Primitives live under a type prefix with a free name chosen by the
user: `color/brand-indigo`, `font/space-grotesk`.

### B.1 Color roles (17)

| Role | Meaning | Required for "complete" |
|---|---|---|
| `color/text/primary` | Default text | ✅ |
| `color/text/muted` | Secondary text, captions | ✅ |
| `color/text/inverse` | Text on dark/brand fills | — |
| `color/text/link` | Links | — |
| `color/surface/page` | App/page background | ✅ |
| `color/surface/card` | Cards, panels, inputs | ✅ |
| `color/surface/overlay` | Modal scrim | — |
| `color/action/primary` | Primary buttons, active nav | ✅ |
| `color/action/primary-hover` | Hover state | ✅ |
| `color/action/primary-active` | Pressed state | — |
| `color/action/secondary` | Secondary CTAs | — |
| `color/border/default` | Card/input borders, dividers | ✅ |
| `color/border/focus` | Keyboard focus ring | ✅ |
| `color/feedback/success` | Confirmation | ✅ |
| `color/feedback/warning` | Caution | ✅ |
| `color/feedback/error` | Errors, destructive | ✅ |
| `color/feedback/info` | Neutral information | ✅ |

### B.2 Typography roles (6)

`type/display` · `type/heading` · `type/subheading` · `type/body` (✅) ·
`type/caption` · `type/mono`. Required for complete: `type/body` +
at least one of `type/display` / `type/heading` (✅).

### B.3 Foundation scales

Scales are **named slots**, assigned to deduped primitives:

- **Spacing:** `space/xs · sm · md · lg · xl · 2xl` — complete = **≥ 4 steps** assigned (✅).
- **Radius:** `radius/sm · md · lg · full` — complete = **≥ 1** (✅).
- **Shadow:** `shadow/sm · md · lg` — complete = **≥ 1** (✅).
- **Border width:** `border-width/default · thick` — complete = `default` (✅).
- **Interaction states:** hover + active shades exist for `color/action/primary` (✅ — counted via B.1).

### B.4 Context → role derivation hints (FR-14)

Strongest signal first (per `DECISIONS.md` §2.4): `authoredName` always wins
when parseable. Then:

| Context signal | Candidate role |
|---|---|
| `background-color` on `body`/`main`/`html` | `color/surface/page` |
| `background-color` on `button` / `[role=button]` | `color/action/primary` (or `secondary` by frequency rank) |
| `background-color` elsewhere | `color/surface/card` |
| `color` on `h1–h3` | `color/text/primary` + `type/heading` |
| `color` on `p`/`body` | `color/text/primary` + `type/body` |
| `color` on `a` | `color/text/link` |
| `border-color` | `color/border/default` |
| any color with `state: hover/active` | matching `color/action/primary-*` |
| `[role=alert]` / `aria-invalid` context | `color/feedback/*` |
| `box-shadow` value | `shadow/*` slot by size rank |
| spacing values | `space/*` slots by ascending size |

Unmatched tokens stay primitives — a role is never forced (FR-16).

### B.5 Completeness checklist (FR-18) = the ✅ rows above

12 color roles + body-plus-one type roles + the scale minima. The checklist UI
shows each unmet ✅ item as a specific, actionable gap ("No `space/*` scale yet
— assign at least 4 spacing steps").

---

## Appendix C — Derivation algorithms (derivation-first completion, FR-19)

Decided 2026-07-05. All color math in **OKLCH** (culori). Every derived value:
`derivedFrom` (anchor id) + method params recorded; badged in UI; provenance
in exports; AA-checked. Deterministic — same anchors, same output.

### C.1 Anchors (the puzzle corners)

| Anchor | Detection | User-swappable |
|---|---|---|
| Primary color | max(occurrences × context weight); `background-color` on button/action ×2, `authoredName` mentioning primary/brand ×3 | step 2 |
| Body typography | most frequent typography token | step 2 |
| Base spacing | most frequent value snapped to the 4px grid | step 2 |

### C.2 Interaction states (monochromatic — always derived)

From primary (and any accent) in OKLCH: hover `L −0.06`, active `L −0.12`
(clamp L ≥ 0.15); disabled bg = `C ×0.15, L → 0.92`, disabled text =
`C ×0.2, L → 0.72`. Focus ring = primary. White-text check: if primary fails
AA with white, derive `-text-on` guidance instead of pretending.

### C.3 Tinted neutrals (always derived)

Brand hue, chroma clamped ≤ 0.02: text-primary `L 0.22`, text-muted `L 0.52`,
surface-page `L 0.985`, surface-card white, border `L 0.90`. Matches the
"neutrals that secretly carry the brand hue" pattern.

### C.4 Feedback colors (capture harvest → convention + brand character)

Three-tier precedence for each feedback role (`success`, `warning`, `error`,
`info`):

1. **Captured + assigned** — role already filled (e.g. `div[role=alert]` →
   `color/feedback/error`). Derivation never overwrites.
2. **Harvest** — scan unassigned color tokens for semantic signals (authored
   name, keyword in source/selector, expanded B.4 context, then OKLCH hue
   band). One token per role; tie-break: confidence → occurrences → id.
   Skip hue-only matches within 15° of primary unless a keyword/authored name
   names the role explicitly.
3. **Derive** — conventional hues wearing the brand's chroma (fallback).

**Derived formula** — not free color theory; hues are conventional (learned),
character is the brand's:

| Role | OKLCH hue | Chroma | Lightness |
|---|---|---|---|
| error | 25° | `max(0.08, min(brand C, 0.18))` | tuned until AA ≥ 4.5 vs surface-card |
| warning | 70° | idem | idem (fill-only if text fails — pair with `-text` variant) |
| success | 150° | idem | idem |
| info | 250° | idem | idem |

**Collision guard:** if `|primary.h − feedbackHue| < 20°`, start lightness
at `0.56` (ΔL −0.08) before AA tuning so success on a green brand does not
merge visually with the primary.

Harvest provenance: `harvested from capture — …`. Derivation provenance:
`feedback {role} (conventional hue, brand chroma, AA-tuned)`.

### C.5 Accent suggestion (color-wheel theory — suggest, never impose)

Only when the capture contains **no second hue** (all captured colors within
±40° of primary). Compute three candidates by hue rotation from primary
(same C and L, then AA-tuned):

- **Complementary** `+180°` — maximum tension/pop.
- **Split-complementary** `+150°` (mirror `−150°` as alt) — contrast without
  clash. **General default.**
- **Analogous** `+30°` — harmony, low tension.

Suitability rule for the default: brand `C > 0.17` (already vibrant) →
analogous; brand `C < 0.09` (muted) → complementary; otherwise
split-complementary. Presented as a dismissible suggestion card with a
wheel-switcher across all three; never auto-assigned to a role.

### C.6 Type scale (modular)

From body anchor size × ratio (default **1.25**, options 1.2 / 1.333):
caption `÷ratio`, body `×1`, subheading `×ratio`, heading `×ratio²`, display
`×ratio³`; round to 0.5px; line-heights 1.4 / 1.5 / 1.3 / 1.2 / 1.1; weights
from captured (heading weight = max captured, else 700). Captured typography
claims its slot first; only empty slots derive.

### C.7 Spacing / radius / shadow ramps

- **Spacing:** from base `b` (C.1): `b/2, b, b×1.5, b×2, b×3, b×4` snapped to
  the 4px grid, deduped against captured values (captured claims its slot).
- **Radius:** captured base → sm `×0.5`, md `×1`, lg `×2` (round to px).
- **Shadow:** reuse the captured shadow color/opacity; geometry ramp sm
  `0 1 2 0`, md `0 4 8 −2`, lg `0 12 24 −4`. No captured shadow → neutral
  ink at 8% opacity.

### C.8 Cascade rules

Derived tokens regenerate when their anchor changes. `userEdited: true`
values are **never** regenerated (a "reset to derived" affordance exists per
value). Captured > edited > derived is the precedence for role slots.

---

*PRD version: draft v2.2 — review + completion is core; completion is
derivation-first (FR-19, Appendix C). 2026-07-04: typography dup key includes
`lineHeight` (A.4); Appendix B role taxonomy; naming = slash-nested; project
name derived + editable (§16). 2026-07-05: FR-19 revised to derivation-first;
Appendix C added.*
