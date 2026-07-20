import { useState } from "react";
import type { TokenType } from "../contract/types";
import {
  composeSlashName,
  namePrefixForType,
  nameSuffixPlaceholder,
  stripNamePrefix,
  type EffectNameKind,
} from "../engine/roles";
import { SlashNameField } from "./SlashNameField";

interface InlineNameProps {
  name: string | null;
  /** A valid slash name, or undefined to clear back to unnamed. */
  onSetName: (name: string | undefined) => void;
  /** Drives the locked prefix (type/… for fonts, color/… for colors). */
  tokenType?: TokenType;
  /** Shadow subtype — backdrop blur locks `blur/` instead of `shadow/`. */
  effectKind?: EffectNameKind;
  /**
   * Prefill when the token is unnamed — typically `fallbackName(token)` so the
   * draft matches this value’s type.
   */
  suggestedName?: string;
}

/** FR-21 inline name editing with prefix-locked slash path (§2.65). */
export function InlineName({
  name,
  onSetName,
  tokenType = "color",
  effectKind,
  suggestedName,
}: InlineNameProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const options = effectKind ? { effectKind } : undefined;
  const prefix = namePrefixForType(tokenType, options);
  const suffixPlaceholder = nameSuffixPlaceholder(tokenType, options);

  function startEditing() {
    const full = name ?? suggestedName ?? "";
    setDraft(full ? stripNamePrefix(full, prefix) : "");
    setError(null);
    setEditing(true);
  }

  function save() {
    const result = composeSlashName(prefix, draft);
    if ("error" in result) {
      setError(result.error);
      return;
    }
    onSetName(result.name === "" ? undefined : result.name);
    setEditing(false);
  }

  if (!editing) {
    return (
      <button type="button" onClick={startEditing} title="Rename" className="text-left">
        {name ? (
          <span className="font-mono text-caption font-medium text-text-primary underline decoration-dotted underline-offset-2">
            {name}
          </span>
        ) : suggestedName ? (
          <span
            className="font-mono text-caption font-medium text-text-primary underline decoration-dotted underline-offset-2"
            title="Derived name — click to edit or keep"
          >
            {suggestedName}
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
    <SlashNameField
      prefix={prefix}
      value={draft}
      onChange={(v) => {
        setDraft(v);
        setError(null);
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") save();
        if (e.key === "Escape") setEditing(false);
      }}
      onBlur={save}
      placeholder={suffixPlaceholder}
      error={error}
      autoFocus
      size="sm"
      hint="Add / for folders"
    />
  );
}
