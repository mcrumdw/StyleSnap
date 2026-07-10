import { useState } from "react";
import { NOTE_FIELDS, type SystemNotes, type SystemNotesField } from "../engine/export";

interface SystemNotesPanelProps {
  notes: SystemNotes;
  onChange: (field: SystemNotesField, value: string) => void;
}

/**
 * Phase 9b — the user-authored descriptive layer (PRD §11). Optional fields;
 * whatever stays empty is reported in §Gaps of every export, never silently
 * omitted. Lives in step 4, above the export actions.
 */
export function SystemNotesPanel({ notes, onChange }: SystemNotesPanelProps) {
  const [open, setOpen] = useState(true);
  const filled = NOTE_FIELDS.filter((f) => notes[f.key]?.trim()).length;

  return (
    <section className="flex w-full flex-col gap-4 rounded-md border-2 border-border-default bg-surface-card p-6 shadow-card">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex flex-col">
          <span className="font-heading text-card-title font-medium">
            System notes — describe what tokens can't
          </span>
          <span className="text-caption text-text-muted">
            Mood, principles, motion, voice, layout. Empty fields are flagged in §Gaps.
          </span>
        </span>
        <span className="font-mono text-caption text-text-muted">
          {filled}/{NOTE_FIELDS.length} {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="flex flex-col gap-4">
          {NOTE_FIELDS.map((field) => (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="text-caption font-medium text-text-primary">{field.label}</span>
              <span className="text-caption text-text-muted">{field.hint}</span>
              <textarea
                value={notes[field.key] ?? ""}
                onChange={(e) => onChange(field.key, e.target.value)}
                rows={2}
                className="w-full resize-y rounded-sm border-2 border-border-default bg-surface-card p-3 text-base text-text-primary placeholder:text-text-muted"
                placeholder={`(optional — exports "${field.gapText}" to §Gaps while empty)`}
              />
            </label>
          ))}
        </div>
      )}
    </section>
  );
}
