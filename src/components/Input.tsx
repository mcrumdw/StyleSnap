import type { InputHTMLAttributes } from "react";
import { useId } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", ...props }: InputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-caption font-medium text-text-primary">
          {label}
        </label>
      )}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        className={`h-btn-md rounded-sm border-2 bg-surface-card px-3 text-base text-text-primary placeholder:text-text-muted ${
          error ? "border-error" : "border-border-default"
        } ${className}`}
        {...props}
      />
      {error && <p className="text-caption text-error">{error}</p>}
    </div>
  );
}
