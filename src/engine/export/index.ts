// PRD §7.8 + §11 — the exports, as pure functions (BUILD_PLAN Phase 6).
//
// generateDesignMd:   the headline deliverable. Semantic-first two-tier
//                     Markdown, provenance-annotated, §Gaps from the live
//                     checklist (FR-24, FR-27). Deterministic: same input →
//                     byte-identical output (dates are inputs, never Date.now).
// generateCleanedJson: the save mechanism (FR-25, FR-28). A StyleSnapExport
//                     with merges applied and every name populated; must
//                     round-trip through parseStyleSnapExport. Gaps ride along
//                     in an extra `gaps` field (FR-27) that envelope
//                     validation ignores.
//
// Ordering everywhere: type → role → name → value → id (AGENTS.md).

import type {
  CaptureFoundations,
  ShadowLayer,
  StyleSnapExport,
  StyleSnapMeta,
  StyleSnapToken,
  TypographyToken,
} from "../../contract/types";
import { computeChecklist, type ChecklistItem } from "../completeness";
import { fallbackName, roleDefinition, roleOrderIndex } from "../roles";
import { accessibilitySection, contrastGapBullets } from "./accessibility";
import { componentsSection } from "./sketches";
import {
  filledNotes,
  NOTE_FIELDS,
  noteText,
  type SystemNotes,
  type SystemNotesField,
} from "./notes";
import { mergeCaptureFoundations, notesFromFoundations } from "./foundations";
import { snippetProvenanceLabel } from "../templates";
import type { RadiusInsight, SpacingInsight, TypeInsight } from "../insights";

export type { SystemNotes, SystemNotesField } from "./notes";
export { NOTE_FIELDS, sanitizeNotes } from "./notes";
export { accessibilityPairs, contrastRatio, relativeLuminance } from "./accessibility";
export { componentSketches } from "./sketches";
export { mergeCaptureFoundations, notesFromFoundations } from "./foundations";

export interface ExportInput {
  projectName: string;
  /** ISO 8601 — injected (fixed at Create System) so re-exports are byte-identical. */
  generatedAt: string;
  /** Capture metas, in import order — the header's provenance line. */
  captures: StyleSnapMeta[];
  rawTokenCount: number;
  mergeCount: number;
  /** The reviewed view: merges applied (survivors carry Σ occurrences + mergedFrom). */
  tokens: StyleSnapToken[];
  /** Raw tokens by id — to describe merged-away values in provenance notes. */
  rawById: ReadonlyMap<string, StyleSnapToken>;
  /**
   * Phase 8 — role → token id, merge-resolved (FR-16: confirmations only).
   * One primitive may back several roles; each role maps to exactly one.
   */
  assignments: ReadonlyMap<string, string>;
  /** User-assigned names by token id. */
  names: ReadonlyMap<string, string>;
  /** Phase 9b — the user-authored System notes; empty fields become Gaps lines. */
  notes: SystemNotes;
  /** FR-19b — per-field provenance: "user" or a starter-template id. */
  noteSources?: Partial<Record<SystemNotesField, string>>;
  /**
   * Phase 10 — provenance for derived/edited values by token id (FR-19).
   * Absent for fully hand-reviewed sessions.
   */
  derived?: ReadonlyMap<string, DerivedProvenance>;
  /** Design accents — captured color token ids (use sparingly). */
  accentIds?: string[];
  /** True when accentIds were user-edited (vs auto-seeded). */
  accentsExplicit?: boolean;
  /** Phase 10 — open merge proposals not yet reviewed (export guardrail + gaps note). */
  unreviewedMerges?: number;
  /** Optional scale intelligence (§2.27) — when present, enriches Foundations. */
  spacingInsight?: SpacingInsight;
  radiusInsight?: RadiusInsight;
  typeInsight?: TypeInsight;
}

export interface DerivedProvenance {
  /** Anchor token id or "convention". */
  derivedFrom: string;
  /** Human-readable formula, e.g. "hover (ΔL −0.06)". */
  method: string;
  /** The user hand-edited this derived value. */
  edited: boolean;
}

// ─────────────────────────────────────────
// Shared resolution helpers
// ─────────────────────────────────────────

const pct = (opacity: number) => `${Math.round(opacity * 100)}%`;

