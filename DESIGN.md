# StyleSnap — Design

**Status:** Filled v1 · direction = **bold & expressive**. Values below are build-ready; refine as the UI develops.

**Why this file exists.** StyleSnap should look like *our* tool — not a generic default UI. The design decisions made here will be visible on every screen for the rest of the build.

**Who owns this.** makram (web application). Colors below should be mirrored into the app's Tailwind config so the team uses utility classes (e.g. `bg-brand-primary`).

---

## 0. Instructions for the coding agent

Read this before generating any UI. These are hard rules, not suggestions:

- **Use only the tokens and values defined in this file.** Never hardcode a hex color, font size, spacing value, radius, or shadow that isn't listed here.
- **If a value you need isn't defined,** propose it and flag it in your output (e.g. `// NEW TOKEN — needs sign-off`) rather than silently inventing one.
- **Reference tokens by name** (Tailwind utility classes such as `bg-brand-primary`, `p-4`), not raw values, so the design stays editable in one place.
- **Match the existing patterns** — when in doubt, mirror a screen or component already specified here rather than introducing a new style.
- **Respect the accessibility rules in §11** on every screen.

**Unit & format convention:** rem-based. **Every value in this file is defined as a custom token in `tailwind.config`** (colors, radii, shadows, fonts, the 13px caption size, button heights) — never approximate to a default Tailwind step and never use arbitrary values like `h-[52px]`. Where a value happens to equal a default Tailwind token (16px → `text-base`, 24px → `p-6`), use it; otherwise the config defines it.

---

## 1. Mood / vibe

**Confident, playful, and unmistakably ours — a creative tool that looks like it has an opinion.** Clean neutral canvas, oversized bold type, electric color, and chunky tactile surfaces ("minimalist maximalism"). It should feel energetic and hands-on, not corporate.

References that capture the vibe:

- **Gumroad** (gumroad.com) — neobrutalist confidence: hard offset shadows, bold dark borders, bright flat color, oversized type.
- **2025/26 expressive web trend** — vibrant accent colors, oversized bold headlines, sunny-yellow highlights, gradients used with restraint.
- **Framer / Spline marketing sites** — expressive type and motion over a calm canvas.

Anti-references — what we are explicitly **not** trying to look like:

- Default Material Design or stock Bootstrap.
- Flat gray "enterprise SaaS" with timid type and no personality.
- Heavy glassmorphism / blurry translucency everywhere.

## 2. Color palette

Paste these into the Tailwind config so utility classes are available (e.g. `bg-brand-primary`).

### Brand & surfaces

| Token | Hex | Where it shows up |
|---|---|---|
| `brand-primary` | `#5B2EFF` | Primary actions, brand, active nav, links |
| `brand-accent` | `#FF4D8D` | Accents, highlights, secondary CTAs, selection |
| `brand-pop` | `#FFD23D` | Badges, "new"/highlight chips, celebratory moments |
| `surface-page` | `#FAF8F5` | App background (warm off-white, not stark) |
| `surface-card` | `#FFFFFF` | Cards, panels, inputs |
| `text-primary` | `#14121F` | Headings & body (near-black, violet-tinted) |
| `text-muted` | `#6B6878` | Secondary text, captions, metadata |
| `border-default` | `#14121F` | Bold card/input borders, dividers (signature dark stroke) |
| `focus-ring` | `#5B2EFF` | Keyboard focus outline (see §11) |

### Interactive states

| Token | Hex | When used |
|---|---|---|
| `brand-primary-hover` | `#4A21E0` | Hover on primary buttons/links |
| `brand-primary-active` | `#3D17C2` | Pressed state |
| `error-hover` | `#B91C1C` | Hover on destructive buttons |
| `state-disabled-bg` | `#ECEAF2` | Disabled control background; skeleton shimmer |
| `state-disabled-text` | `#A8A4B5` | Disabled control text |

### Semantic / feedback

