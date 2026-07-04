import { useCallback, useEffect, useState } from "react";
import type { StyleSnapExport, StyleSnapToken } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import {
  addManualToken,
  addMerge,
  appendImport,
  clearDraft,
  emptyPool,
  loadDraft,
  removeManualToken,
  removeMerge,
  saveDraft,
  setDecision,
  updateManualToken,
  type TokenDecision,
  type TokenPool,
} from "./pool";

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

  const decide = useCallback((tokenId: string, patch: TokenDecision) => {
    setPool((current) => setDecision(current, tokenId, patch));
  }, []);

  /** Add a manual token (FR-19); confirming a role in the same step is atomic. */
  const addManual = useCallback((token: StyleSnapToken, role?: string) => {
    setPool((current) => {
      let next = addManualToken(current, token);
      if (role) next = setDecision(next, token.id, { role });
      return next;
    });
  }, []);

  const updateManual = useCallback((token: StyleSnapToken, role?: string | null) => {
    setPool((current) => {
      let next = updateManualToken(current, token);
      if (role !== undefined) next = setDecision(next, token.id, { role });
      return next;
    });
  }, []);

  const removeManual = useCallback((tokenId: string) => {
    setPool((current) => removeManualToken(current, tokenId));
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
    decide,
    addManual,
    updateManual,
    removeManual,
    startOver,
  };
}
