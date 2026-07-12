# StyleSnap Web App — Agent instructions

**Single source of truth for every coding agent** (Claude Code, Cursor, or
any other). `CLAUDE.md` and `.cursor/rules/` just point here — edit only this
file.

StyleSnap turns raw design tokens captured by a browser extension and a Figma
plugin into a reviewed, exportable design system. This repo builds the **web
application** (makram's surface). Course final project, 3-person team.

## Read these before writing code

- `docs/PRD_webtool_v2.md` — **what** to build (v2.1). Appendix A = dedup
  algorithm, Appendix B = role taxonomy. Both are canonical, not suggestions.
- `DESIGN.md` — **how it looks** (v1.1). §0 rules are **hard constraints**:
  only tokens defined there, everything as custom Tailwind tokens, no invented
  values. §5.1 specs the workspace components.
- `docs/types.ts` — the shared capture contract (v2.0). **Import it, never
  redefine or edit it** (changes are a team decision, see DECISIONS.md §2.6).
- `docs/schema.ts` — zod runtime twin of types.ts. `parseStyleSnapExport()`
  is the only entry point for user JSON. Keep its sync assertions compiling.
- `docs/DECISIONS.md` — why things are the way they are. Append, don't rewrite.
  **When you change product behavior, UX, or architecture, update this file in
  the same task** — see § Decision log below.

## Test data & oracle

- `docs/fixtures/capture-browser-messy.json` — must import cleanly; contains
  deliberate traps: a 4-way blue cluster (#2E6BFF/#2E6CFF/#2F6BFE/#3067FF),
  15px-vs-16px spacing, body text differing only in lineHeight (1.5 vs 1.45),
  a tracked-uppercase label that must NOT merge with the caption.
- `docs/fixtures/capture-figma-clean.json` — must import cleanly; its
  `authoredName`s must drive role suggestions.
- `docs/fixtures/capture-malformed.json` — must be rejected with the friendly
  FR-2 error, never a crash.
- `docs/examples/design.example.md` — **the export oracle**: processing the
  two good fixtures must produce this structure and these resolutions.

## Hard product rules

- **Suggestive, never destructive.** Detection flags; only the user merges.
  Everything reversible until "Create System".
- **Envelope-only validation.** Messy/unnamed/duplicate-laden captures are
  VALID. Reject only malformation.
- Deterministic ordering everywhere: type → role → name → value → id.
- Naming is slash-nested (`color/action/primary`). Roles come from PRD
  Appendix B only.
- No backend. State = in-memory + localStorage draft. JSON export = save.

## Engineering conventions

- React + Vite + TypeScript (strict) + Tailwind. zod for validation, culori
  for color math, Vitest for tests.
- Dedup/role/export logic = **pure functions in `src/engine/`**, unit-tested
  against the fixtures before any UI wires them up.
- Run `npm test` and `tsc --noEmit` before declaring any task done.
- Follow the de-scope order in PRD §13 if scope pressure hits — never cut
  dedup, merge, or the design.md export.

## Decision log (mandatory)

Any task that **changes** product behavior, UX flows, architecture, or
hard constraints must **append** to `docs/DECISIONS.md` before you declare the
task done — do not wait for the user to ask.

1. Bump `Last updated` at the top to today's date.
2. If the change is a lasting design/architecture choice, add a new **§2.x**
   subsection (next number) with **Decided YYYY-MM-DD**, rationale, and what
   was rejected or deferred.
3. Always add a **§6 change history** row (newest first) summarizing what
   shipped; use `—` for commit hash until the user commits.
4. **Append only** — never rewrite or delete prior entries.

Skip the log only for pure refactors, copy tweaks, or test fixes that do not
change behavior or constraints.
