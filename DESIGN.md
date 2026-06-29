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

**Unit & format convention:** rem-based, following Tailwind's default spacing scale. Sizes shown in px below are reference values — implement them as the nearest Tailwind token (e.g. 16px → `text-base`, 24px → `p-6`).

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
| `state-disabled-bg` | `#ECEAF2` | Disabled control background |
| `state-disabled-text` | `#A8A4B5` | Disabled control text |

### Semantic / feedback

| Token | Hex | Meaning |
|---|---|---|
| `success` | `#1FB877` | Confirmation, valid input, "merged" |
| `warning` | `#F5A623` | Caution, incomplete system |
| `error` | `#F23030` | Errors, destructive actions |
| `info` | `#2E8BFF` | Neutral information |

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
- **Breakpoints:** mobile `<640px` · tablet `640–1024px` · desktop `>1024px` (Tailwind `sm 640 / md 768 / lg 1024 / xl 1280`)

## 5. Component principles

The *feel* in one line, then the concrete defaults the agent must use.

- **Cards:** Tactile and bordered, never floating-soft. → `surface-card` bg, **2px solid `border-default`**, `radius-md`, `shadow-card`, padding 24px.
- **Buttons:** Chunky and confident; they react physically.
  - Variants: `primary` (`brand-primary` bg, white text), `secondary` (`surface-card` bg, dark border), `ghost` (transparent, no border), `destructive` (`error` bg, white text).
  - All non-ghost buttons: 2px `border-default`, `radius-md`, `shadow-card`.
  - Sizes: sm = 36px tall / 12px px · md = 44px / 16px · lg = 52px / 24px.
  - States: hover → `brand-primary-hover`; active → translate (2px, 2px) and shadow collapses to `0 0` (the "press"); disabled → `state-disabled-bg` + `state-disabled-text`, no shadow; loading → spinner + disabled.
- **Inputs / forms:** `surface-card` bg, 2px `border-default`, `radius-sm`; focus shows `focus-ring`; error state uses `error` border + message.
- **Modal:** `radius-lg`, `shadow-modal`, 2px border; overlay `rgba(20, 18, 31, 0.5)`.
- **Empty states:** Oversized heading + one-line `text-muted` + a single primary CTA. Lean into personality (see §9 voice).
- **Drag affordance (import & token cards):** 2px **dashed** `border-default` at rest; on drag-over, border + tint switch to `brand-primary`.

## 6. Data states

Central to a tool that imports and assembles tokens.

| State | Pattern |
|---|---|
| Loading | Skeleton blocks (rounded `radius-sm`, `surface-card` → light gray shimmer) in the shape of the token grid/cards. |
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

- **Color contrast:** WCAG **AA**, 4.5:1 for text. Note: `brand-pop` (#FFD23D) and `warning` are **not** legible as text on white — use them as fills/accents with `text-primary` on top, never as text color on light surfaces.
- **Focus visibility:** every interactive element shows a visible 2px `focus-ring` (offset 2px) on keyboard focus.
- **Minimum touch target:** 44×44px.
- **Motion:** honor `prefers-reduced-motion` (see §8).

## 12. Out of scope (for now)

- **Dark mode** — light-first for v1.
- **Full component-library documentation** site (Storybook etc.).
- **Internationalization / RTL.**

---

*DESIGN.md version: filled v1 (bold & expressive) — derived from a Gumroad-family neobrutalist direction + 2025/26 expressive trends.*
