# StyleSnap — Design

**Status:** Starter design doc · fill in the **`<TODO>`** sections before you tag `design-done`.

**Why this file exists.** StyleSnap should look like *our* tool — not a generic default UI. The design decisions made here will be visible on every screen for the rest of the build.

**Who owns this.** `<TODO: assign owner>`. By the time the team converges to start building shared screens, this file should be filled in and the colors should already be in the app's Tailwind config (or equivalent styling config).

---

## 0. Instructions for the coding agent

Read this before generating any UI. These are hard rules, not suggestions:

- **Use only the tokens and values defined in this file.** Never hardcode a hex color, font size, spacing value, radius, or shadow that isn't listed here.
- **If a value you need isn't defined,** propose it and flag it in your output (e.g. `// NEW TOKEN — needs sign-off`) rather than silently inventing one.
- **Reference tokens by name** (Tailwind utility classes such as `bg-brand-primary`, `p-4`), not raw values, so the design stays editable in one place.
- **Match the existing patterns** — when in doubt, mirror a screen or component already specified here rather than introducing a new style.
- **Respect the accessibility rules in §11** on every screen.

**Unit & format convention:** `<TODO: e.g. "rem-based, follow Tailwind's default spacing scale; sizes in px in this doc are reference only">`

---

## 1. Mood / vibe

One sentence that captures the feeling StyleSnap should leave you with.

`<TODO>`

Two or three references that capture the vibe (links to dribbble shots, screenshots of apps you admire, Pinterest boards — anything visual):

- `<TODO>`
- `<TODO>`
- `<TODO>`

Anti-references — what we are explicitly **not** trying to look like:

- `<TODO>`

## 2. Color palette

These are the colors the build milestones will reference. Once chosen, paste the hex values into the Tailwind config so the rest of the team can use utility classes (e.g. `bg-brand-primary`).

### Brand & surfaces

| Token | Hex | Where it shows up |
|---|---|---|
| `brand-primary` | `<TODO>` | `<TODO>` |
| `brand-accent` | `<TODO>` | `<TODO>` |
| `surface-page` | `<TODO>` | `<TODO>` |
| `surface-card` | `<TODO>` | `<TODO>` |
| `text-primary` | `<TODO>` | `<TODO>` |
| `text-muted` | `<TODO>` | `<TODO>` |
| `border-default` | `<TODO>` | Card/input borders, dividers |
| `focus-ring` | `<TODO>` | Keyboard focus outline (see §11) |

### Interactive states

Define how brand colors shift on interaction so hover/active aren't improvised.

| Token | Hex | When used |
|---|---|---|
| `brand-primary-hover` | `<TODO>` | Hover on primary buttons/links |
| `brand-primary-active` | `<TODO>` | Pressed state |
| `state-disabled` | `<TODO>` | Disabled controls (bg + text) |

### Semantic / feedback

| Token | Hex | Meaning |
|---|---|---|
| `success` | `<TODO>` | Confirmation, valid input |
| `warning` | `<TODO>` | Caution, non-blocking issues |
| `error` | `<TODO>` | Errors, destructive actions |
| `info` | `<TODO>` | Neutral information |

### `<TODO: feature-specific token group>`

| Token | Hex | When used |
|---|---|---|
| `<TODO>` | `<TODO>` | `<TODO>` |

**Dark mode:** `<TODO: supported / not in scope — state the decision either way>`

## 3. Typography

| Role | Font | Weights | Why |
|---|---|---|---|
| Heading | `<TODO>` | `<TODO>` | `<TODO>` |
| Body | `<TODO>` | `<TODO>` | `<TODO>` |
| Monospace (tags, badges, code) | `<TODO>` | `<TODO>` | `<TODO>` |

**Font loading:** `<TODO: e.g. "Google Fonts import in index.html" / "system font stack" — name the exact source so the agent can wire it up>`

Suggested sizes & line-heights (override only if the design demands it):

