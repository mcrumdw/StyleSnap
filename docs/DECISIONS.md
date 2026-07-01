# StyleSnap — Decision Log

A running record of the design and architecture decisions behind the StyleSnap
ecosystem, so that documentation, onboarding, and future changes stay grounded
in *why* things are the way they are.

Last updated: 2026-06-29

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

- **Token naming convention.** Must survive a round-trip to both `design.md`
  and Figma Variables (Figma uses `group/subgroup/name` slash nesting). Not yet
  locked.
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
| 2026-06-29 | Added Appendix A (dedup algorithm) to `docs/PRD_webtool_v2.md`: occurrence-led leader clustering; color = OKLab ΔEOK (dup ≤0.02 / similar ≤0.05) via culori; numeric = 1-D gap clustering w/ hybrid tol + 4px grid snap; typography composite key + size-scale; shadow/gradient field epsilons. **Adopted value-based dedup** (survivor inherits all contexts). Removed remaining v0.1 references. | — |
