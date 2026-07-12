import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { TOKEN_CATEGORIES } from "./SideNav";

interface WheelItem {
  path: string;
  label: string;
  hint?: string;
}

interface NavTitleWheelProps {
  notesFilled: number;
  notesTotal: number;
}

function wheelTitleClass(distance: number): string {
  if (distance === 0) {
    return "font-heading text-card-title font-bold text-text-primary opacity-100 scale-100";
  }
  if (distance === 1) {
    return "font-heading text-caption font-bold text-text-muted opacity-70 scale-95";
  }
  return "font-heading text-caption font-bold text-text-muted opacity-40 scale-90";
}

/** Mobile — swipeable title strip; active section stays centered. */
export function NavTitleWheel({ notesFilled, notesTotal }: NavTitleWheelProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const navigatingRef = useRef(false);

  const items = useMemo((): WheelItem[] => {
    const list: WheelItem[] = [
      {
        path: "/describe",
        label: "Description",
        hint: notesFilled < notesTotal ? `${notesFilled}/${notesTotal} notes` : undefined,
      },
    ];
    for (const { id, label } of TOKEN_CATEGORIES) {
      list.push({ path: `/tokens/${id}`, label });
    }
    return list;
  }, [notesFilled, notesTotal]);

  const activeIndex = useMemo(() => {
    const idx = items.findIndex((item) => location.pathname === item.path);
    if (idx >= 0) return idx;
    const tokenIdx = items.findIndex(
      (item) => item.path.startsWith("/tokens/") && location.pathname.startsWith(item.path),
    );
    return tokenIdx >= 0 ? tokenIdx : 0;
  }, [items, location.pathname]);

  const [focusIndex, setFocusIndex] = useState(activeIndex);

  const scrollToIndex = useCallback((index: number, behavior: ScrollBehavior = "smooth") => {
    const scroller = scrollerRef.current;
    const el = itemRefs.current[index];
    if (!scroller || !el) return;
    const left = el.offsetLeft - (scroller.clientWidth - el.offsetWidth) / 2;
    scroller.scrollTo({ left, behavior });
  }, []);

  useEffect(() => {
    setFocusIndex(activeIndex);
    navigatingRef.current = true;
    scrollToIndex(activeIndex, "auto");
    const t = window.setTimeout(() => {
      navigatingRef.current = false;
    }, 80);
    return () => window.clearTimeout(t);
  }, [activeIndex, scrollToIndex]);

  const nearestIndex = useCallback(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return 0;
    const center = scroller.scrollLeft + scroller.clientWidth / 2;
    let best = 0;
    let bestDist = Number.POSITIVE_INFINITY;
    itemRefs.current.forEach((el, i) => {
      if (!el) return;
      const elCenter = el.offsetLeft + el.offsetWidth / 2;
      const dist = Math.abs(center - elCenter);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    return best;
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    if (!scroller) return;

    let timer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      setFocusIndex(nearestIndex());
      if (navigatingRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const idx = nearestIndex();
        const item = items[idx];
        if (item && location.pathname !== item.path) navigate(item.path);
      }, 120);
    };

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      clearTimeout(timer);
      scroller.removeEventListener("scroll", onScroll);
    };
  }, [items, location.pathname, navigate, nearestIndex]);

  return (
    <nav aria-label="Session sections" className="border-b-2 border-border-default">
      <div
        ref={scrollerRef}
        className="flex snap-x snap-mandatory items-center gap-0 overflow-x-auto scrollbar-none"
        style={{ WebkitOverflowScrolling: "touch" }}
      >
        {items.map((item, i) => {
          const active = i === activeIndex;
          const focused = i === focusIndex;
          const distance = Math.abs(i - focusIndex);
          return (
            <button
              key={item.path}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              onClick={() => {
                navigate(item.path);
                scrollToIndex(i);
              }}
              className="flex min-h-[44px] shrink-0 snap-center flex-col items-center justify-center px-4 transition duration-150 ease-out"
              aria-current={active ? "page" : undefined}
            >
              <span className={`block max-w-[12rem] truncate transition duration-150 ease-out ${wheelTitleClass(distance)}`}>
                {item.label}
              </span>
              {focused && item.hint && (
                <span
                  className={`mt-0.5 block truncate font-mono text-badge ${
                    item.path === "/describe" && notesFilled < notesTotal
                      ? "text-warning-text"
                      : "text-text-muted"
                  }`}
                >
                  {item.hint}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
