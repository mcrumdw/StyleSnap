# StyleSnap — Full Ecosystem Demo Script (Extension → Figma Plugin → Webtool)

**Purpose:** a screen-recording walkthrough for the presentation, showing all
three StyleSnap surfaces working together on one real design. Read each
"Say" line as you perform the matching action — don't worry about hitting it
word for word, it's there to keep the narration on track.

**Target length:** ~8–10 minutes. Cut Act 5 and Act 9 first if you need to
trim.

**Before you hit record:**
- Load the unpacked extension (`extension/dist`) in `chrome://extensions`,
  confirm it says schema **2.1** (has a **Scan page** button).
- Have a real, visually distinct website open in one tab (a landing page with
  a clear brand color works best) and a Figma file with at least a couple of
  named color/text styles open in another.
- Run the webtool locally (`npm run dev`) or use the deployed Vercel URL.
- Keep a text editor open as scratch space to hold JSON between steps.

---

## Act 1 — Capture from the web (Browser Extension)

1. Open the target website. Click the StyleSnap extension icon to open the
   side panel.
2. Click **Pick**, then click 3–5 elements on the page that represent the
   design — a primary button, a heading, a card, a link.
3. Click **Scan page** — this is the v2.1 pass that pulls in foundations
   (breakpoints, spacing base, motion, z-index) and per-side spacing/margin
   context, not just colors.
4. Click **Copy to StyleSnap**.

**Say:** *"The extension doesn't just grab colors — Pick captures individual
elements you point at, and Scan page reads the page's foundations: spacing
scale, breakpoints, motion. That's what lets the exported design.md later
describe layout and motion, not just a color palette."*

---

## Act 2 — Capture from Figma (Figma Plugin)

1. Open the Figma file. Select a frame or a handful of layers that use your
   Styles/Variables (or select nothing to scan the whole page, depending on
   what you set up beforehand).
2. Run the StyleSnap plugin. On the **Export** tab, click **Extract tokens**.
3. Copy the resulting JSON.

**Say:** *"Same contract, different source. The Figma plugin reads Styles and
Variables directly, including authored names like `brand/600` — so tokens
that were deliberately named in Figma keep that intent instead of just being
a hex code."*

---

## Act 3 — Import into the Webtool

1. Open the webtool. On the import screen, paste the extension JSON, then
   paste the Figma JSON as a second import (or drag both files in).
2. Let it import — you land straight on a **post-capture welcome modal**:
   a one-line summary, a 3-step map of what's ahead, and a trust line.
3. Dismiss the modal.

**Say:** *"Two different sources, one pool. Nothing here required decisions
yet — near-duplicate values already merged automatically, and I'm looking at
a complete draft system, not a blank form."*

---

## Act 4 — The three-layer review (Colors)

1. Open the **Colors** page. Point out the three stacked bands:
   - **From snap** (dashed, page-surface styling) — the raw inventory, exactly
     what came from the extension/plugin, collapsed by default.
   - **Primitives** — the deduplicated, named values (rename one inline; show
     **Un-merge** on a merged cluster vs. **Remove** on a single card — call
     out that these are two different actions on purpose).
   - **System roles** — the semantic assignments (`color/action/primary`,
     `color/text/primary`, etc.) with a **Reassign** option inside the edit
     popover.
2. Show the **primary/secondary anchor cards** at the top. Point out that
   **secondary is greyed out with an "Add secondary" overlay** — it's opt-in,
   not auto-filled — click it to activate and pick a harmony.
3. Hover a **from capture** chip and a derived value to show the provenance
   tooltip.

**Say:** *"Every category follows the same mental model: what I captured,
what the system saved as a reusable primitive, and what that primitive
*means* in the design. Nothing gets a semantic role — like 'this is my
secondary brand color' — unless I explicitly say so."*

---

## Act 5 — Quick pass: Typography, Spacing, Effects *(trim if short on time)*

1. **Typography** — show a captured font claiming a heading slot vs. the
   modular scale filling the rest; point out sizes are whole pixels.
2. **Spacing** — show the **scale** (`xs…2xl`) under Primitives, and the four
   **semantic roles** (`page`, `section`, `stack`, `inset`) under System
   roles — call out that `space/page` is required specifically so exported
   pages don't sit flush to the screen edge.
3. **Effects** — show the elevation ladder (`shadow/sm·md·lg`) separated from
   background blur / inset shadow, and add one new effect via **Add** to show
   it lands under the right kind automatically.

**Say:** *"This isn't just labeling — the system is intelligent about scale.
Spacing and shadows both separate 'here's the ladder of values' from 'here's
what each value is *for*', the same way Colors does."*

---

## Act 6 — Editing power: undo/redo, custom roles, hints

1. Edit a derived color value, save it, then hit **⌘Z** to undo and show the
   toast/undo control — then redo.
2. On any category, click **Add role** and create a custom semantic role
   (e.g. `border-width/card`) — show it now appears as a normal role card.
3. Hover a **`?`** teaching-tip icon to show the instant tooltip.

**Say:** *"Every decision is undoable up to the point you lock the system —
and if the built-in role taxonomy doesn't cover something specific to this
design, you can add your own and it exports just like any other role."*

---

## Act 7 — Description page

1. Go to **Description**. Pick up to 5 adjectives (or click **Pick for me**).
2. Show the five System-notes fields (mood, components, motion, voice,
   layout) filling in live, each with a small per-field provenance badge.
3. Tweak one field's text manually to show it stays editable.

**Say:** *"Adjectives don't pick one canned template — each of the five
fields is matched independently, so the combination is close to unique to
this design, not one of eight fixed personalities."*

---

## Act 8 — Export, and closing the loop back into Figma

1. Set the project name, then click **Create System**.
2. Click **Copy design.md** — open it briefly in the text editor to show the
   structure (roles table, primitives, Foundations, Gaps section).
3. Click **Share with Figma**, copy the cleaned JSON.
4. Switch back to the Figma plugin, go to the **Import** tab, paste the
   cleaned JSON, and click **Create Styles & Variables**.

**Say:** *"This is the full loop: capture from the web or Figma, review and
complete it in the webtool, and push it back into Figma as real Paint and
Text Styles and Variables — not just a document, something the design tool
can use directly."*

---

## Act 9 — Payoff: hand it to a coding agent *(optional closer)*

1. Open Claude Code or Cursor on any small scaffold project.
2. Paste `design.md` and prompt:
   > Using the design system below, build a small pricing card with a
   > primary CTA and a muted caption. Use only tokens from the file.
3. Show the generated component roughly matching the captured brand.

**Say:** *"That's the whole point of the ecosystem — from a real website or
Figma file, to a reviewed design system, to code that actually looks like the
brand it came from, in one session."*

---

## Recovery points (if something breaks mid-recording)

| If… | Then… |
|---|---|
| Extension shows no Scan page button | You're on the old build — `cd extension && npm run build`, reload unpacked from `extension/dist`. |
| Wrong merge in Colors | Un-merge is on the merged Primitive card (blocked only after Create System). |
| Webtool state gets confusing | Refresh — the draft restores from localStorage automatically. |
| Plugin Import does nothing | Confirm the pasted JSON is the **cleaned/export** JSON from Share with Figma, not a raw capture. |
