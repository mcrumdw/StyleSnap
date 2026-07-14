import { Link, NavLink } from "react-router-dom";
import { Wordmark } from "../Wordmark";
import { NavTitleWheel } from "./NavTitleWheel";
import { ShareMenuButton } from "./ShareMenuButton";
import { ShareNavSection } from "./ShareNavSection";
import { TOKEN_CATEGORIES, type TokenCategory } from "./SideNav";

const railLink = (isActive: boolean) =>
  `rounded-sm border-2 px-3 py-2 font-heading text-caption font-bold whitespace-nowrap ${
    isActive
      ? "border-border-default bg-surface-card text-text-primary shadow-card"
      : "border-transparent text-text-muted hover:border-border-default hover:text-text-primary"
  }`;

interface MobileSessionNavProps {
  notesFilled: number;
  notesTotal: number;
}

interface DesktopSessionRailProps {
  hints?: Partial<Record<TokenCategory, string>>;
  notesFilled: number;
  notesTotal: number;
}

/** Phone / tablet: logo + share, then swipeable section title wheel. */
export function MobileSessionNav({ notesFilled, notesTotal }: MobileSessionNavProps) {
  return (
    <header className="sticky top-0 z-sticky bg-surface-page lg:hidden">
      <div className="flex items-center justify-between gap-3 border-b-2 border-border-default px-4 py-3">
        <Link to="/" aria-label="StyleSnap home" className="min-w-0 shrink">
          <Wordmark />
        </Link>
        <ShareMenuButton />
      </div>
      <NavTitleWheel notesFilled={notesFilled} notesTotal={notesTotal} />
    </header>
  );
}

/** Desktop: vertical left rail with wordmark + share. */
export function DesktopSessionRail({ hints, notesFilled, notesTotal }: DesktopSessionRailProps) {
  return (
    <aside className="hidden w-44 shrink-0 flex-col gap-4 self-stretch lg:flex">
      <Link to="/" aria-label="StyleSnap home" className="px-1">
        <Wordmark />
      </Link>
      <nav aria-label="Session" className="flex flex-col gap-1">
        <NavLink to="/describe" className={({ isActive }) => railLink(isActive)}>
          Description
          {notesFilled < notesTotal && (
            <span className="ml-1 font-mono text-badge font-normal text-warning-text">
              {notesFilled}/{notesTotal}
            </span>
          )}
        </NavLink>
      </nav>
      <nav aria-label="Token categories" className="flex flex-col gap-1">
        {TOKEN_CATEGORIES.map(({ id, label }) => (
          <NavLink
            key={id}
            to={`/tokens/${id}`}
            className={({ isActive }) =>
              `flex flex-col rounded-sm border-2 px-3 py-2 ${
                isActive
                  ? "border-border-default bg-surface-card text-text-primary shadow-card"
                  : "border-transparent text-text-muted hover:border-border-default hover:text-text-primary"
              }`
            }
          >
            <span className="font-heading text-caption font-bold">{label}</span>
            {hints?.[id] && (
              <span className="font-mono text-badge text-text-muted">{hints[id]}</span>
            )}
          </NavLink>
        ))}
      </nav>
      <ShareNavSection className="mt-auto border-t-2 border-border-default pt-4" />
    </aside>
  );
}
