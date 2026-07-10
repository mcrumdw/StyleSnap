import { useCallback, useEffect, useState } from "react";
import type { StyleSnapExport, StyleSnapToken } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import type { AnchorOverrides, Harmony, TypeRatio } from "../engine/derive-system";
import type { SystemNotes, SystemNotesField } from "../engine/export";
import {
  autoMergeClusters,
  editDerived,
  resetDerived,
  setAccentChoice as setAccentChoicePure,
  setAnchorOverride as setAnchorOverridePure,
  setTypeRatio as setTypeRatioPure,
} from "./pool";
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
  setSystemNote,
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

  const addImport = useCallback((data: StyleSnapExport, notes?: SystemNotes) => {
    setPool((current) => {
      const importedAt = new Date().toISOString();
      const next = appendImport(
        current,
        data,
        { importId: crypto.randomUUID(), importedAt },
        notes,
      );
      // Merges are automatic since the 2026-07-06 fix-up — reversible in the
      // captured grid, never re-applied after an un-merge (import-time only).
      return autoMergeClusters(next, importedAt);
    });
  }, []);

  /** Phase 9b — set or clear one System-notes field. */
  const setNote = useCallback((field: SystemNotesField, value: string) => {
    setPool((current) => setSystemNote(current, field, value));
  }, []);

  // ── Phase 10 derivation decisions ──
  const setAnchor = useCallback((patch: Partial<AnchorOverrides>) => {
    setPool((current) => setAnchorOverridePure(current, patch));
  }, []);
  const editDerivedValue = useCallback((role: string, token: StyleSnapToken) => {
    setPool((current) => editDerived(current, role, token, new Date().toISOString()));
  }, []);
  const resetDerivedValue = useCallback((role: string) => {
    setPool((current) => resetDerived(current, role));
  }, []);
  const setAccent = useCallback((choice: { harmony?: Harmony; dismissed?: boolean }) => {
    setPool((current) => setAccentChoicePure(current, choice));
  }, []);
  const setRatio = useCallback((ratio: TypeRatio) => {
    setPool((current) => setTypeRatioPure(current, ratio));
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
    setNote,
    setAnchor,
    editDerivedValue,
    resetDerivedValue,
    setAccent,
    setRatio,
    createSystem,
    setStep,
    startOver,
  };
}
