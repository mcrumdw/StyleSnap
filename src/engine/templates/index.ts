// FR-19b — per-field snippet matching (decided 2026-07-12). The user picks up
// to five adjectives (or asks the app to pick from the capture); mood is scored
// first, then other fields mix-and-match with a family boost for coherence.
// User text always wins; snippet text is provenance-marked and editable.

import type { StyleSnapToken } from "../../contract/types";
import type { Anchors } from "../derive-system";
import { oklchOf } from "../derive-system/oklch";
import { NOTE_FIELDS, type SystemNotes, type SystemNotesField } from "../export/notes";
import { ADJECTIVES, MAX_ADJECTIVES, type Adjective } from "./adjectives";
import type { Family } from "./families";
import {
  FAMILY_BOOST,
  migrateNoteSourceId,
  resolveSnippet,
  snippetsForField,
  type FieldSnippet,
} from "./snippets";

export {
  ADJECTIVES,
  ADJECTIVE_HINTS,
  isAdjective,
  MAX_ADJECTIVES,
  type Adjective,
} from "./adjectives";
export {
  FAMILIES,
  FAMILY_PACKS,
  LEGACY_TEMPLATE_TO_FAMILY,
  type Family,
  type FamilyPack,
} from "./families";
export {
  FAMILY_BOOST,
  SNIPPET_LIBRARY,
  migrateNoteSourceId,
  resolveSnippet,
  snippetById,
  snippetsForField,
  type FieldSnippet,
} from "./snippets";

/** The source of a filled note field: hand-written or a snippet id. */
export type NoteSource = "user" | string;

export interface ScoredSnippet {
  snippet: FieldSnippet;
  score: number;
}

export interface AssembledDescription {
  notes: Required<SystemNotes>;
  sources: Record<SystemNotesField, string>;
  moodFamily: Family;
}

function scoreSnippet(
  snippet: FieldSnippet,
  picked: Adjective[],
  moodFamily: Family | null,
): number {
  const unique = [...new Set(picked)];
  const base = unique.reduce((sum, adj) => sum + (snippet.traits[adj] ?? 0), 0);
  const boost = moodFamily && snippet.family === moodFamily ? FAMILY_BOOST : 0;
  return base + boost;
}

function compareSnippets(a: ScoredSnippet, b: ScoredSnippet): number {
  return b.score - a.score || (a.snippet.id < b.snippet.id ? -1 : 1);
}

/** Rank snippets for one field — Σ trait weights + optional family boost. */
export function scoreSnippetsForField(
  field: SystemNotesField,
  picked: Adjective[],
  moodFamily: Family | null = null,
): ScoredSnippet[] {
  return snippetsForField(field)
    .map((snippet) => ({ snippet, score: scoreSnippet(snippet, picked, moodFamily) }))
    .sort(compareSnippets);
}

export function bestSnippetForField(
  field: SystemNotesField,
  picked: Adjective[],
  moodFamily: Family | null = null,
): FieldSnippet {
  return scoreSnippetsForField(field, picked, moodFamily)[0].snippet;
}

/** Assemble a full description — mood first, then family-boosted mix-and-match. */
export function assembleDescription(picked: Adjective[]): AssembledDescription {
  const mood = bestSnippetForField("mood", picked, null);
  const notes = {} as Required<SystemNotes>;
  const sources = {} as Record<SystemNotesField, string>;

  for (const field of NOTE_FIELDS) {
    const snippet =
      field.key === "mood" ? mood : bestSnippetForField(field.key, picked, mood.family);
    notes[field.key] = snippet.text;
    sources[field.key] = snippet.id;
  }

  return { notes, sources, moodFamily: mood.family };
}

/**
 * "Pick for me" — derive five adjectives from the captured system itself.
 * Pure heuristics over the anchors (no AI): chroma → energy, hue → warmth,
 * radius → softness, shadows → weight. Deterministic and unit-tested.
 */
