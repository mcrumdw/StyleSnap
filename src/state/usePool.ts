import { useCallback, useEffect, useState } from "react";
import type { StyleSnapExport } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import {
  addMerge,
  appendImport,
  clearDraft,
  emptyPool,
  loadDraft,
  removeMerge,
  saveDraft,
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

  const startOver = useCallback(() => {
    clearDraft(localStorage);
    setPool(emptyPool());
  }, []);

  return { pool, addImport, mergeCluster, unmerge, startOver };
}
