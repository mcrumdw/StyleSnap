# StyleSnap — Demo script (the golden path)

**Target: under 10 minutes, runnable by anyone.** Everything you need is in
this repo — no accounts, no backend. Work is auto-saved to localStorage, so a
mid-demo refresh is harmless (recover point: just reload).

**Prep (before the demo):** open the app (deployed URL or `npm run dev` →
http://localhost:5173) and have these two files ready to drag:

- `docs/fixtures/capture-browser-messy.json`
- `docs/fixtures/capture-figma-clean.json`

Optional wow-closer: a Claude Code / Cursor window open on any small project.

**Chrome you'll use:** a **4-step pipeline** at the top — Clean up → Give
meaning → Fill gaps → Review & export. One primary button walks you forward;
steps are never locked (keyboard `1`–`4` jumps anywhere).

---

## 1. Import the mess (~1 min)

1. Drag `capture-browser-messy.json` onto the paste zone.
   → "Imported 31 tokens from lumen.app (browser extension)."
2. Drag `capture-figma-clean.json` the same way. The pool appends — 40 tokens,
   both sources shown in the header.

**Say:** *"Two teammates captured the same product — one from the live site,
one from Figma. Raw, unnamed, full of near-duplicates. This is the real input."*

**Flex (10 s):** paste `capture-malformed.json` instead — a friendly error
listing exactly what's wrong, nothing crashes, nothing gets added.

## 2. Step 1 — Clean up (~2 min)

1. You're on **1. Clean up** by default. Point at the DUP/SIM badges in
   **Color**.
2. The brand blue appears four ways — visually identical, all flagged into one
   cluster.
3. Click **Review cluster** on the blue. The dialog ranks the canonical first.
4. Click **Merge into this.** → toast: *"Nice — 5 colors just became 1. Next:
   give them meaning."*
5. Point out what did **not** merge: the hover blue (a real state), and the
   uppercase tracked label never merges into the caption.
6. Click **Un-merge** once, then re-merge — nothing is destructive until Create
   System on step 4.
7. Click the primary CTA: **Next: give your colors meaning** (or press `2`).

**Say:** *"Detection only flags. A human merges. And every merge is
reversible."*

## 3. Step 2 — Give meaning (~3 min)

1. Figma tokens show as dashed suggestions in gap slots — confirm a few.
2. Use the visual primitive picker (swatches in the dropdown) for browser
   tokens — assign `color/surface/page`, `color/action/primary`, hover role.
3. Rename the merged blue inline: `color/brand-blue`. Note the **"3 roles"**
   badge when one value backs several semantics.
4. Click **Next: fill the gaps** (or `3`).

**Say:** *"Slash-nested names — Figma Variables' native format. One value, many
roles."*

## 4. Step 3 — Fill gaps (~1 min)

1. Required gaps listed inline — no drawer, no scroll wall.
2. On `color/border/focus`, click **Add token** — form opens pre-set. Save.
3. Or **Assign role** — jumps to step 2 and highlights that slot.
4. Click **Review & export** (or `4`).

**Say:** *"The checklist knows what a complete system needs. Nothing is guessed
silently."*

## 5. Step 4 — Review & export (~2 min)

1. Scroll the **System** summary — one value, many uses, primitives strip.
2. Click **Create System** → lightweight confirm (stats + gap warning).
   Confirm. Merges lock.
3. **Copy design.md** from the primary CTA or the export section below.
4. Switch to **Cleaned JSON** tab → note: *"No backend — this file IS the save."*

## 6. The payoff (~1 min)

Paste the copied design.md into Claude Code / Cursor and prompt:

> Using the design system below, build a small pricing card with a primary
> CTA button and a muted caption. Use only tokens from the file; if something
> is missing, follow its §Gaps rule.

**Close:** *"From messy capture to an AI-ready design system in under ten
minutes — four steps, one button."*

---

## Recover points

| If… | Then… |
|---|---|
| The tab crashes or you refresh | Reload — the localStorage draft restores everything including your step. |
| An import goes weird | Expand **Import another capture** → **Start over**. |
| You merged the wrong thing | Un-merge on step 1 (before Create System). |
| Clipboard copy fails | Use Download in the export section on step 4. |
| You need to jump back | Click any step number in the bar, or press `1`–`4`. |
