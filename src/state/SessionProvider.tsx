import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { StyleSnapToken } from "../contract/types";
import { AdjectivePicker } from "../components/AdjectivePicker";
import { Button } from "../components/Button";
import { Toast } from "../components/Toast";
import {
  agentExportBlockerMessage,
  getAgentExportBlockers,
} from "./agentExportBlockers";
import { usePool } from "./usePool";
import { useSessionViewModel } from "./useSessionViewModel";

type Session = ReturnType<typeof usePool> & {
  vm: ReturnType<typeof useSessionViewModel>;
  hasTokens: boolean;
  setToast: (message: string, options?: { undo?: () => void }) => void;
  /**
   * Save a role value edit as a new linked primitive and raise the
   * "Updated … · Undo" toast — the one place this pattern lives, so the
   * toast-undo wiring can't drift per call site (it caused a real
   * fire-immediately bug once).
   */
  editWithUndoToast: (role: string, token: StyleSnapToken) => void;
  requestCopyDesignMd: () => void;
  /** Runs `action` immediately if system notes are complete, else opens the design.md gate dialog. */
  withAgentExportReady: (action: () => void) => void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}

/**
 * One pool + view model for the whole app shell (tabs are routes now), plus
 * the design.md export gate (FR-19b / DECISIONS §2.21): copy/download
 * design.md opens a finish-system-notes dialog when notes are incomplete —
 * Figma / cleaned JSON export is never gated.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const poolApi = usePool();
  const { pool, applyTemplate, saveRoleAsPrimitive, undo, redo, canUndo, canRedo } =
    poolApi;
  const vm = useSessionViewModel(pool);
  const hasTokens = pool.imports.length > 0;
  const navigate = useNavigate();
  const noteBlockers = getAgentExportBlockers(pool.systemNotes);

  const [toast, setToastState] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<(() => void) | null>(null);
  const [pendingAction, setPendingAction] = useState<(() => void) | null>(null);

  const setToast = useCallback(
    (message: string, options?: { undo?: () => void }) => {
      setToastState(message);
      // Storing a FUNCTION in useState needs the updater wrap: passing the
      // callback directly makes React treat it as a functional updater and
      // CALL it immediately — which fired `undo()` on every toast and shoved
      // the just-committed change into the redo stack (the "change only
      // appears after pressing redo" bug).
      setToastAction(() => options?.undo ?? null);
    },
    [],
  );

  const editWithUndoToast = useCallback(
    (role: string, token: StyleSnapToken) => {
      saveRoleAsPrimitive(role, token);
      const label =
        token.type === "color" ? token.value : role.split("/").pop()?.replace(/-/g, " ") ?? role;
      setToast(`Updated ${label}`, { undo: () => undo() });
    },
    [saveRoleAsPrimitive, setToast, undo],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }
      const mod = event.metaKey || event.ctrlKey;
      if (!mod || event.key.toLowerCase() !== "z") return;
      event.preventDefault();
      if (event.shiftKey) {
        if (canRedo) redo();
      } else if (canUndo) {
        undo();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canUndo, canRedo, undo, redo]);

  const copyDesignMd = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(vm.designMd);
      setToastState("design.md copied — paste it into your AI coding tool.");
    } catch {
      setToastState("Couldn't reach the clipboard — use Download instead.");
    }
  }, [vm.designMd]);

  const withAgentExportReady = useCallback(
    (action: () => void) => {
      if (vm.agentExportReady) action();
      else setPendingAction(() => action);
    },
    [vm.agentExportReady],
  );

  const requestCopyDesignMd = useCallback(() => {
    withAgentExportReady(() => void copyDesignMd());
  }, [withAgentExportReady, copyDesignMd]);

  return (
    <SessionContext.Provider
      value={{
        ...poolApi,
        vm,
        hasTokens,
        setToast,
        editWithUndoToast,
        requestCopyDesignMd,
        withAgentExportReady,
      }}
    >
      {children}

      {pendingAction && (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
          onClick={() => setPendingAction(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Finish system notes for design.md"
            className="flex max-h-[min(90dvh,100%)] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-card-title font-medium">
                Finish system notes for design.md
              </h2>
              <p className="text-caption text-text-muted">
                design.md includes mood, motion, voice, and layout — things tokens can&apos;t
                capture. {agentExportBlockerMessage(noteBlockers)} Figma export works without them.
              </p>
            </div>

            <AdjectivePicker
              tokens={vm.exportInput.tokens}
              anchors={vm.anchors}
              initial={pool.adjectives}
              applyLabel="Fill & continue"
              onApply={(template, adjectives) => {
                applyTemplate(template, adjectives);
                const action = pendingAction;
                setPendingAction(null);
                if (action) action();
              }}
            />

            <div className="flex flex-wrap items-center gap-3">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setPendingAction(null);
                  navigate("/describe");
                }}
              >
                Go to system notes
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setPendingAction(null)}>
                Not now
              </Button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <Toast
          message={toast}
          onDismiss={() => {
            setToastState(null);
            setToastAction(null);
          }}
          action={
            toastAction && canUndo
              ? { label: "Undo", onClick: toastAction }
              : undefined
          }
        />
      )}
    </SessionContext.Provider>
  );
}
