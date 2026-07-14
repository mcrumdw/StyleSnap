import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { StyleSnapToken } from "../contract/types";
import { AdjectivePicker } from "../components/AdjectivePicker";
import { Button } from "../components/Button";
import { CreateSystemDialog } from "../components/CreateSystemDialog";
import { Toast } from "../components/Toast";
import { NOTE_FIELDS } from "../engine/export";
import { usePool } from "./usePool";
import { useSessionViewModel } from "./useSessionViewModel";

type Session = ReturnType<typeof usePool> & {
  vm: ReturnType<typeof useSessionViewModel>;
  hasTokens: boolean;
  setToast: (message: string, options?: { undo?: () => void }) => void;
  /**
   * Edit a derived role value and raise the "Updated … · Undo" toast — the one
   * place this pattern lives, so the toast-undo wiring can't drift per call
   * site (it caused a real fire-immediately bug once).
   */
  editWithUndoToast: (role: string, token: StyleSnapToken) => void;
  /** FR-19b gate: create/copy/download all pass through here — nothing ships incomplete. */
  requestCreate: () => void;
  requestCopyDesignMd: () => void;
  /** Runs `action` immediately if the system is complete, else opens the completion dialog. */
  withCompleteSystem: (action: () => void) => void;
};

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}

/**
 * One pool + view model for the whole app shell (tabs are routes now), plus
 * the export-completeness gate (FR-19b): any create/copy/download attempt on
 * an incomplete system opens the "finish your description" dialog instead —
 * one click (starter or Pick-for-me) completes it, then the action proceeds.
 */
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const poolApi = usePool();
  const { pool, applyTemplate, createSystem, editDerivedValue, undo, redo, canUndo, canRedo } =
    poolApi;
  const vm = useSessionViewModel(pool);
  const hasTokens = pool.imports.length > 0;

  const [toast, setToastState] = useState<string | null>(null);
  const [toastAction, setToastAction] = useState<(() => void) | null>(null);
  const [showCreate, setShowCreate] = useState(false);
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
      editDerivedValue(role, token);
      const label =
        token.type === "color" ? token.value : role.split("/").pop()?.replace(/-/g, " ") ?? role;
      setToast(`Updated ${label}`);
    },
    [editDerivedValue, setToast],
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

  const withCompleteSystem = useCallback(
    (action: () => void) => {
      if (vm.exportReady) action();
      else setPendingAction(() => action);
    },
    [vm.exportReady],
  );

  const requestCreate = useCallback(() => {
    withCompleteSystem(() => setShowCreate(true));
  }, [withCompleteSystem]);

  const requestCopyDesignMd = useCallback(() => {
    withCompleteSystem(() => void copyDesignMd());
  }, [withCompleteSystem, copyDesignMd]);

  const missingNotes = NOTE_FIELDS.filter((f) => !(pool.systemNotes?.[f.key] ?? "").trim());
  const missingRoles = vm.checklist.requiredTotal - vm.checklist.requiredMet;

  return (
    <SessionContext.Provider
      value={{
        ...poolApi,
        vm,
        hasTokens,
        setToast,
        editWithUndoToast,
        requestCreate,
        requestCopyDesignMd,
        withCompleteSystem,
      }}
    >
      {children}

      {showCreate && (
        <CreateSystemDialog
          projectName={vm.projectName}
          reviewedCount={vm.exportInput.tokens.length}
          rawCount={vm.exportInput.rawTokenCount}
          mergeCount={vm.exportInput.mergeCount}
          checklist={vm.checklist}
          derivedCount={vm.summary.derivedCount}
          totalValues={Object.keys(vm.resolvedAssignments).length}
          onConfirm={() => {
            createSystem();
            setShowCreate(false);
            void copyDesignMd();
          }}
          onClose={() => setShowCreate(false)}
        />
      )}

      {pendingAction && (
        <div
          className="fixed inset-0 z-modal flex items-end justify-center bg-text-primary/50 p-0 sm:items-center sm:p-4"
          onClick={() => setPendingAction(null)}
        >
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Complete your system first"
            className="flex max-h-[min(90dvh,100%)] w-full max-w-lg flex-col gap-4 overflow-y-auto rounded-t-lg border-2 border-border-default bg-surface-card p-4 shadow-modal sm:rounded-lg sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              <h2 className="font-heading text-card-title font-medium">
                Complete your system first
              </h2>
              <p className="text-caption text-text-muted">
                Nothing ships with missing elements.{" "}
                {missingNotes.length > 0 &&
                  `${missingNotes.length} description field${missingNotes.length === 1 ? "" : "s"} still empty (${missingNotes.map((f) => f.label).join(", ")}).`}{" "}
                {missingRoles > 0 && `${missingRoles} required role${missingRoles === 1 ? "" : "s"} unfilled.`}
              </p>
            </div>

            {missingNotes.length > 0 && (
              <AdjectivePicker
                tokens={vm.exportInput.tokens}
                anchors={vm.anchors}
                initial={pool.adjectives}
                applyLabel="Fill & continue"
                onApply={(template, adjectives) => {
                  applyTemplate(template, adjectives);
                  const action = pendingAction;
                  setPendingAction(null);
                  // Roles are auto-derived; notes were the blocker — proceed.
                  if (missingRoles === 0 && action) action();
                }}
              />
            )}

            <div className="flex items-center gap-3">
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
            toastAction && !canUndo
              ? { label: "Undo", onClick: toastAction }
              : undefined
          }
        />
      )}
    </SessionContext.Provider>
  );
}