function nameOf(token: StyleSnapToken, names: ReadonlyMap<string, string>): string {
  return names.get(token.id) ?? token.name ?? fallbackName(token);
}

/** Sort helper: plain code-point comparison — locale-independent, deterministic. */
const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Provenance: where the value came from. Captured tokens list their sources
 * (plus absorbed ones, with total occurrences); derived tokens confess their
 * derivation — anchor and formula — and whether the user edited them (FR-19).
 */
function provenance(token: StyleSnapToken, input: ExportInput): string {
  const derivation = input.derived?.get(token.id);
  if (derivation && token.id.startsWith("derived_")) {
    const anchor = input.rawById.get(derivation.derivedFrom);
    const from = anchor ? ` from \`${nameOf(anchor, input.names)}\`` : "";
    return derivation.edited
      ? `edited by you (was derived${from}: ${derivation.method})`
      : `derived${from} — ${derivation.method}`;
  }
  const sources: string[] = [token.source];
  for (const id of token.mergedFrom ?? []) {
    const raw = input.rawById.get(id);
    if (raw && !sources.includes(raw.source)) sources.push(raw.source);
  }
  const label = sources.map((s) => `\`${s}\``).join(" + ");
  return token.occurrences > 1 ? `${label}, ${token.occurrences}×` : label;
}

/**
 * Reference a color by its primitive name when one is defined for that hex at
 * full opacity (two-tier: values point back at primitives — §11).
 */
function colorRef(hex: string, input: ExportInput): string {
  const primitive = fullOpacityPrimitive(hex, input);
  return primitive ? `\`${nameOf(primitive, input.names)}\`` : `\`${hex.toUpperCase()}\``;
}

function fullOpacityPrimitive(hex: string, input: ExportInput): StyleSnapToken | undefined {
  return input.tokens.find(
    (t) => t.type === "color" && t.value.toUpperCase() === hex.toUpperCase() && t.opacity === 1,
  );
}

function shadowValueText(layers: ShadowLayer[], input: ExportInput): string {
  const px = (v: number) => (v === 0 ? "0" : `${v}px`);
  return layers
    .map((l) => {
      const geometry = `${l.inset ? "inset " : ""}${px(l.offsetX)} ${px(l.offsetY)} ${px(l.blur)} ${px(l.spread)}`;
      return `${geometry} · ${colorRef(l.color, input)} @ ${pct(l.opacity)}`;
    })
    .join(" , ");
}

function captureLabel(meta: StyleSnapMeta): string {
  if (meta.source === "figma") {
    return meta.figmaFile ? `\`${meta.figmaFile}\` (Figma)` : "Figma";
  }
  if (meta.pageUrl) {
    try {
      return `\`${new URL(meta.pageUrl).hostname}\` (browser extension)`;
    } catch {
      return `\`${meta.pageUrl}\` (browser extension)`;
    }
  }
  return "browser extension";
}

/**
 * Role rows of one type: one row PER ROLE (the same primitive may appear in
 * several rows — roles point at primitives). Color/typography roles sort
 * alphabetically; foundation slots sort in scale order (xs → 2xl, Appendix B).
 */
function roleRows(
  input: ExportInput,
  type: StyleSnapToken["type"],
): Array<{ role: string; token: StyleSnapToken }> {
  const byId = new Map(input.tokens.map((t) => [t.id, t]));
  const scale = type !== "color" && type !== "typography" && type !== "gradient";
  const rows: Array<{ role: string; token: StyleSnapToken }> = [];
  for (const [role, tokenId] of input.assignments) {
    const token = byId.get(tokenId);
    if (token && token.type === type) rows.push({ role, token });
  }
  return rows.sort((a, b) => {
    if (scale) {
      const byIndex = roleOrderIndex(a.role) - roleOrderIndex(b.role);
      if (byIndex !== 0) return byIndex;
    }
    return byString(a.role, b.role);
  });
}

/** Tokens no role points at — the role-less primitives. */
function withoutRole(input: ExportInput, type: StyleSnapToken["type"]) {
  const assignedIds = new Set(input.assignments.values());
  return input.tokens
    .filter((t) => t.type === type && !assignedIds.has(t.id))
    .sort((a, b) => byString(nameOf(a, input.names), nameOf(b, input.names)));
}

// ─────────────────────────────────────────
// design.md sections
// ─────────────────────────────────────────

