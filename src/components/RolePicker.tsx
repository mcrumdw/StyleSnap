import { useState } from "react";
import type { TokenType } from "../contract/types";
import { rolesForType, type RoleSuggestion } from "../engine/roles";
import { Button } from "./Button";
import { RoleChip } from "./RoleChip";

interface RolePickerProps {
  tokenType: TokenType;
  /** Live engine suggestion (dashed chip until confirmed). */
  suggestion?: RoleSuggestion;
  /** User decision: a role (confirmed), null ("no role"), undefined (none yet). */
  decision?: string | null;
  /** string = confirm/override · null = no role · undefined = back to suggestion. */
  onDecide: (role: string | null | undefined) => void;
}

/**
 * PRD §7.5 role assignment: chip + searchable dropdown over the Appendix B
 * taxonomy. Suggestions render dashed with "?" until the human confirms
 * (FR-16); confirmed roles render solid. Override and clear always available.
 */
export function RolePicker({ tokenType, suggestion, decision, onDecide }: RolePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const roles = rolesForType(tokenType);
  if (roles.length === 0) return null; // e.g. gradient — no taxonomy roles

  const confirmed = typeof decision === "string";
  const effective = confirmed ? decision : decision === null ? undefined : suggestion?.role;
  const matches = roles.filter((r) => r.role.includes(query.toLowerCase().trim()));

  const pick = (role: string | null | undefined) => {
    onDecide(role);
    setOpen(false);
    setQuery("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="inline-flex"
      >
        {effective ? (
          <RoleChip role={effective} confirmed={confirmed} />
        ) : (
          <span className="inline-flex items-center rounded-sm border-2 border-dashed border-border-default px-2 py-1 font-mono text-caption text-text-muted">
            + role
          </span>
        )}
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-sticky" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-dropdown mt-2 w-72 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-modal">
            {suggestion && !confirmed && (
              <Button size="sm" className="mb-2 w-full" onClick={() => pick(suggestion.role)}>
                Confirm {suggestion.role}
              </Button>
            )}
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search roles…"
              aria-label="Search roles"
              className="mb-2 w-full rounded-sm border-2 border-border-default bg-surface-card px-2 py-1 font-mono text-caption text-text-primary placeholder:text-text-muted"
            />
            <ul role="listbox" className="flex max-h-56 flex-col gap-1 overflow-y-auto">
              {matches.map((def) => (
                <li key={def.role}>
                  <button
                    type="button"
                    onClick={() => pick(def.role)}
                    className={`w-full rounded-sm px-2 py-1 text-left font-mono text-caption ${
                      def.role === effective
                        ? "bg-brand-primary text-white"
                        : "text-text-primary hover:bg-state-disabled-bg"
                    }`}
                  >
                    {def.role}
                    <span className={`ml-2 font-body ${def.role === effective ? "text-white" : "text-text-muted"}`}>
                      {def.meaning}
                    </span>
                  </button>
                </li>
              ))}
              {matches.length === 0 && (
                <li className="px-2 py-1 text-caption text-text-muted">No matching role.</li>
              )}
            </ul>
            <div className="mt-2 flex gap-2 border-t-2 border-state-disabled-bg pt-2">
              <Button size="sm" variant="ghost" onClick={() => pick(null)}>
                No role (primitive)
              </Button>
              {decision !== undefined && (
                <Button size="sm" variant="ghost" onClick={() => pick(undefined)}>
                  Reset to suggestion
                </Button>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
