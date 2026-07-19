# Extension capture → coherent `design.md` (v2)

**Status:** Implemented with schema **2.1**. Inventory of what we capture today vs what
feeds each `design.md` section so AI coding agents can reproduce a coherent UI.

## Capture matrix (browser)

| Signal | v2.0 | v2.1 | `design.md` target |
|---|---|---|---|
| Color (bg / text / border) | yes | yes + outline/focus | Color roles |
| Gradient | yes | yes | Color · Gradient |
| Typography | text nodes | headings even if short text | Typography |
| Spacing | paddingTop + gap | per-side padding/margin, row/col gap | Foundations · Components |
| Radius / border-width | top only | four corners when unequal; sides | Foundations · Components |
| Shadow | box-shadow | + text-shadow as shadow layers | Foundations |
| `context.state` | always `default` | hover / focus / disabled when detectable | Color states · Components |
| `authoredName` | Tailwind-ish classes | + CSS `var(--*)` | Role derivation |
| Layout recipe | — | `context.layout` on tokens | Components · Layout notes |
| Page foundations | — | `meta.foundations` (scan) | Breakpoints · Motion · z-index · Agent rules |
| Pattern multi-pick | — | parent+self share `patternId` | Denser Components |

## `design.md` section map

1. **Rules for the coding agent** — append measured constraints (spacing grid, breakpoints, motion default, content max-width, focus ring) from `meta.foundations` + insights.
2. **Color / Typography / Foundations** — richer primitives; emit Breakpoints / Motion / z-index when scanned.
3. **Components** — sketches gain padding sides, hover/focus, layout flex/grid/gap/max-width.
4. **Mood & voice** — Layout / Motion prefilled from capture when System notes empty (editable); Mood / Voice stay human.
5. **Gaps** — only true unknowns; omit “never capturable” lines when foundations were scanned.

## Out of scope

Scraping marketing copy as voice · whole-site dumps · auto-finalizing roles · full component reconstruction (PRD V3).