function header(input: ExportInput): string {
  const captures = input.captures.map(captureLabel).join(" + ");
  const n = input.captures.length;
  return [
    `# ${input.projectName} — Design System`,
    "",
    `> **Source of truth for AI coding tools.** Generated by StyleSnap on`,
    `> ${input.generatedAt.slice(0, 10)} from ${n} capture${n === 1 ? "" : "s"}: ${captures}.`,
    `> ${input.rawTokenCount} raw tokens → ${input.tokens.length} reviewed tokens (${input.mergeCount} merge${input.mergeCount === 1 ? "" : "s"}). Schema v2.1.`,
  ].join("\n");
}

function agentRules(input: ExportInput): string {
  const foundations = mergeCaptureFoundations(input.captures);
  const extra: string[] = [];
  const spacingBase =
    foundations?.spacingBasePx ??
    (input.spacingInsight?.baseUnit && input.spacingInsight.baseUnit >= 2
      ? input.spacingInsight.baseUnit
      : undefined);
  if (spacingBase) {
    extra.push(`- **Spacing sits on a ${spacingBase}px grid.** Prefer scale steps over one-off values.`);
  }
  if (foundations?.breakpointsPx?.length) {
    extra.push(
      `- **Breakpoints (do not invent):** ${foundations.breakpointsPx.map((n) => `${n}px`).join(", ")}.`,
    );
  }
  if (foundations?.contentMaxWidthsPx?.length) {
    extra.push(
      `- **Content max-width:** ${foundations.contentMaxWidthsPx.map((n) => `${n}px`).join(" / ")}.`,
    );
  }
  if (foundations?.motion?.length) {
    const m = foundations.motion[0]!;
    extra.push(
      `- **Default motion:** ${m.durationMs}ms ${m.easing}${m.property ? ` on \`${m.property}\`` : ""}.`,
    );
  }
  if (foundations?.zIndex?.length) {
    extra.push(
      `- **z-index scale:** ${foundations.zIndex.join(" · ")}.`,
    );
  }
  if (input.assignments.has("color/border/focus")) {
    extra.push("- **Focus ring** uses `color/border/focus` — never invent a focus color.");
  }

  return [
    "## Rules for the coding agent",
    "",
    "- **Use only the tokens below.** Never hardcode a color, size, spacing,",
    "  radius, or shadow that isn't listed.",
    "- **Reference tokens by role first** (`color/action/primary`), primitives only",
    "  when no role fits.",
    "- **If a value you need is missing, check §Gaps** — it's listed there because",
    "  the team hasn't decided it. Propose a value and flag it (`// NEW TOKEN —`",
    "  `needs sign-off`); don't invent silently.",
    ...extra,
  ].join("\n");
}

