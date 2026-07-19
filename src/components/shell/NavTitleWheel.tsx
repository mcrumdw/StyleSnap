import { ChevronLeft, ChevronRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { TOKEN_CATEGORIES } from "./SideNav";
import { sessionNavLinkClass } from "./nav-link-styles";

interface TabItem {
  path: string;
  label: string;
  hint?: string;
  hintWarning?: boolean;
}

interface NavTitleWheelProps {
  notesFilled: number;
  notesTotal: number;
}

interface ScrollEdges {
  left: boolean;
  right: boolean;
}

/** Mobile — horizontal tab strip; active state follows the route (same tokens as desktop rail). */
export function NavTitleWheel({ notesFilled, notesTotal }: NavTitleWheelProps) {
  const location = useLocation();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const [edges, setEdges] = useState<ScrollEdges>({ left: false, right: false });

  const items = useMemo((): TabItem[] => {
    const list: TabItem[] = [
      {
        path: "/describe",
        label: "Describe",
        hint: notesFilled < notesTotal ? `${notesFilled}/${notesTotal}` : undefined,
        hintWarning: notesFilled < notesTotal,
      },
    ];
    for (const { id, label } of TOKEN_CATEGORIES) {
      const short =
        id === "typography" ? "Type" : id === "borders" ? "Borders" : id === "effects" ? "Effects" : label;
      list.push({ path: `/tokens/${id}`, label: short });
    }
    return list;
  }, [notesFilled, notesTotal]);

  const scrollByDir = (dir: -1 | 1) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * Math.max(120, el.clientWidth * 0.6), behavior: "smooth" });
  };

  const activeIndex = useMemo(() => {
    const idx = items.findIndex((item) => location.pathname === item.path);
    if (idx >= 0) return idx;
    const tokenIdx = items.findIndex(
      (item) => item.path.startsWith("/tokens/") && location.pathname.startsWith(item.path),
    );
    return tokenIdx >= 0 ? tokenIdx : 0;
  }, [items, location.pathname]);

  const updateEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setEdges({
      left: scrollLeft > 2,
      right: scrollLeft + clientWidth < scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    updateEdges();
    el.addEventListener("scroll", updateEdges, { passive: true });
    const observer = new ResizeObserver(updateEdges);
    observer.observe(el);
    return () => {
      el.removeEventListener("scroll", updateEdges);
      observer.disconnect();
    };
  }, [items, updateEdges]);

  useEffect(() => {
    itemRefs.current[activeIndex]?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [activeIndex]);

  return (
    <nav aria-label="Session sections" className="relative py-2">
      {edges.left && (
        <button
          type="button"
          aria-label="Scroll sections left"
          onClick={() => scrollByDir(-1)}
          className="absolute inset-y-0 left-0 z-10 flex w-10 items-center bg-gradient-to-r from-surface-page to-transparent pl-1"
        >
          <ChevronLeft className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
        </button>
      )}
      {edges.right && (
        <button
          type="button"
          aria-label="Scroll sections right"
          onClick={() => scrollByDir(1)}
          className="absolute inset-y-0 right-0 z-10 flex w-10 items-center justify-end bg-gradient-to-l from-surface-page to-transparent pr-1"
        >
          <ChevronRight className="h-4 w-4 text-text-muted" strokeWidth={2} aria-hidden />
        </button>
      )}
      <div
        ref={scrollerRef}
        className="flex gap-1 overflow-x-auto scrollbar-none px-4"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item, i) => (
          <NavLink
            key={item.path}
            to={item.path}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className={({ isActive }) =>
              `${sessionNavLinkClass(isActive)} shrink-0 whitespace-nowrap`
            }
          >
            {item.label}
            {item.hint && (
              <span
                className={`ml-1 font-mono text-badge font-normal ${
                  item.hintWarning ? "text-warning-text" : "text-text-muted"
                }`}
              >
                {item.hint}
              </span>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
