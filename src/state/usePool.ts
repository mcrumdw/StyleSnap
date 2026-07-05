import { useCallback, useEffect, useState } from "react";
import type { StyleSnapExport, StyleSnapToken } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import {
  addManualToken,
  addMerge,
  appendImport,
  assignRole,
  clearDraft,
  createSystem as createSystemPure,
  emptyPool,
  loadDraft,
  removeManualToken,
  removeMerge,
  saveDraft,
  setCurrentStep as setCurrentStepPure,
  setDecision,
  setProjectName as setProjectNamePure,
  unassignRole,
  updateManualToken,
  type TokenPool,
} from "./pool";
import type { PipelineStep } from "./pipeline";

/**
 * The session token pool, backed by the localStorage draft (FR-29):
 * restored on load, auto-saved on every change, cleared by "Start over".
 */
export function usePool() {
  const [pool, setPool] = useState<TokenPool>(() => loadDraft(localStorage) ?? emptyPool());

  useEffect(() => {
    saveDraft(localStorage, pool);
  }, [pool]);

  const addImport = useCallback((data: StyleSnapExport) => {
    setPool((current) =>
      appendImport(current, data, {
        importId: crypto.randomUUID(),
        importedAt: new Date().toISOString(),
      }),
    );
  }, []);

  const mergeCluster = useCallback((survivorId: string, mergedIds: string[]) => {
    const record: MergeRecord = { survivorId, mergedIds, mergedAt: new Date().toISOString() };
    setPool((current) => addMerge(current, record));
  }, []);

  const unmerge = useCallback((survivorId: string) => {
    setPool((current) => removeMerge(current, survivorId));
  }, []);

  const setName = useCallback((tokenId: string, name: string | undefined) => {
    setPool((current) => setDecision(current, tokenId, { name }));
  }, []);

  /** Point a role at a primitive (Phase 8). Overwrites — the UI confirms reassigns. */
  const assign = useCallback((role: string, tokenId: string) => {
    setPool((current) => assignRole(current, role, tokenId));
  }, []);

  const unassign = useCallback((role: string) => {
    setPool((current) => unassignRole(current, role));
  }, []);

  /** Add a manual token (FR-19); confirming a role in the same step is atomic. */
  const addManual = useCallback((token: StyleSnapToken, role?: string) => {
    setPool((current) => {
      let next = addManualToken(current, token);
      if (role) next = assignRole(next, role, token.id);
      return next;
    });
  }, []);

  const updateManual = useCallback((token: StyleSnapToken, role?: string | null) => {
    setPool((current) => {
      let next = updateManualToken(current, token);
      if (role !== undefined) {
        // The dialog edits ONE role for a manual token: retarget it, dropping
        // whatever this token carried before.
        for (const [r, id] of Object.entries(next.assignments)) {
          if (id === token.id && r !== role) next = unassignRole(next, r);
        }
        if (role !== null) next = assignRole(next, role, token.id);
      }
      return next;
    });
  }, []);

  const removeManual = useCallback((tokenId: string) => {
    setPool((current) => removeManualToken(current, tokenId));
  }, []);

  const setProjectName = useCallback((name: string) => {
    setPool((current) => setProjectNamePure(current, name));
  }, []);

  /** FR-23 — finalize. Merges lock; the export timestamp is pinned here. */
  const createSystem = useCallback(() => {
    setPool((current) => createSystemPure(current, new Date().toISOString()));
  }, []);

  const setStep = useCallback((step: PipelineStep) => {
    setPool((current) => setCurrentStepPure(current, step));
  }, []);

  const startOver = useCallback(() => {
    clearDraft(localStorage);
    setPool(emptyPool());
  }, []);

  return {
    pool,
    addImport,
    mergeCluster,
    unmerge,
    setName,
    assign,
    unassign,
    addManual,
    updateManual,
    removeManual,
    setProjectName,
    createSystem,
    setStep,
    startOver,
  };
}