function colorSection(input: ExportInput): string {
  const lines: string[] = [
    "## Color",
    "",
    "Semantic roles first; each points at a primitive. Provenance notes where the",
    "value was captured.",
    "",
    "| Role | Primitive | Value | Provenance |",
    "|---|---|---|---|",
  ];

  for (const { role, token } of roleRows(input, "color")) {
    if (token.type !== "color") continue;
    // Two-tier: a translucent color IS a primitive at an opacity ("ink @ 50%").
    const base = token.opacity < 1 ? fullOpacityPrimitive(token.value, input) : undefined;
    const name = nameOf(base ?? token, input.names);
    const primitive = token.opacity < 1 ? `\`${name}\` @ ${pct(token.opacity)}` : `\`${name}\``;
    const value = token.opacity < 1 ? `\`${token.value}\` / ${token.opacity}` : `\`${token.value}\``;
    lines.push(`| \`${role}\` | ${primitive} | ${value} | ${provenance(token, input)} |`);
  }

  const accentTokens = (input.accentIds ?? [])
    .map((id) => input.tokens.find((t) => t.id === id))
    .filter((t): t is StyleSnapToken & { type: "color" } => t?.type === "color");
  if (accentTokens.length > 0) {
    lines.push(
      "",
      "### Accents — use sparingly",
      "",
      "Captured colors that aren't primary, secondary, or a semantic role. Prefer",
      "roles for UI chrome; reach for these only as highlights.",
      "",
      "| Hex | Provenance |",
      "|---|---|",
    );
    for (const token of accentTokens) {
      const seedNote = input.accentsExplicit
        ? "kept as accent"
        : "auto-seeded from capture (unassigned)";
      lines.push(`| \`${token.value}\` | ${provenance(token, input)} — ${seedNote} |`);
    }
  }

  // Primitives: every color by name — except translucent ones that resolve to
  // a full-opacity primitive (those aren't primitives, see above).
  const primitives = input.tokens
    .filter(
      (t) =>
        t.type === "color" && !(t.opacity < 1 && fullOpacityPrimitive(t.value, input)),
    )
    .sort((a, b) => byString(nameOf(a, input.names), nameOf(b, input.names)));
  lines.push("", "**Primitives**", "", "| Primitive | Value | Notes |", "|---|---|---|");
  for (const token of primitives) {
    if (token.type !== "color") continue;
    const value = token.opacity < 1 ? `\`${token.value}\` / ${token.opacity}` : `\`${token.value}\``;
    const note = token.id.startsWith("derived_")
      ? "derived — provenance in the roles table"
      : mergeNote(token, input);
    lines.push(`| \`${nameOf(token, input.names)}\` | ${value} | ${note} |`);
  }

  const gradients = input.tokens
    .filter((t) => t.type === "gradient")
    .sort((a, b) => byString(nameOf(a, input.names), nameOf(b, input.names)));
  if (gradients.length > 0) {
    lines.push("", "**Gradient**", "", "| Token | Value | Provenance |", "|---|---|---|");
    for (const token of gradients) {
      if (token.type !== "gradient") continue;
      const v = token.value;
      const angle = v.kind === "linear" && v.angle !== undefined ? ` ${v.angle}°` : "";
      const stops = v.stops
        .map((s) => `${colorRef(s.color, input)} ${Math.round(s.position * 100)}%`)
        .join(" → ");
      lines.push(
        `| \`${nameOf(token, input.names)}\` | ${v.kind}${angle} · ${stops} | ${provenance(token, input)} |`,
      );
    }
  }

  return lines.join("\n");
}

/** "survivor of a 3-way merge (`#2E6BFF` · `#2E6CFF`)" — from raw values. */
function mergeNote(token: StyleSnapToken, input: ExportInput): string {
  if (!token.mergedFrom || token.mergedFrom.length === 0) return "";
  const values: string[] = [];
  const push = (raw: StyleSnapToken | undefined) => {
    if (!raw) return;
    const text = rawValueText(raw);
    if (!values.includes(text)) values.push(text);
  };
  push(input.rawById.get(token.id));
  for (const id of token.mergedFrom) push(input.rawById.get(id));
  const ways = `${token.mergedFrom.length + 1}-way merge`;
  return values.length > 1
    ? `survivor of a ${ways} (${values.join(" · ")})`
    : `survivor of a ${ways} of identical captures`;
}

function rawValueText(token: StyleSnapToken): string {
  switch (token.type) {
    case "color":
      return `\`${token.value}\``;
    case "spacing":
    case "border-radius":
    case "border-width":
      return `${token.value}px`;
    case "typography":
      return `${token.value.fontSize}px/${token.value.fontWeight} lh ${token.value.lineHeight}`;
    default:
      return "";
  }
}

function typographyExtras(token: TypographyToken): string {
  const v = token.value;
  const extras = [
    v.fontStyle === "italic" ? "italic" : null,
    v.letterSpacing !== undefined ? `tracking ${v.letterSpacing}px` : null,
    v.textTransform && v.textTransform !== "none" ? v.textTransform : null,
  ].filter(Boolean);
  return extras.length > 0 ? extras.join(", ") : "—";
}

