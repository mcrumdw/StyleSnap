// FR-19b — sixty field snippets (12 per field × 5 fields), built from families.

import { NOTE_FIELDS, type SystemNotesField } from "../export/notes";
import type { Adjective } from "./adjectives";
import { FAMILY_PACKS, LEGACY_TEMPLATE_TO_FAMILY, type Family } from "./families";

export const FAMILY_BOOST = 0.25;

export interface FieldSnippet {
  id: string;
  field: SystemNotesField;
  family: Family;
  badgeLabel: string;
  traits: Partial<Record<Adjective, number>>;
  text: string;
}

function snippetId(field: SystemNotesField, family: Family): string {
  return `${field}/${family}`;
}

export const SNIPPET_LIBRARY: FieldSnippet[] = FAMILY_PACKS.flatMap((pack) =>
  NOTE_FIELDS.map((field) => ({
    id: snippetId(field.key, pack.family),
    field: field.key,
    family: pack.family,
    badgeLabel: pack.badgeLabel,
    traits: pack.traits,
    text: pack.notes[field.key],
  })),
);

const byId = new Map(SNIPPET_LIBRARY.map((s) => [s.id, s]));

export function snippetsForField(field: SystemNotesField): FieldSnippet[] {
  return SNIPPET_LIBRARY.filter((s) => s.field === field);
}

export function snippetById(id: string): FieldSnippet | undefined {
  return byId.get(id);
}

/** Map legacy monolithic template ids to per-field snippet ids. */
export function migrateNoteSourceId(source: string, field: SystemNotesField): string {
  if (source.includes("/")) return source;
  const family = LEGACY_TEMPLATE_TO_FAMILY[source];
  return family ? snippetId(field, family) : source;
}

export function resolveSnippet(
  source: string,
  field: SystemNotesField,
): FieldSnippet | undefined {
  return snippetById(source) ?? snippetById(migrateNoteSourceId(source, field));
}
