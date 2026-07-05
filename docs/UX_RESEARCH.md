# StyleSnap Webtool — Scenario-Based Usability Study (Simulated)

**Author:** makram (with Claude) · **Date:** 2026-07-05
**System under test:** the current build (Phases 0–8d: SessionBar, Edit↔System
tabs, Roles/Captured/All sub-tabs, Gap/Export drawers, visual primitive picker)

## ⚠️ Method & honesty note

This is a **simulated study**: persona-based cognitive walkthroughs of ten
scenarios, projected onto twelve hypothetical users. No real participants were
observed. This method is good at *finding and prioritizing risks* — it is not
evidence. Findings below are **hypotheses ranked by expected severity ×
frequency**, to be validated with 5–6 real users (classmates fit the Maya
persona well) before building anything beyond Phase 10. Treat every "user
quote" as a script, not data.

---

## 1. Scenarios

| # | Scenario | Persona sketch | Capture input |
|---|---|---|---|
| S1 | First contact | Maya-type student, has watched one design-tokens video | Messy browser capture (31 tokens, 4-way blue cluster) |
| S2 | Speed run | Jonas-type vibe coder; wants `design.md` in 3 minutes, hates reviewing | Same messy capture |
| S3 | Expert with exact intent | Senior UX designer; has a naming scheme in her head; distrusts suggestions | Browser + Figma captures |
| S4 | The indecisive designer | Can't choose between two blues; merges, regrets, un-merges, re-merges | Messy capture |
| S5 | Limited capture, full system | Captured only a hero section: 6 tokens; needs a complete system anyway | 6-token capture |
| S6 | Multi-source clash | Gathering inspiration from 3 sites with two competing palettes | 2 web + 1 Figma capture |
| S7 | Figma-native | Theresa-type; her Figma Variables already have perfect names; expects them honored | Figma capture, full `authoredName`s |
| S8 | The returner | Started yesterday, closed the tab at 60%; resumes today | Restored localStorage draft |
| S9 | Error path | Pastes an API response, then uploads a PNG, then finds the right file | Wrong inputs → correct capture |
| S10 | Keyboard + handoff scrutiny | Motor-impaired power user / dev auditing the export | Any capture; keyboard only |

## 2. Flow maps & friction points (current UI)

Notation: → click/keypress · **[F#]** = friction observed · steps counted from
first paste.

### S1 · First contact (Maya)

Paste JSON → lands on **Edit — Captured**, 31 cards, DUP/SIM badges, SessionBar
with 6 controls. **[F1]** freezes: "Roles? Captured? All? System? Which is
first?" → hovers completeness pill "3/12 required" **[F2]** doesn't know what
"required" means → clicks a DUP badge → merge dialog (good — clear) → merges
blues → toast 👍 → clicks **All** tab "to check" **[F3]** sees near-identical
grid, worries she broke something → finds **Roles** tab by elimination →
**[F4]** reads "color/action/primary": jargon; picks colors via 8d picker
(good) → opens **Gaps** drawer, follows deep links (good) → clicks **Create
System** with 4 gaps open **[F5]** dialog warns but she can't tell if that's
bad → exports.
**Clicks to export: ~35. Est. 14 min.** Success, but with 5 orientation stalls.

### S2 · Speed run (Jonas)

Paste → ignores everything → clicks **Copy design.md** immediately **[F6]**
gets an export full of auto-names and unassigned tokens; no warning at the
moment of copy that review would massively improve it → pastes into Cursor,
gets mediocre results, blames the tool. Alternative path: he clicks Create
System first, sees the summary, still confirms through 4 gaps. **[F7]** The
happy-path *shortcut* (merge-all-DUPs button) doesn't exist — reviewing 4
clusters takes 4 × (open dialog → confirm).
**Clicks: 2 (bad export) or ~20 (decent). The 2-click path produces the worst
outcome with zero resistance.**

### S3 · Expert with exact intent

Imports both captures → goes straight to **Roles** → suggestion chips (dashed)
everywhere → **[F8]** must confirm ~12 suggestions one by one; wants "accept
all high-confidence" → wants to name the merged blue `brand/azure-500`
**[F9]** naming works, but her *role* scheme (`color/interactive/*`) isn't in
the taxonomy and there's no escape hatch — she must adopt Appendix B or leave
roles unassigned → sets sensitivity slider to strict (finds it, likes it) →
exports, checks `design.md` → satisfied with structure, annoyed by taxonomy
rigidity.
**Clicks: ~40. Success with resentment [F8][F9].**

### S4 · The indecisive designer

Merges blues picking #2E6CFF → regrets → **[F10]** hunts for undo: it lives on
the *merged card*, not in the toast (toast said "Nice!" but offered no Undo) →
un-merges → re-merges with #2E6BFF → switches role assignment twice (map model
handles it cleanly 👍) → hesitates at **Create System** **[F11]** dialog says
it locks merges; she doesn't feel ready and abandons for the day. No "you can
keep editing everything until you export" reassurance anywhere.
**Outcome: incomplete session — commitment anxiety, not capability.**