function typographySection(input: ExportInput): string {
  const all = input.tokens.filter((t): t is TypographyToken => t.type === "typography");
  const families = [...new Set(all.map((t) => t.value.fontFamily))].sort(byString);
  const stack = all.find((t) => t.value.fontStack)?.value.fontStack;

  const lines: string[] = ["## Typography", ""];
  if (families.length === 1) {
    const stackNote = stack ? ` (stack: \`${stack.join(", ")}\`)` : "";
    lines.push(`Font: **${families[0]}**${stackNote} — the only captured family.`);
  } else {
    lines.push(`Fonts: ${families.map((f) => `**${f}**`).join(", ")}.`);
  }
  if (input.typeInsight?.ratio) {
    lines.push(
      `Type scale ratio: **×${input.typeInsight.ratio}**${
        input.typeInsight.bodySize ? ` from body ${input.typeInsight.bodySize}px` : ""
      }.`,
    );
  }
  lines.push("", "| Role | Size / Weight / Line-height | Extras | Provenance |", "|---|---|---|---|");

  const row = (token: TypographyToken, label: string) => {
    const v = token.value;
    lines.push(
      `| ${label} | ${v.fontSize}px / ${v.fontWeight} / ${v.lineHeight} | ${typographyExtras(token)} | ${provenance(token, input)} |`,
    );
  };
  for (const { role, token } of roleRows(input, "typography")) {
    if (token.type === "typography") row(token, `\`${role}\``);
  }
  for (const token of withoutRole(input, "typography")) {
    if (token.type === "typography") row(token, `*(primitive)* \`${nameOf(token, input.names)}\``);
  }
  return lines.join("\n");
}

