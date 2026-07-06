# StyleSnap — Demo script (the golden path)

**Target: under 5 minutes, runnable by anyone.** No accounts, no backend;
work auto-saves to localStorage, so a mid-demo refresh is harmless (recover
point: just reload — you land back on your complete draft).

**Prep (before the demo):** open the app (deployed URL or `npm run dev`) and
have these files ready to drag:

- `docs/fixtures/capture-thin.json` (the 6-token opener)
- `docs/fixtures/capture-browser-messy.json` + `capture-figma-clean.json`
  (the full story)

Optional wow-closer: a Claude Code / Cursor window open on any small project.

**The mental model to narrate:** StyleSnap solves the system like a puzzle
from its corner pieces — it finds three anchors (your main color, your text
style, your base unit) and derives everything else deterministically. You
review a *complete* draft and change only what you disagree with. Every
automated act is confessed: the summary strip counts it, dashed borders mark
it, and clicking any value tells its story.

---

## 1. The 30-second wow (~1 min)

1. Drag `capture-thin.json` onto the paste zone — **6 tokens** from a tiny
   landing page.
2. You land on **"Your system"**: a complete draft. Point at the summary
   strip: *"merges reviewed ✓ · 3 anchors picked · 26 values derived."*
3. Scroll: hover/active states, tinted neutrals, four feedback colors (all
   AA-checked), a full type scale, spacing/radius/shadow ramps — from six
   tokens and zero forms.

**Say:** *"Six tokens in, a complete design system out. Solid borders are
from the capture; dashed means we made it — click one."* (Click a feedback
color → the popover confesses: "conventional hue, brand chroma, AA-tuned".)

4. Notice the **accent card** — the capture has one hue, so StyleSnap offers
   three color-wheel companions (complementary / split / analogous). Switch,
   or dismiss. It never assigns itself.

Start over (Import another capture → Start over) for the real dataset.

**Flex (10 s):** paste `capture-malformed.json` — a friendly error listing
exactly what's wrong; nothing crashes, nothing gets added.

## 2. The real mess + the merge queue (~1.5 min)

1. Drag `capture-browser-messy.json`, then `capture-figma-clean.json` —
   40 raw tokens from two teammates (live site + Figma). You land on the
   complete draft again.
2. The strip confesses **proposed merges**. Click it → the **merge queue**
   ("1 of N"): the four near-identical blues, our survivor preselected, per-
   token ΔE distances shown. **Merge them** → *"Nice — 5 values just became
   1."* Work the queue; **Keep separate** when the app is wrong — it never
   merges on its own. (The full grid with filters lives behind "Show
   everything".)

**Say:** *"Detection only proposes. A human decides. Reversible until Create
System."*

## 3. Anchors, if you disagree (~30 s)

Press `2`. Three plain cards: your main color, your text style, your base
unit. **Swap** the main color → every derived value re-cascades live; swap
back. To show the dirty flag: hand-edit a derived color in step 3 first
(click → type a hex → Save) — the corner dot appears, and no anchor swap
ever touches it. "Reset to derived" undoes the edit.

Below the anchors: the full role-correction panel with visual pickers, for
surgical changes.

## 4. Ship it (~1.5 min)

1. Press `4`. Fill **Mood / vibe** in System notes (one sentence) — the other
   fields stay honest gaps in the export.
2. **Create System** → the dialog confesses the automation ("N of M values
   were made for you") → confirm.
3. **Copy design.md.** The first copy shows a one-time guardrail if anything
   is unreviewed — "Export anyway" never blocks.
4. Paste into Claude Code / Cursor and prompt:

> Using the design system below, build a small pricing card with a primary
> CTA button and a muted caption. Use only tokens from the file; if something
> is missing, follow its §Gaps rule.

**Close:** *"Nothing was invented silently. Captured beats edited beats
derived; the export marks all three — 'derived from `color/brand-blue` —
hover (ΔL −0.06)' — and §Gaps lists exactly what no tool can know: motion,
voice, breakpoints. Capture to AI-ready system, under five minutes."*

---

## Recover points

| If… | Then… |
|---|---|
| The tab crashes or you refresh | Reload — the draft restores; you land on "Your system" with a welcome-back toast. |
| An import goes weird | Expand **Import another capture** → **Start over**. |
| You accepted the wrong merge | Step 1 → Show everything → **Un-merge** on the survivor (before Create System). |
| You edited a derived value badly | Click the value → **Reset to derived**. |
| Clipboard copy fails | Use Copy/Download in the export section on step 4. |
| You need to jump around | Click any step, or press `1`–`4`. |