### S5 · Limited capture, full system

6 tokens import → checklist shows **9 open gaps** → GapDrawer → "Add token"
per gap → AddTokenDialog **[F12]** builds a 6-step spacing scale one dialog at
a time (6 × open → type → save = ~24 clicks just for spacing) → **[F13]** for
`color/action/primary-hover` she must *invent* a hover shade with no help
deriving it from the base color (that's FR-20/V2, but the dead end is felt
now) → finishes exhausted.
**Clicks: ~70. Success but the "completion" half of the product feels like a
form-filling chore.**

### S6 · Multi-source clash

3 imports append → 60+ tokens, two blues families → **[F14]** cluster view
shows occurrences but not *per-source* breakdown — "is this blue from the site
I actually liked?" requires opening each card → source filter exists 👍 but
resets when switching sub-tabs **[F15]** → assigns roles from the preferred
site's palette → **[F16]** junk tokens from site #3 (one-off #00000012
shadows, odd paddings) clutter every view: there is **no way to
dismiss/ignore a captured token** — they pollute the grid and the export's
primitives table forever.
**Clicks: ~55. Success; leftover junk in export annoys.**

### S7 · Figma-native (Theresa-type)

Imports Figma capture → Roles tab: every suggestion pre-filled from
`authoredName`s with high confidence 👍 → **[F17]** still must confirm each of
12 chips individually; "the tool already knows — why am I clicking 12 times?"
(same root as [F8]) → names preserved in export 👍.
**Clicks: ~25, of which ~15 feel redundant.**

### S8 · The returner

Opens tab → draft restores 👍 → **[F18]** lands on default view regardless of
where she left off; no "welcome back — 2 clusters and 3 gaps left" summary;
re-orients manually via pill + drawers (~2 min re-orientation).

### S9 · Error path

Pastes API JSON → friendly error + 5 field details 👍 → **[F19]** details are
developer-ish ("tokens.0.value: expected 6-digit hex") — fine for Jonas,
noise for Maya; **[F20]** no "what is a StyleSnap capture? → get the
extension/plugin" link at the error, which is the actual fix → uploads PNG →
"isn't valid JSON" 👍 → correct file → proceeds.

### S10 · Keyboard + handoff scrutiny

Tab-navigates: focus rings visible 👍, dialogs trap focus 👍 → **[F21]**
Edit↔System and sub-tabs are `role=tab` but arrow-key navigation is missing
(each tab is a separate Tab stop) → export audit: gaps flagged 👍, **[F22]** no
contrast/accessibility info in export yet (Phase 9 pending) — dev must
hand-check every pair.

## 3. Simulated study results (12 users)

Task: "turn your capture into a design.md you'd hand to an AI coding tool."
Success = exported with ≥ required roles assigned. Times estimated from click
counts at novice/expert pace.

| User | Scenario | Profile | Outcome | Est. time | Stalls | Top friction |
|---|---|---|---|---|---|---|
| U1 | S1 | Student, 1st time | ✅ | 14 min | 5 | F1 orientation |
| U2 | S1 | Student, 1st time | ⚠️ exported with 6 gaps | 9 min | 4 | F2 "required?" |
| U3 | S2 | Vibe coder | ❌ 2-click bad export | 2 min | 0 | F6 no guardrail |
| U4 | S3 | Senior designer | ✅ | 11 min | 2 | F8 chip-by-chip |
| U5 | S3 | Design-systems lead | ✅ | 13 min | 3 | F9 fixed taxonomy |
| U6 | S4 | Indecisive | ❌ abandoned pre-create | 16 min | 6 | F11 commitment fear |
| U7 | S5 | Limited capture | ✅ | 22 min | 3 | F12 dialog-per-token |
| U8 | S6 | Multi-source | ✅ | 18 min | 4 | F16 no ignore |
| U9 | S7 | Figma-native | ✅ | 7 min | 1 | F17 redundant confirms |
| U10 | S8 | Returner | ✅ | +2 min re-orient | 2 | F18 no resume cue |
| U11 | S9 | Error path | ✅ | 6 min | 2 | F20 no "get capture" help |
| U12 | S10 | Keyboard-only | ✅ | 15 min | 2 | F21 tab a11y |

