import { useSession } from "../../state/SessionProvider";
import { Button } from "../Button";

/** Sticky footer — Create System only (share + undo live elsewhere). */
export function BottomBar() {
  const { vm, requestCreate } = useSession();

  if (vm.created && vm.exportReady) return null;

  return (
    <footer className="sticky bottom-0 z-sticky border-t-2 border-border-default bg-surface-page pb-[max(0px,env(safe-area-inset-bottom))]">
      <div className="mx-auto flex max-w-container items-center justify-between gap-3 px-4 py-3 sm:px-6 sm:min-h-btn-lg">
        {!vm.exportReady && (
          <span className="font-mono text-badge text-warning-text">Complete description before sharing</span>
        )}
        {vm.exportReady && <span className="flex-1" aria-hidden />}
        {!vm.created && (
          <Button type="button" size="sm" className="ml-auto shrink-0" onClick={requestCreate}>
            Create System
          </Button>
        )}
      </div>
    </footer>
  );
}
