import { Link, NavLink } from "react-router-dom";
import { useEffect, useRef } from "react";
import { Wordmark } from "../Wordmark";
import { sessionNavLinkClass } from "./nav-link-styles";
import { NavTitleWheel } from "./NavTitleWheel";
import { AddCaptureMenuButton, StartOverMenuButton } from "./MobileSessionActions";
import { ShareMenuButton } from "./ShareMenuButton";
import { SessionNavSection, StartOverRailButton } from "./SessionNavSection";
import { ShareNavSection } from "./ShareNavSection";
import { TOKEN_CATEGORIES } from "./SideNav";

const MOBILE_NAV_HEIGHT_VAR = "--session-mobile-nav-height";

interface MobileSessionNavProps {
  notesFilled: number;
  notesTotal: number;
}

interface DesktopSessionRailProps {
  notesFilled: number;
  notesTotal: number;
}

/** Phone / tablet: logo + share, then swipeable section title wheel. */
export function MobileSessionNav({ notesFilled, notesTotal }: MobileSessionNavProps) {
  const headerRef = useRef<HTMLElement>(null);

  // Publish height so CategoryLayerNav can stick *under* this bar (not at top-0).
  useEffect(() => {
    const header = headerRef.current;
    if (!header) return;
    const sync = () => {
      const hidden = getComputedStyle(header).display === "none";
      document.documentElement.style.setProperty(
        MOBILE_NAV_HEIGHT_VAR,
        hidden ? "0px" : `${header.offsetHeight}px`,
      );
    };
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(header);
    window.addEventListener("resize", sync);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", sync);
      document.documentElement.style.removeProperty(MOBILE_NAV_HEIGHT_VAR);
    };
  }, []);

  return (
    <header
      ref={headerRef}
      id="mobile-session-nav"
      className="sticky top-0 z-sticky bg-surface-page lg:hidden"
    >
      <div className="flex items-center justify-between gap-3 border-b-2 border-border-default px-4 py-3">
        <Link to="/" aria-label="StyleSnap home" className="min-w-0 shrink truncate">
          <Wordmark />
        </Link>
        <div className="flex shrink-0 items-center gap-2">
          <AddCaptureMenuButton />
          <StartOverMenuButton />
          <ShareMenuButton />
        </div>
      </div>
      <NavTitleWheel notesFilled={notesFilled} notesTotal={notesTotal} />
    </header>
  );
}

/** Desktop: sticky left rail — viewport-tall; main page scrolls independently. */
export function DesktopSessionRail({ notesFilled, notesTotal }: DesktopSessionRailProps) {
  return (
    <aside className="hidden w-44 shrink-0 flex-col gap-4 lg:sticky lg:top-8 lg:flex lg:h-[calc(100dvh-4rem)] lg:max-h-[calc(100dvh-4rem)] lg:self-start">
      <Link to="/" aria-label="StyleSnap home" className="shrink-0 px-1">
        <Wordmark />
      </Link>
      <nav aria-label="Session" className="flex shrink-0 flex-col gap-1">
        <NavLink to="/describe" className={({ isActive }) => sessionNavLinkClass(isActive, { rail: true })}>
          Description
          {notesFilled < notesTotal && (
            <span className="ml-1 font-mono text-badge font-normal text-warning-text">
              Not filled
            </span>
          )}
        </NavLink>
      </nav>
      <div className="flex min-h-0 flex-1 flex-col">
        <nav
          aria-label="Token categories"
          className="flex shrink-0 flex-col gap-1 overflow-y-auto scrollbar-none"
        >
          {TOKEN_CATEGORIES.map(({ id, label }) => (
            <NavLink
              key={id}
              to={`/tokens/${id}`}
              className={({ isActive }) => sessionNavLinkClass(isActive, { rail: true })}
            >
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="flex-1" />
      </div>
      <div className="flex shrink-0 flex-col gap-4">
        <ShareNavSection />
        <SessionNavSection />
        <StartOverRailButton />
      </div>
    </aside>
  );
}
