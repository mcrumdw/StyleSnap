# StyleSnap — Demo script (the golden path)

**Target: under 10 minutes, runnable by anyone.** Everything you need is in
this repo — no accounts, no backend. Work is auto-saved to localStorage, so a
mid-demo refresh is harmless (recover point: just reload).

**Prep (before the demo):** open the app (deployed URL or `npm run dev` →
http://localhost:5173) and have these two files ready to drag:

- `docs/fixtures/capture-browser-messy.json`
- `docs/fixtures/capture-figma-clean.json`

Optional wow-closer: a Claude Code / Cursor window open on any small project.

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

1. Scroll to **Color**. Point at the DUP/SIM badges.
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

1. The Figma tokens arrived pre-suggested (dashed chips with "?") — their
   authored names like `color/action/primary` are the strongest signal.
   Confirm one: the chip goes solid.
2. The browser tokens got derived suggestions: body background → 
   `color/surface/page`, the button blue → `color/action/primary`, the hover
   capture → `color/action/primary-hover`. Confirm a few.
3. Rename a primitive inline: click "unnamed" on the merged blue, type
   `color/brand-blue`.
4. Assign spacing slots (`space/xs` … `space/2xl`) from the role picker —
   note the 15px capture was merged into 16 earlier, and 12px stays
   deliberately unassigned.

**Say:** *"Slash-nested names — Figma Variables' native format — so the
round trip needs no mapping."*

## 4. Completeness (~1 min)

1. Scroll up to the **System completeness** panel: required gaps in red
   (focus ring, success/warning/info feedback colors), recommendations in
   amber, progress bar counting confirmations live.
2. Click **Add token** on the `color/border/focus` gap — the form opens
   pre-set. Pick a color, save. The red row flips to a green chip instantly.

**Say:** *"The checklist knows what a complete system needs — and what a
capture can never contain (breakpoints, motion, z-index). Nothing is guessed
silently."*

## 5. Create System & export (~2 min)

1. Check the project name field (prefilled from the Figma file — edit it).
2. Click **Create System** → preview dialog: token accounting, open-gap
   warning, the full design.md. Confirm. Merges lock.
3. In the export panel: **Copy** design.md. Show the structure — roles first,
   primitives beneath, provenance on every row, §Gaps explicit.
4. Note the cleaned JSON: *"No backend — this file IS the save."*

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
| An import goes weird | "Start over" at the bottom clears the pool. |
| You merged the wrong thing | Un-merge on the survivor card (before Create System). |
| Clipboard copy fails (permissions) | Use the Download button instead. |