Each feedback color has a **fill** token and an **on-light text** token. This
split exists because the fills don't reach WCAG AA (4.5:1) as text on our light
surfaces (measured: success 2.6:1, info 3.4:1) — see §11.

| Token (fill) | Hex | Token (text on light) | Hex | Meaning |
|---|---|---|---|---|
| `success` | `#1FB877` | `success-text` | `#0E7A4E` | Confirmation, valid input, "merged" |
| `warning` | `#F5A623` | `warning-text` | `#92400E` | Caution, incomplete system |
| `error` | `#DC2626` | *(error itself — 4.8:1 on white)* | — | Errors, destructive actions |
| `info` | `#2E8BFF` | `info-text` | `#1D6FD8` | Neutral information |

**Usage rule:** `success` / `warning` / `info` / `brand-pop` / `brand-accent`
are **fills, borders, and icons only** — never text on light surfaces. Text on
those fills is `text-primary` (all pairs ≥ 5.9:1). Text *about* a state on a
light surface uses the `-text` variant. `error` is the one exception usable
both ways (white text on `error` fill = 4.8:1; `error` text on white = 4.8:1).

> `error` was darkened from `#F23030` (4.0:1 with white — failed AA on the
> destructive button) to `#DC2626` on 2026-07-04.

**Dark mode:** **Not in scope for v1.** The warm-canvas + dark-border identity is light-first; a dark theme is a deliberate later effort (see §12).

## 3. Typography

| Role | Font | Weights | Why |
|---|---|---|---|
| Heading | **Space Grotesk** | 500, 700 | Geometric, characterful, reads bold and expressive at large sizes |
| Body | **Inter** | 400, 500, 600 | Highly readable workhorse for dense token UIs |
| Monospace (tags, token names, code) | **JetBrains Mono** | 400, 500 | Token values/names are code-like; mono reinforces the "tool" feel |

**Font loading:** Google Fonts (`Space Grotesk`, `Inter`, `JetBrains Mono`) via a `<link>` in `index.html` or `@fontsource` packages. All three are free.

Sizes & line-heights (reference values — oversized headings are intentional):

| Role | Size | Line-height | Font |
|---|---|---|---|
| Page title | 48px | 1.05 | Space Grotesk 700 |
| Section header | 30px | 1.15 | Space Grotesk 700 |
| Card title | 20px | 1.30 | Space Grotesk 500 |
| Body | 16px | 1.50 | Inter 400 |
| Caption | 13px | 1.40 | Inter 500 |

## 4. Foundations (spacing, radius, shadow, layout)

### Spacing scale

Use only these steps (px): **4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96**. Maps to Tailwind `1 / 2 / 3 / 4 / 6 / 8 / 12 / 16 / 24`.

### Border radius

| Token | Value | Where |
|---|---|---|
| `radius-sm` | 8px | Inputs, badges, chips |
| `radius-md` | 14px | Cards, buttons |
| `radius-lg` | 24px | Modals, large surfaces |

### Shadow / elevation

The **hard offset shadow is our signature** — solid, no blur.

| Token | Value | Where |
|---|---|---|
| `shadow-card` | `4px 4px 0 0 #14121F` | Resting cards, buttons |
| `shadow-modal` | `8px 8px 0 0 #14121F` | Overlays, popovers |

### Layout & breakpoints

- **Container max-width:** 1200px
- **Grid:** 12 columns, 24px gutters
- **Breakpoints:** **desktop-first** — v1 targets `>1024px` only (PRD §17: mobile layout out of scope). Tailwind defaults (`sm 640 / md 768 / lg 1024 / xl 1280`) are reserved for later; don't build responsive variants in v1.

### Layering (z-index)

Use only these steps: content `0` · sticky header `10` · dropdown/popover `40` · modal overlay + modal `50` · toast `60`.

## 5. Component principles

The *feel* in one line, then the concrete defaults the agent must use.

