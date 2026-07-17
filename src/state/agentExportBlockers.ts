import { NOTE_FIELDS, type SystemNotes } from "../engine/export";

export interface AgentExportBlockers {
  filled: number;
  total: number;
  complete: boolean;
  missingLabels: string[];
}

/** Progress toward design.md export — all five system-note fields must be filled. */
export function getAgentExportBlockers(notes: SystemNotes | undefined): AgentExportBlockers {
  const missingLabels = NOTE_FIELDS.filter((f) => !(notes?.[f.key] ?? "").trim()).map(
    (f) => f.label,
  );
  const filled = NOTE_FIELDS.length - missingLabels.length;
  return {
    filled,
    total: NOTE_FIELDS.length,
    complete: missingLabels.length === 0,
    missingLabels,
  };
}

/** One-line status for modals and share affordances. */
export function agentExportBlockerMessage(blockers: AgentExportBlockers): string {
  if (blockers.complete) return "";
  const names = blockers.missingLabels.join(", ");
  return `${blockers.filled} of ${blockers.total} system notes filled${names ? ` (${names} still empty)` : ""}.`;
}
