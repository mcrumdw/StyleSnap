import { Navigate, Outlet } from "react-router-dom";
import { BottomBar } from "../components/shell/BottomBar";
import { DesktopSessionRail, MobileSessionNav } from "../components/shell/SessionNav";
import { TOKEN_CATEGORIES, type TokenCategory } from "../components/shell/SideNav";
import { NOTE_FIELDS } from "../engine/export";
import { useSession } from "../state/SessionProvider";

export const DEFAULT_ROUTE = "/tokens/colors";

/** Session layout: nav + main + sticky footer (no duplicate global header). */
export function AppShell() {
  const { hasTokens, vm, pool } = useSession();

  if (!hasTokens) return <Navigate to="/" replace />;

  const notesFilled = NOTE_FIELDS.filter((f) => (pool.systemNotes?.[f.key] ?? "").trim()).length;
  const navProps = {
    hints: { colors: `${vm.summary.anchorsPicked}/3 anchors` } as Partial<
      Record<TokenCategory, string>
    >,
    notesFilled,
    notesTotal: NOTE_FIELDS.length,
  };

  return (
    <div className="mx-auto flex w-full min-h-dvh max-w-container flex-col">
      <MobileSessionNav {...navProps} />
      <div className="flex flex-1 flex-col gap-4 px-4 py-4 sm:px-6 sm:py-6 lg:flex-row lg:gap-6 lg:py-8">
        <DesktopSessionRail {...navProps} />
        <main id="main" className="min-w-0 flex-1 pb-36 sm:pb-32 lg:pb-28">
          <Outlet />
        </main>
      </div>
      <BottomBar />
    </div>
  );
}

export { TOKEN_CATEGORIES };
