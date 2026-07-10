# StyleSnap — Demo script (the golden path)

**Target: under 5 minutes, runnable by anyone.** No accounts, no backend;
work auto-saves to localStorage — reload anytime and your draft is back.

**Prep:** open the app (`npm run dev` → http://localhost:5173) and have:

- `docs/fixtures/capture-thin.json` (6-token wow opener)
- `docs/fixtures/capture-browser-messy.json` + `capture-figma-clean.json` (full story)

Optional closer: Claude Code / Cursor on any small project.

**Mental model:** import → **complete draft instantly**. StyleSnap picks three
anchors (main color, body type, base spacing) and fills everything else
deterministically. Solid borders = from capture; dashed + **auto** badge =
filled for you. Change only what you disagree with.

---

## 1. The 30-second wow (~1 min)

1. Drag `capture-thin.json` — **6 tokens** from a tiny landing page.
2. You land on **"Your system"** — a full draft: hover/active states, feedback
   colors, neutrals, type scale, spacing/radius/shadow ramps. Zero forms.
3. Point at dashed rows with **auto** badges. Click one → provenance popover:
   *"derived from your main color — hover (ΔL −0.06)"*.
4. If a second hue isn't captured, an **accent card** offers harmony options.
   Switch or dismiss.

**Say:** *"Six tokens in, a complete design system out. We only show what's
automated — click any value for its story."*

Start over for the real dataset (Import another capture → Start over).

## 2. The real mess (~1 min)

1. Drag `capture-browser-messy.json`, then `capture-figma-clean.json` — 40
   tokens from two teammates.
2. Near-duplicates **merge automatically at import** (reversible in Captured
   tokens below). Header notes how many values were filled automatically.
3. Scroll the draft — same complete system, now grounded in a messy real
   capture.

**Say:** *"Detection proposes, we draft — you review by exception, not by
form."*

## 3. Change one thing (~1 min)

1. Click a derived feedback color → edit hex with the color picker (or
   eyedropper). Corner dot marks your edit; export flags it.
2. Expand **Fine-tune — anchors & roles** → swap the main color anchor.
   Watch derived values cascade (your edits stay put).
3. If **Still needs your input** appears, use it for motion/voice notes or
   optional roles — links jump to the right section.

## 4. Ship it (~1 min)

1. Edit project name in the header.
2. **Create System** → lightweight confirm (stats + how much was automated).
3. **Copy design.md** — one-time guardrail if you haven't reviewed auto-filled
   values (*export anyway* is fine — they're flagged in §Gaps).
4. Show **Cleaned JSON** in the export section: *"This file IS the save."*

## 5. Payoff (~1 min)

Paste design.md into Claude Code:

> Using the design system below, build a small pricing card with a primary CTA
> and muted caption. Use only tokens from the file.

**Close:** *"Messy capture → AI-ready design system in under five minutes —
one page, one draft, ship when happy."*

---

## Recover points

| If… | Then… |
|---|---|
| Refresh mid-demo | Reload — draft restores. |
| Wrong merge | **Captured tokens** → Un-merge (before Create System). |
| Clipboard fails | Download from export section. |
| Want the raw grid | **Captured tokens** accordion. |
