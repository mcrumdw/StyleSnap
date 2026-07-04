import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "destructive";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

// Signature press effect (DESIGN.md §8): translate 2px/2px on :active while
// the hard shadow collapses to nothing, so the button "sinks" into the page.
const press =
  "active:translate-x-0.5 active:translate-y-0.5 active:shadow-none";

const disabledStyles =
  "disabled:bg-state-disabled-bg disabled:text-state-disabled-text disabled:border-transparent disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 disabled:cursor-not-allowed";

const variants: Record<ButtonVariant, string> = {
  primary: `bg-brand-primary text-white border-2 border-border-default shadow-card hover:bg-brand-primary-hover ${press} ${disabledStyles}`,
  secondary: `bg-surface-card text-text-primary border-2 border-border-default shadow-card hover:bg-surface-page ${press} ${disabledStyles}`,
  ghost: `bg-transparent text-text-primary hover:bg-state-disabled-bg active:translate-x-0.5 active:translate-y-0.5 disabled:text-state-disabled-text disabled:bg-transparent disabled:cursor-not-allowed`,
  destructive: `bg-error text-white border-2 border-border-default shadow-card hover:bg-error-hover ${press} ${disabledStyles}`,
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-btn-sm px-3",
  md: "h-btn-md px-4",
  lg: "h-btn-lg px-6",
};

export function Button({
  variant = "primary",
  size = "md",
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md font-body text-base font-medium transition ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
