# StyleSnap Web Extension — Design

**Surface:** Browser/Web Extension (Chrome MV3 · side panel + in-page picker)
**Owner:** Murtaza Hassani · **Branch:** `murtaza`
**Status:** Aligned with team [`../DESIGN.md`](../DESIGN.md) (bold & expressive, light-first).

> **Relationship to the team design doc.** The side panel uses the same brand
> tokens, typography, hard-offset shadows, and component rules as the web app.
> Values live as CSS variables in [`src/sidepanel/styles.css`](./src/sidepanel/styles.css)
> — do not invent hex/size values that aren't in the team `DESIGN.md`.

---

## 1. Mood / vibe

Same as the web app: **confident, playful, unmistakably StyleSnap** — warm
off-white canvas, electric indigo, chunky 2px borders, hard offset shadows.

The extension still lives *on top of other people's websites*, so the **in-page
overlay** stays minimal (outline + chip only). The **side panel** carries the
full brand personality so capture → paste into the webtool feels like one product.

---

## 2. Color palette

Mirrors team `DESIGN.md` §2. CSS vars in `styles.css`:

| Token | Hex | Where |
|---|---|---|
| `brand-primary` | `#5B2EFF` | Primary CTA, active pick toggle, pick outline |
| `brand-pop` | `#FFD23D` | Token-count chip |
| `surface-page` | `#FAF8F5` | Panel background, card headers |
| `surface-card` | `#FFFFFF` | Cards, header/footer chrome |
| `text-primary` | `#14121F` | Headings, body, toast text |
| `text-muted` | `#6B6878` | Captions, selectors |
| `border-default` | `#14121F` | 2px borders, hard shadows |
| `success` | `#1FB877` | Toast fill, capture-confirm pulse |

**In-page overlay exception.** The inspector chip uses solid `text-primary` fill +
white text + `brand-primary` border so it stays legible over *arbitrary* page
backgrounds. Do not make the chip semi-transparent.

---

## 3. Typography

Same families as the web app (bundled via `@fontsource` in the side panel):

| Role | Font |
|---|---|
| Wordmark / empty heading | Space Grotesk 700 |
| UI / buttons | Inter 400–600 |
| Token values, selectors | JetBrains Mono 500 |

Sizes from team `DESIGN.md` §3 (section header for empty state; caption/badge
for dense list chrome). Dense side-panel swatches are **32×32** (spacing scale)
vs the workspace's 48×48 token cards.

---

## 4. Component principles

- **Cards:** `surface-card`, 2px `border-default`, `radius-md`, `shadow-card`.
- **Buttons:** primary / secondary / ghost with signature press
  (`translate(2px,2px)` + shadow collapse). Min height 44px.
- **Pick toggle:** idle = secondary; active = primary fill + "Picking… (Esc to stop)".
- **Empty state:** oversized heading + muted one-liner (DESIGN.md §5/§6 voice).
- **Toast:** `success` fill, `text-primary` label, 2px border, `shadow-card`.
- **In-page overlay:** outline + chip only — no floating panels on the page.

---

## 5. Voice / microcopy

Panel chrome keeps the extension UX.md action labels; empty state shares the
webtool's "Nothing snapped yet" voice (DESIGN.md §9).

| Where | Text |
|---|---|
| Toggle (idle) | `Start picking` |
| Toggle (active) | `Picking… (Esc to stop)` |
| Empty state | `Nothing snapped yet` + `Start picking and click any element on the page.` |
| Copy success | `Copied {n} tokens — paste into StyleSnap` |
| Restricted page | `Picking doesn't work on this page.` |

---

## 6. Logo / wordmark

Matches web `Wordmark`: Space Grotesk 700, "**Snap**" in `brand-primary`.

---

## 7. Out of scope (this surface)

- Dark-mode theming of the side panel (team DESIGN.md §12 — light-first)
- Whole-page auto-scan
- Editing token values in the extension (capture only)

---

*Extension DESIGN.md — v2. Aligned with team DESIGN.md v1.1.*