**Projected:** 9/12 clean success · 1 low-quality success (U2) · 2 failures
(U3 quality failure, U6 abandonment). Median ~13 min — **over the 10-minute
north star** for half the users.

## 4. Synthesized pain points & recommendations

Ranked by severity × projected frequency. "Phase 10 ✓" = already covered by
the planned stepper redesign — this study independently re-derived it.

### Critical

| # | Pain point (friction) | Recommendation | Where |
|---|---|---|---|
| P1 | **No path through the map** — orientation stalls for every novice (F1–F4) | 4-step flow, one primary CTA, teaching vocabulary | **Phase 10 ✓** |
| P2 | **The worst outcome is the easiest** — 2-click unreviewed export, no guardrail (F6) | Copy/export CTA shows quality state: "12 unnamed · 4 unmerged clusters · 5 gaps — export anyway?" one-time interstitial with "Fix the big ones (2 min)" path | **Add to Phase 10** |
| P3 | **Bulk confirmation missing** — suggestion chips confirmed one-by-one; punishes exactly the users with the best data (F8, F17) | "Accept N high-confidence suggestions" batch action with a single review list (keeps human-in-the-loop: one review, one confirm — not silent) | **New: Phase 11** |
| P4 | **Commitment anxiety at Create System** (F11) + undo discoverability (F10) | Rename/reframe: "Finalize (you can reopen until you export)"; allow **Reopen for editing**; put **Undo** in the merge toast | **New: Phase 11** |

### Major

| # | Pain point | Recommendation | Where |
|---|---|---|---|
| P5 | **Gap-filling is a form chore** for thin captures (F12, F13) | Scale-builder quick actions: "Generate 6-step spacing scale from 8px", "Derive hover shade from base" (deterministic math now; AI polish stays V2/FR-20) | **New: Phase 11** |
| P6 | **No way to ignore junk tokens** — noise pollutes views and exports (F16) | "Ignore" action on any captured token (reversible, excluded from export, hidden behind the show-everything filter) | **New: Phase 11** |
| P7 | **Multi-source ambiguity** — no per-source breakdown in clusters; filters reset (F14, F15) | Merge dialog: occurrence split per source ("18× lumen.app · 2× verdantly.io"); persist filters across steps | **New: backlog** |
| P8 | **Fixed taxonomy frustrates experts** (F9) | V1: allow custom role *names* under the standard categories (`color/interactive/primary`); full custom taxonomy stays out of scope | **Backlog / decide** |
| P9 | **No resume orientation** (F18) | On restore: toast + land on the furthest incomplete step ("Welcome back — 3 gaps left"); Phase 10 already persists current step | **Fold into Phase 10** |

### Minor

| # | Pain point | Recommendation | Where |
|---|---|---|---|
| P10 | Error details too technical for designers (F19); no path to get a proper capture (F20) | Two-layer error: plain sentence first, details collapsible; add "Get the browser extension / Figma plugin" link | Quick fix |
| P11 | Tab widgets lack arrow-key navigation (F21) | Roving tabindex on the stepper (do it inside Phase 10's rebuild) | **Phase 10 ✓** |
| P12 | Export lacks accessibility data for handoff (F22) | Computed contrast section | **Phase 9 ✓ (planned)** |
| P13 | "Required 3/12" pill unexplained (F2) | Tooltip/first-run hint: "12 roles every complete system needs" | Quick fix |

## 5. What this study validates & what it changes

- **Validates Phase 10 wholesale** (P1, P9, P11, P13 are all stepper-adjacent)
  and Phase 9 (P12). Run them as planned.
- **Changes Phase 10 slightly:** add the export guardrail (P2) and
  resume-to-furthest-step (P9) to its spec — both are cheap inside the rebuild.
- **Motivates a Phase 11** (post-10): batch suggestion accept (P3),
  reopen-after-finalize + toast undo (P4), scale-builder quick actions (P5),
  ignore-token (P6).
- **Defers honestly:** P7 and P8 are real but not demo-critical.

## 6. Recommended real-world validation

Before building Phase 11: 5 users, 30 min each, think-aloud, tasks S1/S2/S5
verbatim (they cover the two failures and the chore). Measure: time to export,
stalls > 10 s, and the S2 trap (does anyone ship the 2-click export?). Rerun
S1 after Phase 10 ships — target: zero orientation stalls, < 10 min.
