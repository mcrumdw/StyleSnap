// Phase 9b — "System notes": the user-authored descriptive layer (PRD §11).
// Tokens can't capture mood, principles, motion, voice, or layout intent —
// the user writes them; the export renders them; empty fields become Gaps
// lines, never silent omissions.

export interface SystemNotes {
  mood?: string;
  componentPrinciples?: string;
  motion?: string;
  voice?: string;
  layout?: string;
}

export type SystemNotesField = keyof SystemNotes;

/** Fixed field order — drives the export section, gaps, and the panel UI. */
export const NOTE_FIELDS: ReadonlyArray<{
  key: SystemNotesField;
  label: string;
  /** Gaps wording: "**<label>** — <gapText> (System notes field empty)." */
  gapText: string;
  /** Teaching caption for the panel UI. */
  hint: string;
}> = [
  {
    key: "mood",
    label: "Mood / vibe",
    gapText: "no mood/vibe description specified",
    hint: "The feel in a few lines — e.g. calm and precise, playful, brutalist.",
  },
  {
    key: "componentPrinciples",
    label: "Component principles",
    gapText: "no component principles specified",
    hint: "How surfaces, elevation, and emphasis work together.",
  },
  {
    key: "motion",
    label: "Motion",
    gapText: "no durations/easing specified",
    hint: "Durations, easing, and what animates (tokens can't capture this).",
  },
  {
    key: "voice",
    label: "Voice & microcopy",
    gapText: "no tone/wording rules specified",
    hint: "Tone and wording rules for UI copy.",
  },
  {
    key: "layout",
    label: "Layout",
    gapText: "no container/grid notes specified",
    hint: "Container widths, grid, breakpoint intent.",
  },
];

/** A field counts as filled only when it has visible text. */
export function noteText(notes: SystemNotes, key: SystemNotesField): string | undefined {
  const value = notes[key]?.trim();
  return value ? value : undefined;
}

/** Only the filled fields, in fixed order — the cleaned JSON `notes` payload. */
export function filledNotes(notes: SystemNotes): SystemNotes | undefined {
  const out: SystemNotes = {};
  let any = false;
  for (const field of NOTE_FIELDS) {
    const value = noteText(notes, field.key);
    if (value !== undefined) {
      out[field.key] = value;
      any = true;
    }
  }
  return any ? out : undefined;
}

/**
 * Defensive reader for a `notes` object lifted from pasted cleaned JSON —
 * strings only, unknown keys ignored. Returns undefined when nothing usable.
 */
export function sanitizeNotes(value: unknown): SystemNotes | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const source = value as Record<string, unknown>;
  const out: SystemNotes = {};
  let any = false;
  for (const field of NOTE_FIELDS) {
    const text = source[field.key];
    if (typeof text === "string" && text.trim()) {
      out[field.key] = text;
      any = true;
    }
  }
  return any ? out : undefined;
}
