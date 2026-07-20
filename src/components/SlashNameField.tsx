import { useId, type KeyboardEvent } from "react";

interface SlashNameFieldProps {
  /** Locked type folder, e.g. `color/` or `blur/`. */
  prefix: string;
  /** Path after the prefix only (may include extra `/` segments). */
  value: string;
  onChange: (suffix: string) => void;
  placeholder?: string;
  label?: string;
  hint?: string;
  error?: string | null;
  optional?: boolean;
  autoFocus?: boolean;
  onKeyDown?: (e: KeyboardEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
  className?: string;
  /** Smaller field for inline rename. */
  size?: "md" | "sm";
}

/**
 * Prefix-locked slash name input (§2.65). User types only the path after the
 * type folder; optional `/` segments for nesting.
 */
export function SlashNameField({
  prefix,
  value,
  onChange,
  placeholder = "name",
  label,
  hint,
  error,
  optional,
  autoFocus,
  onKeyDown,
  onBlur,
  className = "",
  size = "md",
}: SlashNameFieldProps) {
  const id = useId();
  const inputPad = size === "sm" ? "px-2 py-1 text-caption" : "h-btn-md px-3 text-base";
  const prefixPad = size === "sm" ? "px-2 py-1 text-caption" : "px-3 text-base";

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && (
        <label htmlFor={id} className="text-caption font-medium text-text-primary">
          {label}
          {optional ? (
            <span className="font-normal text-text-muted"> (optional)</span>
          ) : null}
        </label>
      )}
      <div
        className={`flex min-w-0 items-stretch overflow-hidden rounded-sm border-2 bg-surface-card ${
          error ? "border-error" : "border-border-default"
        }`}
      >
        <span
          className={`flex shrink-0 items-center border-r-2 border-border-default bg-surface-page font-mono text-text-muted ${prefixPad}`}
          aria-hidden
        >
          {prefix}
        </span>
        <input
          id={id}
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-label={label ? undefined : `Name after ${prefix}`}
          aria-invalid={error ? true : undefined}
          className={`min-w-0 flex-1 border-0 bg-transparent font-mono text-text-primary outline-none placeholder:text-text-muted ${inputPad}`}
        />
      </div>
      {hint && !error && <p className="text-badge text-text-muted">{hint}</p>}
      {error && <p className="text-caption text-error">{error}</p>}
    </div>
  );
}