- **Cards:** Tactile and bordered, never floating-soft. → `surface-card` bg, **2px solid `border-default`**, `radius-md`, `shadow-card`, padding 24px.
- **Buttons:** Chunky and confident; they react physically.
  - Variants: `primary` (`brand-primary` bg, white text), `secondary` (`surface-card` bg, dark border), `ghost` (transparent, no border), `destructive` (`error` bg, white text).
  - All non-ghost buttons: 2px `border-default`, `radius-md`, `shadow-card`.
  - Sizes: sm = 36px tall / 12px horizontal padding · md = 44px / 16px · lg = 52px / 24px. (`sm` is for dense desktop lists only — see the touch-target rule in §11.)
  - States (all variants): active → translate (2px, 2px) + shadow collapses to `0 0` (the "press"); disabled → `state-disabled-bg` + `state-disabled-text`, no border shadow; loading → spinner + disabled.
  - Hover per variant: `primary` → `brand-primary-hover` bg · `secondary` → `surface-page` bg · `ghost` → `state-disabled-bg` bg · `destructive` → `error-hover` bg.
- **Inputs / forms:** `surface-card` bg, 2px `border-default`, `radius-sm`; focus shows `focus-ring`; error state uses `error` border + message.
- **Modal:** `radius-lg`, `shadow-modal`, 2px border; overlay `rgba(20, 18, 31, 0.5)`.
- **Empty states:** Oversized heading + one-line `text-muted` + a single primary CTA. Lean into personality (see §9 voice).
- **Drag affordance (import & token cards):** 2px **dashed** `border-default` at rest; on drag-over, border + tint switch to `brand-primary`.

### 5.1 Token-workspace components

The workspace is the product — these are the most-seen elements. Use only tokens defined above.

- **Token card:** standard card (§5) at 16px padding, containing: value preview (below) · token name in **JetBrains Mono 500** (or "unnamed" in `text-muted` italic) · `source` + `occurrences` as caption in `text-muted` · badges/chips top-right. Selected state: border switches to `brand-primary` (still 2px), shadow stays.
- **Value previews:**
  - *Color swatch:* 48×48px, `radius-sm`, 2px `border-default`; opacity < 1 renders over a checkerboard of `surface-card`/`state-disabled-bg`. Hex value beneath in mono caption.
  - *Gradient:* same swatch, gradient fill; kind + angle in mono caption.
  - *Type specimen:* "Ag" rendered in the captured family/weight/size (clamped to 48px), family + size/weight in mono caption.
  - *Numeric chip (spacing / radius / border-width):* mono value (e.g. `16px`) in a chip — `surface-page` bg, 2px `border-default`, `radius-sm` — next to a proportional bar (spacing) or a corner sample (radius).
  - *Shadow:* 48×48px `surface-card` square, `radius-sm`, rendering the actual captured shadow, on a `surface-page` backdrop.
- **Badges** (chip: `radius-sm`, 11px JetBrains Mono 500, 4px/8px padding, 2px `border-default`):
  - *Duplicate:* `brand-accent` fill, `text-primary` label "DUP".
  - *Similar:* `brand-pop` fill, `text-primary` label "~SIM".
  - *Merged:* `success` fill, `text-primary` label "MERGED".
- **Role chip** (derived semantic role, PRD §7.5): `surface-page` bg, 2px `brand-primary` border, `brand-primary` text at 13px mono (6.0:1 on `surface-page` ✓). Unconfirmed roles: dashed border + "?" suffix; confirmed: solid border.
- **Merge dialog:** modal (§5) listing the cluster — canonical candidate first with a `brand-primary` border, members with their per-token distance shown as mono caption. Primary action "Merge into this" · secondary "Keep separate". Post-merge toast uses the §9 voice line.
- **Sensitivity slider (dedup threshold):** track = 4px `border-default`; thumb = 20×20px `brand-primary` circle with 2px `border-default` + `shadow-card`; labels "strict / loose" in caption style. Changing it re-flags live — never re-merges anything automatically.