| Role | Size | Line-height |
|---|---|---|
| Page title | `<TODO>` | `<TODO>` |
| Section header | `<TODO>` | `<TODO>` |
| Card title | `<TODO>` | `<TODO>` |
| Body | `<TODO>` | `<TODO>` |
| Caption | `<TODO>` | `<TODO>` |

## 4. Foundations (spacing, radius, shadow, layout)

The values that govern rhythm and structure. **These are what make every teammate's screen feel like one product** — fill them before building shared screens.

### Spacing scale

`<TODO: define the allowed steps, e.g. 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 px. Agent must only use these.>`

### Border radius

| Token | Value | Where |
|---|---|---|
| `radius-sm` | `<TODO>` | Inputs, badges |
| `radius-md` | `<TODO>` | Cards, buttons |
| `radius-lg` | `<TODO>` | Modals, large surfaces |

### Shadow / elevation

| Token | Value | Where |
|---|---|---|
| `shadow-card` | `<TODO>` | Resting cards |
| `shadow-modal` | `<TODO>` | Overlays, popovers |

### Layout & breakpoints

- **Container max-width:** `<TODO>`
- **Grid / columns:** `<TODO>`
- **Breakpoints:** mobile `<TODO>` · tablet `<TODO>` · desktop `<TODO>`

## 5. Component principles

One short sentence per element (the *feel*), followed by the concrete defaults the agent must use.

- **Cards:** `<TODO: principle>` — radius `radius-md`, bg `surface-card`, shadow `shadow-card`, padding `<TODO>`.
- **Buttons:** `<TODO: principle>`
  - Variants: `primary` / `secondary` / `ghost` / `destructive`
  - Sizes: `<TODO: sm/md/lg heights + padding>`
  - States: default / hover / focus / active / disabled / loading — see color tokens in §2.
  - Radius: `<TODO>`
- **Inputs / forms:** `<TODO: principle>` — border `border-default`, focus uses `focus-ring`, error uses `error`.
- **Modal:** `<TODO: principle>` — radius `radius-lg`, shadow `shadow-modal`, overlay `<TODO>`.
- **Empty states:** `<TODO>`
- **Drag affordance (if used):** `<TODO>`

## 6. Data states

How the UI behaves around data — central to a tool that imports and assembles tokens.

| State | Pattern |
|---|---|
| Loading | `<TODO: skeleton / spinner / where>` |
| Empty | `<TODO: message + CTA>` |
| Error | `<TODO: how failures are shown + recovery>` |

## 7. Iconography

- **Icon set:** `<TODO: e.g. Lucide / Heroicons — pick one>`
- **Default size:** `<TODO>`
- **Stroke / style:** `<TODO>`

## 8. Motion & interaction

- **Transition duration / easing:** `<TODO: e.g. 150ms ease-out>`
- **Hover behavior:** `<TODO>`
- **Reduced motion:** `<TODO: respect prefers-reduced-motion?>`

## 9. Voice / microcopy

Lines of microcopy that capture the tone of the product. Keep it short.

| Where | Text |
|---|---|
| `<TODO>` | `<TODO>` |
| `<TODO>` | `<TODO>` |
| `<TODO>` | `<TODO>` |

## 10. Logo / wordmark

- **Product name:** StyleSnap
- **Wordmark style:** `<TODO>`

## 11. Accessibility

Non-negotiable constraints the agent applies on every screen.

- **Color contrast:** `<TODO: target — default WCAG AA, 4.5:1 for text>`
- **Focus visibility:** all interactive elements show a visible `focus-ring` on keyboard focus.
- **Minimum touch target:** `<TODO: e.g. 44×44px>`
- **Other:** `<TODO>`

## 12. Out of scope (for now)

To keep design tight, the following are explicitly not part of `design-done`:

- `<TODO>`
- `<TODO>`
- `<TODO>`

---

*DESIGN.md version: starter v2 (structure expanded — foundations, color states, data-states, iconography, motion, accessibility, agent instructions)*
