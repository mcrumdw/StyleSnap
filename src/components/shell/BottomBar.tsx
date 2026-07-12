import { useSession } from "../../state/SessionProvider";
import { downloadCleanedJson, downloadDesignMd } from "../../routes/exportActions";
import { Button } from "../Button";

/** Sticky footer: undo/redo + export actions. Wraps on small screens. */
export function BottomBar() {
  const {
    vm,
    requestCreate,
    requestCopyDesignMd,
    withCompleteSystem,
    undo,
    redo,
    canUndo,
    canRedo,
    undoLabel,
    redoLabel,
  } = useSession();

  return (
    <footer className="sticky bottom-0 z-sticky border-t-2 border-border-default bg-surface-page pb-[max(0px,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-container flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:gap-4 sm:px-6 sm:py-0 sm:min-h-btn-lg">
        <div className="flex min-w-0 items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={undo}
            disabled={!canUndo}
            title={undoLabel ? `Undo: ${undoLabel}` : "Nothing to undo"}
            aria-keyshortcuts="Meta+Z Control+Z"
          >
            Undo
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={redo}
            disabled={!canRedo}
            title={redoLabel ? `Redo: ${redoLabel}` : "Nothing to redo"}
            aria-keyshortcuts="Meta+Shift+Z Control+Shift+Z"
          >
            Redo
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
          {!vm.exportReady && (
            <span className="w-full font-mono text-badge text-warning-text sm:w-auto sm:order-last lg:order-none">
              completes before export
            </span>
          )}
          {!vm.created && (
            <Button size="sm" className="flex-1 sm:flex-none" onClick={requestCreate}>
              Create System
            </Button>
          )}
          <Button size="sm" className="flex-1 sm:flex-none" onClick={requestCopyDesignMd}>
            <span className="sm:hidden">Copy</span>
            <span className="hidden sm:inline">Copy design.md</span>
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={() =>
              withCompleteSystem(() => downloadDesignMd(vm.projectName, vm.designMd))
            }
          >
            Download
          </Button>
          <Button
            size="sm"
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={() =>
              withCompleteSystem(() => downloadCleanedJson(vm.projectName, vm.exportInput))
            }
          >
            <span className="sm:hidden">JSON</span>
            <span className="hidden sm:inline">Save JSON</span>
          </Button>
        </div>
      </div>
    </footer>
  );
}
