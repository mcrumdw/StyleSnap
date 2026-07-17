# StyleSnap Web Extension — Design

**Surface:** Browser/Web Extension (Chrome MV3 · side panel + in-page picker)
**Owner:** Murtaza Hassani · **Branch:** `murtaza`
**Status:** Working draft — aligned with [UX.md](./UX.md). Brand values here are *provisional*
and defer to the team [`../DESIGN.md`](../DESIGN.md) once it's filled in.

> **Relationship to the team design doc.** The team `DESIGN.md` is still all `<TODO>`.
> Until brand tokens land, this extension uses a neutral dark UI + a single accent that
> reskins cleanly. When the team palette is decided, replace the values in §2 and the CSS
> variables in [`src/sidepanel/styles.css`](./src/sidepanel/styles.css) — nothing else
> should need to change.

---

## 1. Mood / vibe

**One sentence:** A quiet, precise instrument that disappears into the page — StyleSnap
feels like a designer's loupe, not a dashboard.

The extension lives *on top of other people's websites*, so its own personality must be
restrained: dark, calm, monospace-for-values, one confident accent. The user's attention
belongs on the page they're picking from, not on our chrome.

References (vibe):
- Browser DevTools "inspect element" — but warmer and with zero clutter
- Raycast / Linear command surfaces — dark, fast, keyboard-friendly
- macOS color-picker loupe — a single precise tool, nothing extra

Anti-references (explicitly **not**):
- A heavy floating toolbar that covers page content
- A colorful marketing-y popup with onboarding carousels
- A "scan the whole site" auto-audit dashboard

## 2. Color palette

Provisional, mirrors the CSS variables in `styles.css`. Swap to team brand when ready.

### Surfaces & text (side panel — dark)

| Token (CSS var) | Hex | Where it shows up |
|---|---|---|
| `--bg` | `#0F1115` | Side-panel background |
| `--surface` | `#181B22` | Token rows, toggle button |
| `--surface-2` | `#20242D` | Count badges, hover fills |
| `--text` | `#F3F4F6` | Primary text, token values |
| `--muted` | `#9AA1AD` | Source labels, captions, secondary buttons |
| `--border` | `#2A2F3A` | Row borders, dividers |

### Accent & status

| Token | Hex | When used |
|---|---|---|
| `--accent` | `#6E56F7` | Primary button, active pick toggle, **in-page pick outline** |
| `--ok` | `#22C55E` | Capture-confirm pulse, copy-success toast |

**Critical constraint — the in-page overlay.** The pick outline (`--accent`) and inspector
chip (`#111317` bg / white text) render over *arbitrary* websites. They must stay legible
on any background, so the chip is always dark-solid with a high-contrast border, never
semi-transparent over unknown content. This consistent accent outline is the recognizable
"StyleSnap is active" signal.

## 3. Typography

| Role | Font | Why |
|---|---|---|
| UI / labels | system-ui stack | Native, fast, no web-font load inside the panel |
| **Token values** | `ui-monospace` (SF Mono / Menlo) | Hex, px, font specs read as *data* — monospace makes them scannable and copy-trustworthy |

Sizes:
- Wordmark: 15px / 700
- Group title (Color, Typography…): 11px / uppercase / letter-spacing 0.06em
- Token value: 13px monospace
- Source label & caption: 11px muted
- Buttons: 13px / 600

## 4. Component principles

- **Token rows:** one swatch/preview + monospace value + dim source + remove (×). Calm,
  uniform, scannable — the list is the product, so rows never compete for attention.
- **Buttons:** filled accent = the one primary action ("Copy to StyleSnap"); everything
  else is ghost/outline. Min height 44px (touch + a11y).
- **Pick toggle:** state is unmistakable — `Start picking` (neutral) vs. `Picking… (Esc to
  stop)` (accent fill). The label always tells you how to exit.
- **Empty state:** a single calm line that points at the next action, never a graphic-heavy
  illustration. "Nothing picked yet. Start picking and click anything on the page."
- **In-page overlay:** outline + chip only. No buttons, no panels floating over the page.
  Capture confirms with a 250ms green pulse, then returns to accent — feedback without a modal.
- **Toast:** pill, bottom-center, auto-dismiss ~2.2s. Used only for success confirmation.

## 5. Voice / microcopy

Calm, second-person, action-first. No exclamation marks, no jargon. (Full table in
[UX.md §7](./UX.md).)

| Where | Text |
|---|---|
| Toggle (idle) | `Start picking` |
| Toggle (active) | `Picking… (Esc to stop)` |
| Empty state | `Nothing picked yet. Start picking and click anything on the page.` |
| Copy success | `Copied {n} tokens — paste into StyleSnap` |
| Restricted page | `Picking doesn't work on this page.` |

## 6. Logo / wordmark

- **Product name:** StyleSnap
- **In-panel wordmark:** `Style` in `--text` + `Snap` in `--accent`, 700 weight — a tiny,
  text-only mark suited to the narrow panel header. No icon lockup needed at this size.

## 7. Out of scope (this surface)

- Light-mode theming of the side panel (dark-only for MVP)
- Custom web fonts inside the panel
- An animated/illustrated empty state
- Any branding on the in-page overlay beyond the accent outline + chip

---

*Extension DESIGN.md — draft v1. Reskins to team `../DESIGN.md` once brand tokens land.*
