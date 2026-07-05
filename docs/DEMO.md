# StyleSnap — Demo script (the golden path)

**Target: under 10 minutes, runnable by anyone.** Everything you need is in
this repo — no accounts, no backend. Work is auto-saved to localStorage, so a
mid-demo refresh is harmless (recover point: just reload).

**Prep (before the demo):** open the app (deployed URL or `npm run dev` →
http://localhost:5173) and have these two files ready to drag:

- `docs/fixtures/capture-browser-messy.json`
- `docs/fixtures/capture-figma-clean.json`

Optional wow-closer: a Claude Code / Cursor window open on any small project.

**Chrome you'll use:** the sticky **SessionBar** (Edit · System · completeness
pill · Create System / Copy) stays visible while you scroll. Gaps live in a
drawer — not a wall at the top.

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

## 2. The 4-blues problem (~2 min)

1. Stay on **Edit · Captured** (default after import). Point at the DUP/SIM
   badges in **Color**.
2. The brand blue appears four ways: `#2E6BFF` · `#2E6CFF` · `#2F6BFE` ·
   `#3067FF` — visually identical, all flagged into one cluster.
3. Click **Review cluster** on the blue. The dialog ranks the canonical
   (most-used) first, with per-token ΔE distances.
4. Click **Merge into this.** → toast: *"Nice — 5 colors just became 1."*
5. Point out what did **not** merge: the hover blue `#2456CC` (a real state,
   not a duplicate), and in Typography the uppercase tracked label never
   merges into the caption.
6. Click **Un-merge** once, then re-merge — nothing is destructive until
   Create System.

**Say:** *"Detection only flags. A human merges. And every merge is
reversible."*

## 3. Roles & names (~3 min)

1. Switch to **Edit · Roles**. Figma tokens show as dashed suggestions in gap
   slots — authored names like `color/action/primary` are the strongest signal.
   Click to confirm one; the row fills with swatch + primitive name.
2. Switch back to **Captured** for browser tokens: confirm suggestions from
   the role picker on cards — body background → `color/surface/page`, the button
   blue → `color/action/primary`, the hover capture →
   `color/action/primary-hover`.
3. Rename a primitive inline: click "unnamed" on the merged blue, type
   `color/brand-blue`. Note the **"3 roles"** badge when one primitive backs
   several semantics.
4. In **Roles**, assign spacing slots (`space/xs` … `space/2xl`) from the
   dropdown — note the 15px capture was merged into 16 earlier, and 12px stays
   deliberately unassigned.

**Say:** *"Slash-nested names — Figma Variables' native format — so the
round trip needs no mapping. One primitive, many roles."*

## 4. Completeness (~1 min)

1. Click the **14/18 required · N gaps** pill in the SessionBar — the gap
   drawer slides in: required gaps in red, optional under "Show optional."
2. On `color/border/focus`, click **Add token** — the form opens pre-set.
   Pick a color, save. Close the drawer; the pill count updates live.
3. Or click **Assign role** on a gap — jumps to **Edit · Roles** and highlights
   that slot.

**Say:** *"The checklist knows what a complete system needs — and what a
capture can never contain (breakpoints, motion, z-index). Nothing is guessed
silently."*

## 5. Create System & export (~2 min)

1. Edit the project name in the SessionBar (prefilled from the Figma file).
2. Click **Create System** in the bar → lightweight confirm: token accounting,
   open-gap warning (no full markdown scroll). Optional: **Preview design.md**
   opens the export drawer. Confirm. Merges lock.
3. If all required items were met, design.md copies automatically — otherwise
   click **Copy design.md** in the bar (one click, any scroll position).
4. Click **Export…** for the full preview + cleaned JSON download.
   Note: *"No backend — this file IS the save."*

## 6. The payoff (~1 min)

Paste the copied design.md into Claude Code / Cursor and prompt:

> Using the design system below, build a small pricing card with a primary
> CTA button and a muted caption. Use only tokens from the file; if something
> is missing, follow its §Gaps rule.

Watch it use `color/action/primary` for the button, `space/md` padding,
`radius/md`, `shadow/sm` — and flag the missing focus color instead of
inventing one.

**Close:** *"From messy capture to an AI-ready design system in under ten
minutes."*

---

## Recover points

| If… | Then… |
|---|---|
| The tab crashes or you refresh | Reload — the localStorage draft restores everything. |
| An import goes weird | Expand **Import another capture** at the bottom → **Start over**. |
| You merged the wrong thing | Un-merge on the survivor card (before Create System). |
| Clipboard copy fails (permissions) | Open **Export…** and use Download instead. |
| You want the read-only mirror | SessionBar → **System** (keyboard `2`). Back to editing: **Edit** (`1`). |