## 6. Data states

Central to a tool that imports and assembles tokens.

| State | Pattern |
|---|---|
| Loading | Skeleton blocks (rounded `radius-sm`, `surface-card` base with a `state-disabled-bg` shimmer) in the shape of the token grid/cards. |
| Empty | Oversized heading + import CTA. E.g. "Nothing snapped yet" + **Import a capture**. |
| Error | Inline banner: `error` text/icon, 2px `error` border, `radius-md`, plus a retry/fix action. Never a dead end. |

## 7. Iconography

- **Icon set:** **Lucide** (free, consistent, matches the bold stroke). One set only.
- **Default size:** 20px.
- **Stroke:** 2px (matches the chunky borders).

## 8. Motion & interaction

- **Duration / easing:** 150ms `ease-out` default for hovers and small transitions.
- **Signature press:** buttons/cards translate `(2px, 2px)` on active while the hard shadow collapses — the tactile "press" effect.
- **Reduced motion:** respect `prefers-reduced-motion` — drop translate/shimmer, keep instant state changes.

## 9. Voice / microcopy

Snappy, encouraging, a little playful — celebrate progress.

| Where | Text |
|---|---|
| Empty import | "Nothing snapped yet. Drop a capture to begin." |
| After merging duplicates | "Nice — 30 blues just became 1." |
| Export ready | "Your system's ready. Ship it." |
| Invalid file error | "That doesn't look like a StyleSnap capture. Mind checking the file?" |
| Incomplete system warning | "Almost there — a few roles still need a home." |

## 10. Logo / wordmark

- **Product name:** StyleSnap
- **Wordmark style:** "StyleSnap" set in **Space Grotesk 700**, tight tracking. "**Snap**" carries the brand: either `brand-primary` fill or the hard-shadow treatment on a chip. Avoid gradients in the wordmark itself.

## 11. Accessibility

Non-negotiable constraints the agent applies on every screen.

- **Color contrast:** WCAG **AA**, 4.5:1 for normal text. Measured ratios for the approved pairs (2026-07-04): white on `brand-primary` 6.4:1 · `text-muted` on `surface-page` 5.1:1 · white on `error` 4.8:1 · `text-primary` on `brand-pop` 12.8:1, on `warning` 9.1:1, on `brand-accent` 5.9:1, on `success` 7.2:1, on `info` 5.5:1 · `success-text`/`warning-text`/`info-text` on white 5.4 / 7.1 / 4.9:1.
- **The fills-only rule (§2) is an accessibility rule:** `success`, `warning`, `info`, `brand-pop`, `brand-accent` never appear as text on light surfaces (they fail AA: e.g. `success` 2.6:1). White text never sits on `brand-accent` (3.1:1) — use `text-primary`.
- **Focus visibility:** every interactive element shows a visible 2px `focus-ring` (offset 2px) on keyboard focus. Note: on a `brand-primary` surface the ring color matches the background — the 2px offset gap is what keeps it visible, so never remove the offset.
- **Touch/click target:** 44×44px minimum for primary actions. The `sm` (36px) button is permitted only in dense desktop lists/toolbars with ≥ 8px spacing between targets (meets WCAG 2.2 AA target-size; 44px remains the default).
- **Motion:** honor `prefers-reduced-motion` (see §8).

## 12. Out of scope (for now)

- **Dark mode** — light-first for v1.
- **Full component-library documentation** site (Storybook etc.).
- **Internationalization / RTL.**

---

*DESIGN.md version: filled v1.1 (bold & expressive) — derived from a Gumroad-family neobrutalist direction + 2025/26 expressive trends. v1.1 (2026-07-04): accessibility audit — `error` darkened to #DC2626, semantic `-text` variants added, fills-only rule, measured contrast ratios in §11, touch-target scoping, custom-token Tailwind rule, z-index scale, per-variant button states, §5.1 token-workspace components.*
