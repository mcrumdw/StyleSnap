import { useSession } from "../../state/SessionProvider";
import { Button } from "../Button";

/** Compact Undo/Redo — used in CategoryLayerNav and (on non-token pages) shell chrome. */
export function UndoRedoToolbar() {
  const { undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useSession();

  if (!canUndo && !canRedo) return null;

  return (
    <div className="flex shrink-0 items-center gap-1">
      {canUndo && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={undo}
          title={undoLabel ? `Undo: ${undoLabel}` : "Nothing to undo"}
          aria-keyshortcuts="Meta+Z Control+Z"
        >
          Undo
        </Button>
      )}
      {canRedo && (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={redo}
          title={redoLabel ? `Redo: ${redoLabel}` : "Nothing to redo"}
          aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
        >
          Redo
        </Button>
      )}
    </div>
  );
}
