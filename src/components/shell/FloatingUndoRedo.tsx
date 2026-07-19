import { useSession } from "../../state/SessionProvider";
import { Button } from "../Button";

/** Mobile — undo/redo appear only when available, grouped bottom-left. */
export function FloatingUndoRedo() {
  const { undo, redo, canUndo, canRedo, undoLabel, redoLabel } = useSession();

  if (!canUndo && !canRedo) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-4 z-toast flex justify-start gap-2 px-4 pb-[max(0px,env(safe-area-inset-bottom))] lg:hidden">
      {canUndo && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="pointer-events-auto shadow-card"
          onClick={undo}
          title={undoLabel ? `Undo: ${undoLabel}` : "Undo"}
          aria-keyshortcuts="Meta+Z Control+Z"
        >
          Undo
        </Button>
      )}
      {canRedo && (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="pointer-events-auto shadow-card"
          onClick={redo}
          title={redoLabel ? `Redo: ${redoLabel}` : "Redo"}
          aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
        >
          Redo
        </Button>
      )}
    </div>
  );
}
