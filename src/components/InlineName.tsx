import { useState } from "react";
import type { TokenType } from "../contract/types";
import { namePlaceholder, validateSlashName } from "../engine/roles";

interface InlineNameProps {
  name: string | null;
  /** A valid slash name, or undefined to clear back to unnamed. */
  onSetName: (name: string | undefined) => void;
  /** Drives the placeholder example (type/… for fonts, color/… for colors). */
  tokenType?: TokenType;
  /**
   * Prefill when the token is unnamed — typically `fallbackName(token)` so the
   * draft matches this value’s type.
   */
  suggestedName?: string;
}

/** FR-21 inline name editing with slash-name validation. Click to edit. */
export function InlineName({ name, onSetName, tokenType = "color", suggestedName }: InlineNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const placeholder = namePlaceholder(tokenType);

  function startEditing() {
    setDraft(name ?? suggestedName ?? "");
    setError(null);
    setEditing(true);
  }

  function save() {
    const trimmed = draft.trim();
    if (trimmed === "") {
      onSetName(undefined);
      setEditing(false);
      return;
    }
    const problem = validateSlashName(trimmed);
    if (problem) {
      setError(problem);
      return;
    }
    onSetName(trimmed);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEditing}
        title="Rename"
        className="text-left"
      >
        {name ? (
          <span className="font-mono text-caption font-medium text-text-primary underline decoration-dotted underline-offset-2">
            {name}
          </span>
        ) : (
          <span className="text-caption italic text-text-muted underline decoration-dotted underline-offset-2">
            unnamed
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <input
        autoFocus
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") setEditing(false);
        }}
        onBlur={save}
        placeholder={placeholder}
        aria-label="Token name"
        className={`w-full rounded-sm border-2 bg-surface-card px-2 py-1 font-mono text-caption text-text-primary placeholder:text-text-muted ${
          error ? "border-error" : "border-border-default"
        }`}
      />
      {error && <span className="text-caption text-error">{error}</span>}
    </div>
  );
}
