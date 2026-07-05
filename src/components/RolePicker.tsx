import { useRef, useState } from "react";
import type { TokenType } from "../contract/types";
import { rolesForType } from "../engine/roles";
import { Button } from "./Button";
import { RoleChip } from "./RoleChip";

interface RolePickerProps {
  tokenType: TokenType;
  /** Roles confirmed to point at this token — solid chips, removable one by one. */
  assigned: string[];
  /** Live engine suggestions for this token — dashed chips until confirmed. */
  suggested: string[];
  /**
   * Who currently holds a role (name of the other primitive), for the
   * explicit reassign confirmation. `undefined` = the role is free.
   */
  holderLabel: (role: string) => string | undefined;
  onAssign: (role: string) => void;
  onUnassign: (role: string) => void;
}

/**
 * PRD §7.5 role assignment, ADDITIVE since Phase 8: roles point at
 * primitives, so a token shows ALL roles pointing at it and "Assign role…"
 * adds another. Suggestions render dashed with "?" until the human confirms
 * (FR-16). Assigning a role another token holds asks before stealing.
 */
export function RolePicker({
  tokenType,
  assigned,
  suggested,
  holderLabel,
  onAssign,
  onUnassign,
}: RolePickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  /** A picked role that is currently held elsewhere, awaiting confirmation. */
  const [pendingReassign, setPendingReassign] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const roles = rolesForType(tokenType);
  if (roles.length === 0) return null; // e.g. gradient — no taxonomy roles

  const matches = roles.filter((r) => r.role.includes(query.toLowerCase().trim()));
  const openSuggestions = suggested.filter((r) => !assigned.includes(r));

  const close = () => {
    setOpen(false);
    setQuery("");
    setPendingReassign(null);
    triggerRef.current?.focus();
  };

  const pick = (role: string) => {
    if (assigned.includes(role)) {
      // Already on this token — picking it again removes it (toggle).
      onUnassign(role);
      close();
      return;
    }
    if (holderLabel(role) !== undefined) {
      // Never steal silently (Phase 8 acceptance).
      setPendingReassign(role);
      return;
    }
    onAssign(role);
    close();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {assigned.map((role) => (
          <RoleChip key={role} role={role} confirmed onRemove={() => onUnassign(role)} />
        ))}
        {openSuggestions.map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => {
              if (holderLabel(role) !== undefined) {
                setOpen(true);
                setPendingReassign(role);
              } else {
                onAssign(role);
              }
            }}
            title={`Confirm suggestion: ${role}`}
            className="inline-flex"
          >
            <RoleChip role={role} />
          </button>
        ))}
      </div>

      <div
        className="relative"
        onKeyDown={(e) => {
          if (open && e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="listbox"
          aria-expanded={open}
          className="inline-flex items-center rounded-sm border-2 border-dashed border-border-default px-2 py-1 font-mono text-caption text-text-muted hover:border-brand-primary hover:text-brand-primary"
        >
          + Assign role…
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-sticky" onClick={close} />
            <div className="absolute left-0 top-full z-dropdown mt-2 w-72 rounded-md border-2 border-border-default bg-surface-card p-3 shadow-modal">
              {pendingReassign ? (
                <div className="flex flex-col gap-2">
                  <p className="text-caption text-text-primary">
                    <span className="font-mono">{pendingReassign}</span> currently →{" "}
                    <span className="font-mono">{holderLabel(pendingReassign)}</span> — reassign?
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => {
                        onAssign(pendingReassign);
                        close();
                      }}
                    >
                      Reassign
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setPendingReassign(null)}>
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search roles…"
                    aria-label="Search roles"
                    className="mb-2 w-full rounded-sm border-2 border-border-default bg-surface-card px-2 py-1 font-mono text-caption text-text-primary placeholder:text-text-muted"
                  />
                  <ul role="listbox" className="flex max-h-56 flex-col gap-1 overflow-y-auto">
                    {matches.map((def) => {
                      const onThisToken = assigned.includes(def.role);
                      const holder = onThisToken ? undefined : holderLabel(def.role);
                      return (
                        <li key={def.role}>
                          <button
                            type="button"
                            onClick={() => pick(def.role)}
                            className={`w-full rounded-sm px-2 py-1 text-left font-mono text-caption ${
                              onThisToken
                                ? "bg-brand-primary text-white"
                                : "text-text-primary hover:bg-state-disabled-bg"
                            }`}
                          >
                            {def.role}
                            <span
                              className={`ml-2 font-body ${onThisToken ? "text-white" : "text-text-muted"}`}
                            >
                              {onThisToken
                                ? "assigned here — click to remove"
                                : holder !== undefined
                                  ? `→ ${holder}`
                                  : def.meaning}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {matches.length === 0 && (
                      <li className="px-2 py-1 text-caption text-text-muted">No matching role.</li>
                    )}
                  </ul>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