function foundationsSection(input: ExportInput): string {
  const lines: string[] = ["## Foundations", ""];

  const numericScaleLine = (
    type: "spacing" | "border-radius" | "border-width",
    title: string,
    withProvenance: boolean,
  ) => {
    const assigned = roleRows(input, type);
    if (assigned.length === 0 && withoutRole(input, type).length === 0) return;
    const parts = assigned.map(({ role, token }) => {
      const slot = `\`${role}\` ${token.value as number}`;
      return withProvenance ? `${slot} (${provenance(token, input)})` : slot;
    });
    const notes: string[] = [];
    // Values merged into an assigned slot (e.g. the oracle's 15px → space/md 16).
    for (const { role, token } of assigned) {
      for (const id of token.mergedFrom ?? []) {
        const raw = input.rawById.get(id);
        if (raw && raw.type === type && raw.value !== token.value) {
          notes.push(
            `A ${raw.value as number}px capture, ${raw.occurrences}×, was merged into \`${role}\` ${token.value as number}.`,
          );
        }
      }
    }
    const unassignedRows: Array<{ value: number; occurrences: number }> = [];
    for (const token of withoutRole(input, type)) {
      const value = token.value as number;
      const slotValues = assigned.map(({ token: t }) => t.value as number);
      const snap4 = (v: number) => Math.max(4, Math.round(v / 4) * 4);
      if (
        type === "spacing" &&
        slotValues.some((v) => Math.abs(v - snap4(value)) <= 4 || Math.abs(v - value) <= 4)
      ) {
        continue;
      }
      if (type === "border-radius" && slotValues.some((v) => Math.abs(v - value) <= 2)) {
        continue;
      }
      unassignedRows.push({ value, occurrences: token.occurrences });
      notes.push(
        `A ${value}px value, ${token.occurrences}×, is captured but **unassigned** — see §Gaps.`,
      );
    }
    let rationale = "";
    if (type === "spacing" && input.spacingInsight?.baseUnit && input.spacingInsight.baseUnit >= 2) {
      rationale = ` *Scale intelligence: base ~${input.spacingInsight.baseUnit}px.*`;
    }
    if (type === "border-radius" && input.radiusInsight && input.radiusInsight.profile !== "empty") {
      const label =
        input.radiusInsight.profile === "sharp"
          ? "sharp"
          : input.radiusInsight.profile === "soft"
            ? "soft / rounded"
            : "mixed sharp & soft";
      rationale = ` *Scale intelligence: ${label} profile.*`;
    }
    const noteText = notes.length > 0 ? ` (${notes.join(" ")})` : "";
    lines.push(`**${title}** — ${parts.join(" · ")}.${rationale}${noteText}`, "");
    if (unassignedRows.length > 0 && type === "spacing") {
      lines.push("| Unassigned spacing | Occurrences |", "|---|---|");
      for (const row of unassignedRows.sort((a, b) => a.value - b.value)) {
        lines.push(`| ${row.value}px | ${row.occurrences}× |`);
      }
      lines.push("");
    }
  };

  numericScaleLine("spacing", "Spacing scale", false);
  numericScaleLine("border-radius", "Radius", true);
  numericScaleLine("border-width", "Border width", true);

  const shadowRows = [
    ...roleRows(input, "shadow").map(({ role, token }) => ({ label: `\`${role}\``, token })),
    ...withoutRole(input, "shadow").map((token) => ({
      label: `*(primitive)* \`${nameOf(token, input.names)}\``,
      token,
    })),
  ];
  if (shadowRows.length > 0) {
    lines.push("**Shadows**", "", "| Token | Value | Provenance |", "|---|---|---|");
    for (const { label, token } of shadowRows) {
      if (token.type !== "shadow") continue;
      lines.push(
        `| ${label} | ${shadowValueText(token.value, input)} | ${provenance(token, input)} |`,
      );
    }
    lines.push("");
  }

  const foundations = mergeCaptureFoundations(input.captures);
  if (foundations) {
    if (foundations.breakpointsPx?.length) {
      lines.push(
        `**Breakpoints** — ${foundations.breakpointsPx.map((n) => `${n}px`).join(" · ")}.`,
        "",
      );
    }
    if (foundations.zIndex?.length) {
      lines.push(`**z-index** — ${foundations.zIndex.join(" · ")}.`, "");
    }
    if (foundations.motion?.length) {
      const motionLine = foundations.motion
        .map(
          (m) =>
            `${m.durationMs}ms ${m.easing}${m.property ? ` (\`${m.property}\`)` : ""}`,
        )
        .join(" · ");
      lines.push(`**Motion** — ${motionLine}.`, "");
    }
    if (foundations.contentMaxWidthsPx?.length) {
      lines.push(
        `**Content max-width** — ${foundations.contentMaxWidthsPx.map((n) => `${n}px`).join(" · ")}.`,
        "",
      );
    }
  }

  return lines.join("\n").trimEnd();
}

/**
 * §Gaps (FR-27) — one bullet per open checklist item, then failing contrast
 * pairs (Phase 9a), then empty System-notes fields (Phase 9b: reported, never
 * silently omitted).
 */
export function gapBullets(input: ExportInput): string[] {
  const foundations = mergeCaptureFoundations(input.captures);
  const checklist = computeChecklist(input.tokens, input.assignments, foundations);
  const bullets = checklist.items
    .filter((item) => item.status === "gap")
    .map((item) => gapBullet(item, foundations));
  if (input.unreviewedMerges && input.unreviewedMerges > 0) {
    bullets.push(
      `${input.unreviewedMerges} proposed merge${
        input.unreviewedMerges === 1 ? "" : "s"
      } not yet reviewed — values use the suggested survivors.`,
    );
  }
  bullets.push(...contrastGapBullets(input));
  const derivedNotes = notesFromFoundations(foundations);
  for (const field of NOTE_FIELDS) {
    if (noteText(input.notes, field.key) !== undefined) continue;
    // Capture-derived Layout / Motion count as filled for Gaps.
    if (field.key === "layout" && derivedNotes.layout) continue;
    if (field.key === "motion" && derivedNotes.motion) continue;
    bullets.push(`**${field.label}** — ${field.gapText} (System notes field empty).`);
  }
  return bullets;
}

function gapBullet(item: ChecklistItem, foundations?: CaptureFoundations): string {
  if (item.id === "manual-foundations") {
    if (foundations && Object.keys(foundations).length > 0) {
      return `${item.label} — still undefined; define manually or re-scan.`;
    }
    return "Breakpoints, z-index — never capturable; define manually.";
  }
  if (item.id.startsWith("unassigned-")) {
    return `${item.label.replace(" unassigned", "")} captured but unassigned to the scale.`;
  }
  const def = roleDefinition(item.id);
  if (def) return `\`${item.id}\` — ${def.meaning.toLowerCase()}; not captured and not yet decided.`;
  return `${item.label} — ${item.description}`;
}

function gapsSection(input: ExportInput): string {
  const bullets = gapBullets(input);
  return [
    "## Gaps — undefined in this system",
    "",
    "The consumer must not guess these; they were not captured and not yet decided:",
    "",
    ...bullets.map((b) => `- ${b}`),
  ].join("\n");
}

/**
 * Phase 9b — "## Mood & voice (author notes)": all five fields, always.
 * FR-19b: template-filled fields confess their starter so the consumer knows
 * which prose is hand-written and which came from a matched template.
 */
function notesSection(input: ExportInput): string {
  const derived = notesFromFoundations(mergeCaptureFoundations(input.captures));
  const lines = ["## Mood & voice (author notes)"];
  for (const field of NOTE_FIELDS) {
    const userText = noteText(input.notes, field.key);
    const captureText =
      field.key === "layout"
        ? derived.layout
        : field.key === "motion"
          ? derived.motion
          : undefined;
    const text = userText ?? captureText;
    const source = input.noteSources?.[field.key];
    const label =
      text !== undefined && source !== undefined && source !== "user"
        ? snippetProvenanceLabel(source, field.key)
        : undefined;
    const captureSuffix =
      !userText && captureText ? " *(from capture — confirm in System notes)*" : "";
    const suffix = label ? ` *(from the "${label}" starter — edit to taste)*` : captureSuffix;
    lines.push("", `**${field.label}:** ${text ?? "*(not captured — see Gaps)*"}${suffix}`);
  }
  return lines.join("\n");
}

function footer(input: ExportInput): string {
  return [
    "---",
    "",
    "*Ordering is deterministic (type → role → name → value) — re-exports diff",
    `cleanly. Generated by StyleSnap · project "${input.projectName}".*`,
  ].join("\n");
}

/** FR-24 — the design.md export. Pure and deterministic. */
export function generateDesignMd(input: ExportInput): string {
  return (
    [
      header(input),
      agentRules(input),
      colorSection(input),
      typographySection(input),
      foundationsSection(input),
      componentsSection(input),
      accessibilitySection(input),
      notesSection(input),
      gapsSection(input),
      footer(input),
    ].join("\n\n") + "\n"
  );
}

// ─────────────────────────────────────────
// Cleaned JSON (FR-25)
// ─────────────────────────────────────────

export type CleanedExport = StyleSnapExport & {
  /** FR-27 — open gaps, so the consumer knows what's undefined. Envelope validation ignores it. */
  gaps: string[];
  /** Phase 9b — filled System notes, so re-import round-trips them. Envelope validation ignores it. */
  notes?: SystemNotes;
  /** Phase 10 — derivation provenance by token id (FR-19). Envelope validation ignores it. */
  derivation?: Record<string, DerivedProvenance>;
  /** Design accent token ids (use sparingly). Envelope validation ignores it. */
  accents?: string[];
};

export function generateCleanedJson(input: ExportInput): CleanedExport {
  const first = input.captures[0];
  const meta: StyleSnapMeta = {
    source: first?.source ?? "browser-extension",
    exportedAt: input.generatedAt,
    version: "2.1",
  };
  const figma = input.captures.find((c) => c.figmaFile);
  const browser = input.captures.find((c) => c.pageUrl);
  if (figma?.figmaFile) meta.figmaFile = figma.figmaFile;
  if (browser?.pageUrl) meta.pageUrl = browser.pageUrl;
  const foundations = mergeCaptureFoundations(input.captures);
  if (foundations) meta.foundations = foundations;

  // Canonical order: type → role → name → value → id. A multi-role token
  // sorts by its alphabetically-first role.
  const firstRoleOf = new Map<string, string>();
  for (const [role, tokenId] of input.assignments) {
    const current = firstRoleOf.get(tokenId);
    if (current === undefined || role < current) firstRoleOf.set(tokenId, role);
  }
  const TYPE_ORDER = ["color", "gradient", "typography", "spacing", "border-radius", "border-width", "shadow"];
  const tokens = input.tokens
    .map((token) => ({ ...token, name: nameOf(token, input.names) }))
    .sort((a, b) => {
      const byType = TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type);
      if (byType !== 0) return byType;
      const byRole = byString(firstRoleOf.get(a.id) ?? "\uffff", firstRoleOf.get(b.id) ?? "\uffff");
      if (byRole !== 0) return byRole;
      const byName = byString(a.name!, b.name!);
      if (byName !== 0) return byName;
      return byString(a.id, b.id);
    });

  const cleaned: CleanedExport = { meta, tokens, gaps: gapBullets(input) };
  const notes = filledNotes(input.notes);
  if (notes) cleaned.notes = notes;
  if (input.accentIds && input.accentIds.length > 0) cleaned.accents = [...input.accentIds];
  if (input.derived && input.derived.size > 0) {
    const derivation: Record<string, DerivedProvenance> = {};
    for (const id of [...input.derived.keys()].sort(byString)) {
      if (id.startsWith("derived_")) derivation[id] = input.derived.get(id)!;
    }
    if (Object.keys(derivation).length > 0) cleaned.derivation = derivation;
  }
  return cleaned;
}
