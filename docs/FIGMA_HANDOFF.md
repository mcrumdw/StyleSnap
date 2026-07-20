# Figma handoff (web → plugin)

How StyleSnap’s cleaned JSON becomes Figma Variables and Styles. Contract:
`docs/figma-handoff.ts`. Product decision: DECISIONS §2.66 / PRD FR-26.

## Flow

1. User reviews tokens in the web app, then **Share with Figma** (copy/download).
2. JSON includes the capture envelope plus additive fields:
   - `roles` — `role → tokenId`
   - `figmaHandoff` — versioned create plan (`"1.0"`)
3. Paste into the plugin **Import** tab → preview → Create.

Envelope validation (`parseStyleSnapExport`) ignores `roles` / `figmaHandoff`.
Older JSON without `figmaHandoff` still imports via the legacy path (paint
styles + one `StyleSnap` FLOAT collection) with a soft warning.

## Collections & styles

| Layer | Figma target |
|---|---|
| Color / spacing / radius / border-width **primitives** | Variables in **`StyleSnap / Primitives`** (`COLOR` / `FLOAT`) |
| Matching **roles** | Variables in **`StyleSnap / Semantic`** that **alias** the primitive |
| Color **roles** (extra) | Paint Styles named like the role, fill bound to the semantic COLOR var |
| Type roles (+ unused type primitives) | Text Styles |
| Gradients | Paint Styles only (no COLOR variable) |
| Drop / inset / backdrop-blur | Effect Styles |

One primitive with many roles → one semantic variable **per role**, all aliasing
the same primitive. Names stay slash-nested (`color/action/primary`); the plugin
only sanitizes illegal characters (`.` → `-`).

## Idempotency

Create skips assets whose names already exist. It does not overwrite. Re-import
after a partial run is safe.

## Plugin entry points

- `plugin/src/create.ts` — `createAssets` prefers `figmaHandoff`; else legacy.
- `plugin/src/code.ts` — validate/preview kinds:
  `variable-primitive` | `variable-semantic` | `paint-style` | `text-style` |
  `effect-style` (legacy also uses `variable`).

## Out of scope (for now)

Dark-mode / multi-mode collections, overwriting existing assets, full W3C DTCG
export (can map later from `figmaHandoff`).

---

## Reverse: Figma → web (new capture)

After editing Variables/Styles in Figma (or creating new styles), use the plugin
**Export** tab → **Export Variables & Styles** → **Copy to StyleSnap**, then
paste into the web app as a normal capture.

| Source | Included |
|---|---|
| `StyleSnap / Primitives` + `StyleSnap / Semantic` | COLOR/FLOAT variables (aliases resolved; default mode) |
| All local Paint / Text / Effect Styles | Including styles you create in Figma |

**Dedup:** keep **every distinct system-role path** from Color / Text / Effect
styles and Semantic Variables (`color/feedback/warning`, `type/body`,
`shadow/md`) even when values match. Drop only non-role hex/primitive
duplicates of those values. Bound Paint Styles resolve through their COLOR
Variable.

**Key file:** `plugin/src/export-system.ts` (DECISIONS §2.67).
