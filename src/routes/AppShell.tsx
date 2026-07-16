import { Navigate, Outlet } from "react-router-dom";
import { FloatingUndoRedo } from "../components/shell/FloatingUndoRedo";
import { DesktopSessionRail, MobileSessionNav } from "../components/shell/SessionNav";
import { UndoRedoToolbar } from "../components/shell/UndoRedoToolbar";
import { TOKEN_CATEGORIES, type TokenCategory } from "../components/shell/SideNav";
import { NOTE_FIELDS } from "../engine/export";
import { useSession } from "../state/SessionProvider";

export const DEFAULT_ROUTE = "/tokens/colors";

/** Session layout: nav + main + sticky footer (no duplicate global header). */
export function AppShell() {
  const { hasTokens, vm, pool } = useSession();

  if (!hasTokens) return <Navigate to="/" replace />;

  const notesFilled = NOTE_FIELDS.filter((f) => (pool.systemNotes?.[f.key] ?? "").trim()).length;
  const notesNav = { notesFilled, notesTotal: NOTE_FIELDS.length };
  const desktopNav = {
    ...notesNav,
    hints: { colors: `${vm.summary.anchorsPicked}/3 anchors` } as Partial<
      Record<TokenCategory, string>
    >,
  };

  return (
    <div className="relative mx-auto flex w-full min-h-dvh max-w-container flex-col">
      <div className="absolute right-4 top-4 z-sticky hidden lg:block sm:right-6 sm:top-6">
        <UndoRedoToolbar />
      </div>
      <MobileSessionNav {...notesNav} />
      <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:gap-6 lg:py-8">
        <DesktopSessionRail {...desktopNav} />
        <main id="main" className="min-w-0 flex-1 pb-24 sm:pb-20 lg:pb-16 lg:pt-10">
          <Outlet />
        </main>
      </div>
      <FloatingUndoRedo />
    </div>
  );
}

export { TOKEN_CATEGORIES };
