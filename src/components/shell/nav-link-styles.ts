/** Session rail nav — distinct from buttons: no shadow-card, brand border when active. */
export function sessionNavLinkClass(
  isActive: boolean,
  options?: { rail?: boolean },
): string {
  const pad = options?.rail ? "px-2 py-1" : "px-3 py-2";
  const layout = options?.rail ? "w-fit max-w-full self-start" : "";
  const base = `${layout} rounded-sm border-2 ${pad} font-heading text-caption font-bold transition duration-150 ease-out`.trim();

  if (isActive) {
    return `${base} border-brand-primary bg-surface-page text-brand-primary`;
  }

  return `${base} border-transparent text-text-muted hover:bg-surface-page hover:text-text-primary`;
}
