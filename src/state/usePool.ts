import { useCallback, useEffect, useMemo, useReducer } from "react";
import type { StyleSnapExport, StyleSnapToken, TokenType } from "../contract/types";
import type { MergeRecord } from "../engine/dedup";
import type { AnchorOverrides, Harmony, TypeRatio } from "../engine/derive-system";
import type { SystemNotes, SystemNotesField } from "../engine/export";
import type { AssembledDescription } from "../engine/templates";
import {
  canRedoHistory,
  canUndoHistory,
  emptyHistory,
  peekRedoLabel,
  peekUndoLabel,
  pushHistory,
  redoHistory,
  type HistoryState,
  undoHistory,
} from "./history";
import {
  applyNoteTemplate,
  autoMergeClusters,
  editDerived,
  resetDerived,
  saveRoleEditAsPrimitive as saveRoleEditAsPrimitivePure,
  setAccentChoice as setAccentChoicePure,
  setAccentIds as setAccentIdsPure,
  setAnchorOverride as setAnchorOverridePure,
  setTypeRatio as setTypeRatioPure,
} from "./pool";
import {
  addCustomRole as addCustomRolePure,
  addManualToken,
  addMerge,
  setMergeSurvivor as setMergeSurvivorPure,
  appendImport,
  assignRole,
  clearDraft,
  createSystem as createSystemPure,
  emptyPool,
  excludeToken as excludeTokenPure,
  isSystemCreated,
  loadDraft,
  removeCustomRole as removeCustomRolePure,
  removeManualToken,
  removeMerge,
  restoreToken as restoreTokenPure,
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

type PoolState = {
  pool: TokenPool;
  history: HistoryState;
};

type PoolAction =
  | {
      type: "commit";
      updater: (pool: TokenPool) => TokenPool;
      label: string;
      affectsMerges: boolean | ((before: TokenPool, after: TokenPool) => boolean);
    }
  | { type: "silent"; updater: (pool: TokenPool) => TokenPool }
  | { type: "replace"; pool: TokenPool; clearHistory: boolean }
  | { type: "import"; data: StyleSnapExport; notes?: SystemNotes }
  | { type: "undo"; locked: boolean }
  | { type: "redo"; locked: boolean };

function mergesChanged(before: TokenPool, after: TokenPool): boolean {
  if (before.merges === after.merges) return false;
  if (before.merges.length !== after.merges.length) return true;
  return JSON.stringify(before.merges) !== JSON.stringify(after.merges);
}

/** @internal Exported for reducer integration tests. */
export function poolReducer(state: PoolState, action: PoolAction): PoolState {
  switch (action.type) {
    case "commit": {
      const next = action.updater(state.pool);
      if (next === state.pool) return state;
      const affectsMerges =
        typeof action.affectsMerges === "function"
          ? action.affectsMerges(state.pool, next)
          : action.affectsMerges;
      return {
        pool: next,
        history: pushHistory(state.history, state.pool, next, action.label, affectsMerges),
      };
    }
    case "silent": {
      const next = action.updater(state.pool);
      return next === state.pool ? state : { ...state, pool: next };
    }
    case "replace":
      return {
        pool: action.pool,
        history: action.clearHistory ? emptyHistory() : state.history,
      };
    case "import": {
      const importedAt = new Date().toISOString();
      let next = appendImport(
        state.pool,
        action.data,
        { importId: crypto.randomUUID(), importedAt },
        action.notes,
      );
      next = autoMergeClusters(next, importedAt);
      return { pool: next, history: emptyHistory() };
    }
    case "undo": {
      const result = undoHistory(state.history, state.pool, action.locked);
      return result ? { pool: result.pool, history: result.history } : state;
    }
    case "redo": {
      const result = redoHistory(state.history, state.pool, action.locked);
      return result ? { pool: result.pool, history: result.history } : state;
    }
  }
}

function anchorLabel(patch: Partial<AnchorOverrides>): string {
  if ("primaryColorId" in patch) return "Change primary color anchor";
  if ("secondaryColorId" in patch) return "Change secondary color anchor";
  if ("bodyTypographyId" in patch) return "Change body typography anchor";
  if ("baseSpacing" in patch) return `Change base spacing to ${patch.baseSpacing}px`;
  return "Change anchor";
}

function editLabel(role: string, token: StyleSnapToken): string {
  if (token.type === "color") return `Change ${role} to ${token.value}`;
  return `Edit ${role}`;
}

/**
 * The session token pool, backed by the localStorage draft (FR-29):
 * restored on load, auto-saved on every change, cleared by "Start over".
 */
export function usePool() {
  const [state, dispatch] = useReducer(poolReducer, undefined, () => ({
    pool: loadDraft(localStorage) ?? emptyPool(),
    history: emptyHistory(),
  }));

  const { pool, history } = state;
  const locked = isSystemCreated(pool);

  useEffect(() => {
    saveDraft(localStorage, pool);
  }, [pool]);

  const commit = useCallback(
    (
      updater: (current: TokenPool) => TokenPool,
      label: string,
      affectsMerges: boolean | ((before: TokenPool, after: TokenPool) => boolean) = false,
    ) => dispatch({ type: "commit", updater, label, affectsMerges }),
    [],
  );

  const silent = useCallback(
    (updater: (current: TokenPool) => TokenPool) => dispatch({ type: "silent", updater }),
    [],
  );

  const undo = useCallback(() => dispatch({ type: "undo", locked }), [locked]);
  const redo = useCallback(() => dispatch({ type: "redo", locked }), [locked]);

  const canUndo = canUndoHistory(history, locked);
  const canRedo = canRedoHistory(history, locked);
  const undoLabel = peekUndoLabel(history, locked);
  const redoLabel = peekRedoLabel(history, locked);

  const addImport = useCallback((data: StyleSnapExport, notes?: SystemNotes) => {
    dispatch({ type: "import", data, notes });
  }, []);

  const setNote = useCallback(
    (field: SystemNotesField, value: string) => {
      silent((current) => setSystemNote(current, field, value));
    },
    [silent],
  );

  const applyTemplate = useCallback(
    (assembled: AssembledDescription, adjectives: string[], options?: { refresh?: boolean }) => {
      silent((current) => applyNoteTemplate(current, assembled, adjectives, options));
    },
    [silent],
  );

  const setAnchor = useCallback(
    (patch: Partial<AnchorOverrides>) => {
      commit((current) => setAnchorOverridePure(current, patch), anchorLabel(patch));
    },
    [commit],
  );

  const editDerivedValue = useCallback(
    (role: string, token: StyleSnapToken) => {
      const editedAt = new Date().toISOString();
      commit(
        (current) => editDerived(current, role, token, editedAt),
        editLabel(role, token),
      );
    },
    [commit],
  );

  /** Create a manual primitive from a role value edit and assign the role to it. */
  const saveRoleAsPrimitive = useCallback(
    (role: string, token: StyleSnapToken) => {
      commit(
        (current) => saveRoleEditAsPrimitivePure(current, role, token),
        `Save ${role} as primitive`,
      );
    },
    [commit],
  );

  const resetDerivedValue = useCallback(
    (role: string) => {
      commit((current) => resetDerived(current, role), `Reset ${role} to derived`);
    },
    [commit],
  );

  const setAccent = useCallback(
    (choice: { harmony?: Harmony; dismissed?: boolean }) => {
      commit((current) => setAccentChoicePure(current, choice), "Set accent harmony");
    },
    [commit],
  );

  const setAccentIds = useCallback(
    (accentIds: string[] | undefined) => {
      commit((current) => setAccentIdsPure(current, accentIds), "Update accents");
    },
    [commit],
  );

  const setRatio = useCallback(
    (ratio: TypeRatio) => {
      silent((current) => setTypeRatioPure(current, ratio));
    },
    [silent],
  );

  const mergeCluster = useCallback(
    (survivorId: string, mergedIds: string[]) => {
      const record: MergeRecord = { survivorId, mergedIds, mergedAt: new Date().toISOString() };
      const count = mergedIds.length + 1;
      commit((current) => addMerge(current, record), `Merge ${count} tokens`, true);
    },
    [commit],
  );

  const unmerge = useCallback(
    (survivorId: string) => {
      commit((current) => removeMerge(current, survivorId), "Un-merge tokens", true);
    },
    [commit],
  );

  /** Re-pick survivor within an existing merge cluster (same members). */
  const setMergeSurvivor = useCallback(
    (newSurvivorId: string) => {
      commit(
        (current) => setMergeSurvivorPure(current, newSurvivorId),
        "Change merge survivor",
        mergesChanged,
      );
    },
    [commit],
  );

  /**
   * Promote a snap color to primary. If it was absorbed into a merge, it becomes
   * the survivor first so its hex drives the system (anchors require a survivor id).
   */
  const makePrimaryColor = useCallback(
    (tokenId: string) => {
      commit(
        (current) => {
          const promoted = setMergeSurvivorPure(current, tokenId);
          return setAnchorOverridePure(promoted, { primaryColorId: tokenId });
        },
        "Set primary color",
        mergesChanged,
      );
    },
    [commit],
  );

  const makeSecondaryColor = useCallback(
    (tokenId: string) => {
      commit(
        (current) => {
          const promoted = setMergeSurvivorPure(current, tokenId);
          return setAnchorOverridePure(promoted, { secondaryColorId: tokenId });
        },
        "Set secondary color",
        mergesChanged,
      );
    },
    [commit],
  );

  const setName = useCallback(
    (tokenId: string, name: string | undefined) => {
      commit((current) => setDecision(current, tokenId, { name }), "Rename token");
    },
    [commit],
  );

  const assign = useCallback(
    (role: string, tokenId: string) => {
      commit((current) => assignRole(current, role, tokenId), `Assign ${role}`);
    },
    [commit],
  );

  const unassign = useCallback(
    (role: string) => {
      commit((current) => unassignRole(current, role), `Unassign ${role}`);
    },
    [commit],
  );

  const addCustomRole = useCallback(
    (type: TokenType, pathAfterPrefix: string) => {
      silent((current) => addCustomRolePure(current, type, pathAfterPrefix));
    },
    [silent],
  );

  const removeCustomRole = useCallback(
    (role: string) => {
      commit((current) => removeCustomRolePure(current, role), "Remove custom role");
    },
    [commit],
  );

  const addManual = useCallback(
    (token: StyleSnapToken, role?: string) => {
      commit((current) => {
        let next = addManualToken(current, token);
        if (role) next = assignRole(next, role, token.id);
        return next;
      }, "Add manual token");
    },
    [commit],
  );

  const updateManual = useCallback(
    (token: StyleSnapToken, role?: string | null) => {
      commit((current) => {
        let next = updateManualToken(current, token);
        if (role !== undefined) {
          for (const [r, id] of Object.entries(next.assignments)) {
            if (id === token.id && r !== role) next = unassignRole(next, r);
          }
          if (role !== null) next = assignRole(next, role, token.id);
        }
        return next;
      }, "Update manual token");
    },
    [commit],
  );

  const removeManual = useCallback(
    (tokenId: string) => {
      commit((current) => removeManualToken(current, tokenId), "Delete manual token");
    },
    [commit],
  );

  const exclude = useCallback(
    (tokenId: string) => {
      commit((current) => excludeTokenPure(current, tokenId), "Exclude token from system");
    },
    [commit],
  );

  const restore = useCallback(
    (tokenId: string) => {
      commit((current) => restoreTokenPure(current, tokenId), "Restore excluded token");
    },
    [commit],
  );

  const setProjectName = useCallback(
    (name: string) => {
      silent((current) => setProjectNamePure(current, name));
    },
    [silent],
  );

  const createSystem = useCallback(() => {
    silent((current) => createSystemPure(current, new Date().toISOString()));
  }, [silent]);

  const setStep = useCallback(
    (step: PipelineStep) => {
      silent((current) => setCurrentStepPure(current, step));
    },
    [silent],
  );

  const startOver = useCallback(() => {
    clearDraft(localStorage);
    dispatch({ type: "replace", pool: emptyPool(), clearHistory: true });
  }, []);

  return useMemo(
    () => ({
      pool,
      addImport,
      mergeCluster,
      unmerge,
      setMergeSurvivor,
      makePrimaryColor,
      makeSecondaryColor,
      setName,
      assign,
      unassign,
      addCustomRole,
      removeCustomRole,
      addManual,
      updateManual,
      removeManual,
      exclude,
      restore,
      setProjectName,
      setNote,
      applyTemplate,
      setAnchor,
      editDerivedValue,
      saveRoleAsPrimitive,
      resetDerivedValue,
      setAccent,
      setAccentIds,
      setRatio,
      createSystem,
      setStep,
      startOver,
      undo,
      redo,
      canUndo,
      canRedo,
      undoLabel,
      redoLabel,
    }),
    [
      pool,
      addImport,
      mergeCluster,
      unmerge,
      setMergeSurvivor,
      makePrimaryColor,
      makeSecondaryColor,
      setName,
      assign,
      unassign,
      addCustomRole,
      removeCustomRole,
      addManual,
      updateManual,
      removeManual,
      exclude,
      restore,
      setProjectName,
      setNote,
      applyTemplate,
      setAnchor,
      editDerivedValue,
      saveRoleAsPrimitive,
      resetDerivedValue,
      setAccent,
      setAccentIds,
      setRatio,
      createSystem,
      setStep,
      startOver,
      undo,
      redo,
      canUndo,
      canRedo,
      undoLabel,
      redoLabel,
    ],
  );
}
