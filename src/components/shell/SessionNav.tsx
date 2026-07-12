import { Link, NavLink } from "react-router-dom";
import { Wordmark } from "../Wordmark";
import { TOKEN_CATEGORIES, type TokenCategory } from "./SideNav";

const railLink = (isActive: boolean) =>
  `rounded-sm border-2 px-3 py-2 font-heading text-caption font-bold whitespace-nowrap ${
    isActive
      ? "border-border-default bg-surface-card text-text-primary shadow-card"
      : "border-transparent text-text-muted hover:border-border-default hover:text-text-primary"
  }`;

const tabLink = (isActive: boolean) =>
  `shrink-0 rounded-sm border-2 px-3 py-2 font-heading text-caption font-bold whitespace-nowrap ${
    isActive
      ? "border-border-default bg-surface-card text-text-primary shadow-card"
      : "border-transparent text-text-muted"
  }`;

interface SessionNavProps {
  hints?: Partial<Record<TokenCategory, string>>;
  notesFilled: number;
  notesTotal: number;
}

/** Phone / tablet: wordmark + horizontally scrollable section tabs. */
export function MobileSessionNav({ hints, notesFilled, notesTotal }: SessionNavProps) {
  return (
    <div className="flex flex-col gap-3 border-b-2 border-border-default px-4 py-3 lg:hidden">
      <Link to="/" aria-label="StyleSnap home" className="w-fit">
        <Wordmark />
      </Link>
      <nav aria-label="Session" className="-mx-1 overflow-x-auto scrollbar-none">
        <div className="flex min-w-max gap-2 px-1 pb-1">
          <NavLink to="/describe" className={({ isActive }) => tabLink(isActive)}>
            Description
            {notesFilled < notesTotal && (
              <span className="ml-1 font-mono text-badge font-normal text-warning-text">
                {notesFilled}/{notesTotal}
              </span>
            )}
          </NavLink>
          {TOKEN_CATEGORIES.map(({ id, label }) => (
            <NavLink
              key={id}
              to={`/tokens/${id}`}
              className={({ isActive }) => tabLink(isActive)}
            >
              {label}
              {hints?.[id] && (
                <span className="ml-1 font-mono text-badge font-normal text-text-muted">
                  {hints[id]}
                </span>
              )}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

/** Desktop: vertical left rail with wordmark. */
export function DesktopSessionRail({ hints, notesFilled, notesTotal }: SessionNavProps) {
  return (
    <aside className="hidden w-44 shrink-0 flex-col gap-4 lg:flex">
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
    </aside>
  );
}
