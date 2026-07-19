# StyleSnap Web Extension — UX Spec

**Owner:** Murtaza Hassani · **Branch:** `murtaza` · **Surface:** Chrome Extension (Manifest V3 + React side panel)

This is the "Web Picker" — the secondary capture surface in StyleSnap. It lets a user
click any element on any live website and lift its design tokens (color, typography,
spacing, border-radius, border-width, shadow) into the same `StyleSnapExport` JSON that
the Figma plugin produces, so both feed one webtool.

**Output model (schema v2.0, token-centric).** The export is a flat `tokens[]` list —
the agreed shared contract (`docs/types.ts`, see `docs/DECISIONS.md` §2.4). Each click on
an element produces several tokens that share a **`captureId`** (so the Webtool can
reconstruct which element they came from) and a best-effort **`context`** object
(`cssProperty`, `element`, `ariaRole`, `selector`, `state`, `authoredName`). Semantic roles
(card / button / …) are **not** assigned in the extension — the Webtool *derives* them from
that context. The side panel groups tokens by `captureId` for readability, but exports flat.

> Source of truth for the data shape: [`../docs/types.ts`](../docs/types.ts).
> Never define token shapes locally — import from there.

---

## 1. Job to be done

> "I'm looking at a website I like. I want to grab *these specific things* — that pink,
> that heading font, that card shadow — without opening DevTools and reading computed
> styles by hand."

The extension is a **scalpel, not a scanner.** It does not crawl the page or dump every
style. The user points, we extract exactly what they pointed at, they keep what they want,
they copy the JSON into the webtool. That restraint is the product — it mirrors the PRD's
"clarity over completeness."

## 2. Design principles (inherited + local)

From the PRD's vibe principles:
- **Clarity over completeness** — show the tokens from *this* click, not the whole page.
- **Low friction entry** — no account, no config. Install, pin, click, pick.
- **Confidence** — the user always sees exactly what will be exported before they export it.

Extension-specific:
- **The page is the canvas.** Our UI (overlay + side panel) is chrome around the user's
  real content. Keep it light; never obscure what they're trying to pick.
- **Reversible by default.** Every pick can be removed before export. Nothing is committed
  until "Copy to StyleSnap."

## 3. The two-part UI

### A. In-page pick overlay (content script)
- Activated by a **toggle** ("Pick mode: on/off") from the side panel or extension icon.
- While active: hovering any element draws a **highlight outline** + a small floating
  **inspector chip** near the cursor showing what we'd capture (e.g. `#FF46AF · 16px ·
  Inter 600`). This is the *preview* — confidence before the click.
- **Click captures.** The element's tokens are extracted and added to the picked list.
  A brief confirmation pulse on the outline ("Captured ✓"), pick mode stays on so the
  user can grab several things in a row.
- **Esc** exits pick mode. Clicks while in pick mode do **not** trigger the page's own
  handlers (we `preventDefault`/`stopPropagation`) — picking must never navigate away.

### B. Side panel (React, MV3 `side_panel`)
The persistent workspace. Sections, top to bottom:
1. **Header** — wordmark + pick-mode toggle (primary action).
2. **Picked tokens list** — grouped by type (Color, Typography, Spacing, Radius, Border,
   Shadow). Each row: swatch/preview · value · source element (CSS selector or tag) ·
   remove (×).
3. **Empty state** — when nothing picked yet (see §5).
4. **Footer actions** — `Copy to StyleSnap` (copies `StyleSnapExport` JSON to clipboard)
   and `Clear all`.

## 4. Core flow (happy path)

1. User opens a site → clicks StyleSnap icon → side panel opens.
2. Toggles **Pick mode on**.
3. Hovers → sees inspector chip preview → clicks an element. Token(s) appear in panel.
4. Repeats for a few elements.
5. Reviews list, removes any unwanted rows.
6. Clicks **Copy to StyleSnap** → JSON on clipboard → confirmation toast.
7. Switches to the webtool, pastes alongside Figma tokens. `meta.source =
   "browser-extension"`, `meta.pageUrl` set to the captured page.

## 5. States & edge cases

| State | What the user sees |
|---|---|
| First open, nothing picked | Empty state: short line + "Turn on Pick mode and click anything on the page." |
| Pick mode on, hovering | Outline + inspector chip preview |
| Element has no extractable token | Chip shows "Nothing to grab here" — click does nothing, no empty row |
| Restricted page (`chrome://`, store) | Panel shows "Pick mode can't run on this page" — toggle disabled |
| Duplicate value already picked | Row still added, but flagged subtly ("already picked") — dedupe is the *webtool's* job, we don't block it |
| Copy success | Toast: "Copied N tokens to StyleSnap" |

## 6. Accessibility (PRD: WCAG 2.1 AA)
- Side panel fully keyboard navigable; pick-mode toggle reachable via keyboard.
- Inspector chip and outline use a high-contrast color that adapts to light/dark page bg.
- Touch/click targets ≥ 44×44px in the panel.
- Remove (×) buttons have `aria-label`; list uses semantic groups.

## 7. Microcopy

| Where | Text |
|---|---|
| Toggle (off) | `Start picking` |
| Toggle (on) | `Picking… (Esc to stop)` |
| Empty state | `Nothing snapped yet` + `Start picking and click any element on the page.` |
| Copy button | `Copy to StyleSnap` |
| Copy toast | `Copied {n} tokens — paste into StyleSnap` |
| Restricted page | `Picking doesn't work on this page.` |

## 8. Visual fit with StyleSnap
Side panel matches team `DESIGN.md` / the web app (light canvas, brand-primary,
hard shadows, Space Grotesk / Inter / JetBrains Mono). See [`DESIGN.md`](./DESIGN.md).
The in-page overlay stays minimal — brand-primary outline + solid dark chip so it
reads on arbitrary page content.

## 9. Out of scope (this surface, MVP)
- Whole-page auto-scan / "grab everything"
- Duplicate merging (webtool owns this)
- Editing token values in the extension (capture only)
- Firefox (Chrome primary per PRD; MV3 first)