export function autoAdjectives(tokens: StyleSnapToken[], anchors: Anchors): Adjective[] {
  const byId = new Map(tokens.map((t) => [t.id, t]));
  const votes = new Map<Adjective, number>();
  const vote = (adj: Adjective, weight: number) =>
    votes.set(adj, (votes.get(adj) ?? 0) + weight);

  const primary = anchors.primaryColorId ? byId.get(anchors.primaryColorId) : undefined;
  if (primary?.type === "color") {
    const { c, h } = oklchOf(primary.value);
    if (c > 0.17) {
      vote("energetic", 3);
      vote("bold", 2);
    } else if (c < 0.09) {
      vote("calm", 3);
      vote("minimal", 2);
    } else {
      vote("confident", 2);
      vote("trustworthy", 1);
    }
    if (h >= 20 && h <= 140) vote("warm", 2);
    else vote("technical", 2);
  }

  const radii = tokens
    .filter((t): t is StyleSnapToken & { type: "border-radius"; value: number } => t.type === "border-radius")
    .sort((a, b) => b.occurrences - a.occurrences || (a.id < b.id ? -1 : 1));
  if (radii.length > 0) {
    if (radii[0].value >= 12) {
      vote("friendly", 2);
      vote("smooth", 1);
    } else if (radii[0].value <= 4) {
      vote("serious", 2);
      vote("technical", 1);
    } else {
      vote("trustworthy", 1);
    }
  }

  const shadows = tokens.filter((t) => t.type === "shadow");
  if (shadows.length === 0) {
    vote("minimal", 2);
  } else {
    const first = shadows[0];
    if (first.type === "shadow" && first.value[0].blur === 0) {
      vote("bold", 2);
      vote("edgy", 1);
    } else {
      vote("smooth", 1);
      vote("elegant", 1);
    }
  }

  const ranked = [...ADJECTIVES]
    .filter((adj) => votes.has(adj))
    .sort((a, b) => votes.get(b)! - votes.get(a)! || ADJECTIVES.indexOf(a) - ADJECTIVES.indexOf(b));
  const fallback: Adjective[] = ["trustworthy", "calm", "minimal", "serious", "refined"];
  const picks = [...ranked, ...fallback.filter((f) => !ranked.includes(f))];
  return picks.slice(0, MAX_ADJECTIVES);
}

/** Fill ONLY the empty fields from an assembly; report per-field sources. */
export function fillNotes(
  notes: SystemNotes,
  assembled: AssembledDescription,
  existingSources: Partial<Record<SystemNotesField, NoteSource>> = {},
): { notes: SystemNotes; sources: Partial<Record<SystemNotesField, NoteSource>> } {
  const filled: SystemNotes = { ...notes };
  const sources: Partial<Record<SystemNotesField, NoteSource>> = { ...existingSources };
  for (const field of NOTE_FIELDS) {
    if (filled[field.key]?.trim()) {
      sources[field.key] = sources[field.key] ?? "user";
      continue;
    }
    filled[field.key] = assembled.notes[field.key];
    sources[field.key] = assembled.sources[field.key];
  }
  return { notes: filled, sources };
}

/**
 * Re-apply snippets when adjectives change: refresh every field the user
 * hasn't claimed; user text (source "user") is never touched.
 */
export function refreshNotesFromAssembly(
  notes: SystemNotes,
  assembled: AssembledDescription,
  existingSources: Partial<Record<SystemNotesField, NoteSource>> = {},
): { notes: SystemNotes; sources: Partial<Record<SystemNotesField, NoteSource>> } {
  const filled: SystemNotes = { ...notes };
  const sources: Partial<Record<SystemNotesField, NoteSource>> = { ...existingSources };
  for (const field of NOTE_FIELDS) {
    if (sources[field.key] === "user") continue;
    filled[field.key] = assembled.notes[field.key];
    sources[field.key] = assembled.sources[field.key];
  }
  return { notes: filled, sources };
}

/** Migrate legacy template ids in stored note sources. */
export function migrateNoteSources(
  sources: Partial<Record<SystemNotesField, NoteSource>>,
): Partial<Record<SystemNotesField, NoteSource>> {
  const migrated: Partial<Record<SystemNotesField, NoteSource>> = {};
  for (const field of NOTE_FIELDS) {
    const source = sources[field.key];
    if (!source) continue;
    if (source === "user") {
      migrated[field.key] = "user";
      continue;
    }
    migrated[field.key] = migrateNoteSourceId(source, field.key);
  }
  return migrated;
}

/** Provenance label for export — snippet badge or undefined for unknown ids. */
export function snippetProvenanceLabel(source: string, field: SystemNotesField): string | undefined {
  return resolveSnippet(source, field)?.badgeLabel;
}
