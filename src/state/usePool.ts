import { useCallback, useEffect, useState } from "react";
import type { StyleSnapExport } from "../contract/types";
import {
  appendImport,
  clearDraft,
  emptyPool,
  loadDraft,
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

  const startOver = useCallback(() => {
    clearDraft(localStorage);
    setPool(emptyPool());
  }, []);

  return { pool, addImport, startOver };
}
