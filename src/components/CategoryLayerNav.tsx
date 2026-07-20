import { useEffect, useRef, useState } from "react";
import { UndoRedoToolbar } from "./shell/UndoRedoToolbar";
import { InfoHint } from "./Tooltip";
import { Button } from "./Button";

export type CategoryLayerId = "from-snap" | "primitives" | "system-roles";

const LAYERS: Array<{ id: CategoryLayerId; label: string; tip: string }> = [
  {
    id: "from-snap",
    label: "From snap",
    tip: "What you captured. Assign a role or exclude noise. This list is not the export.",
  },
  {
    id: "primitives",
    label: "Primitives",
    tip: "Named values the system keeps. Rename, un-merge, or remove. These export.",
  },
  {
    id: "system-roles",
    label: "System roles",
    tip: "Jobs for colors and type — like “primary button.” Each points at a primitive. These lead design.md.",
  },
];

interface CategoryLayerNavProps {
  counts?: Partial<Record<CategoryLayerId, number>>;
  /** Which bands are expanded — chips highlight open ones. */
  openLayers?: Record<CategoryLayerId, boolean>;
  /** Jump to a layer: expand it then scroll. */
  onJumpToLayer?: (id: CategoryLayerId) => void;
}

/**
 * Sticky jump chips under the category title. Undo/Redo sit here on desktop;
 * on small screens they use FloatingUndoRedo so chips stay usable.
 */
export function CategoryLayerNav({ counts, openLayers, onJumpToLayer }: CategoryLayerNavProps) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [stuck, setStuck] = useState(false);
  const [mobileNavPx, setMobileNavPx] = useState(0);

  useEffect(() => {
    const sync = () => {
      const header = document.getElementById("mobile-session-nav");
      if (!header || getComputedStyle(header).display === "none") {
        setMobileNavPx(0);
        return;
      }
      setMobileNavPx(header.offsetHeight);
    };
    sync();
    window.addEventListener("resize", sync);
    const header = document.getElementById("mobile-session-nav");
    const ro = new ResizeObserver(sync);
    if (header) ro.observe(header);
    return () => {
      window.removeEventListener("resize", sync);
      ro.disconnect();
    };
  }, []);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      ([entry]) => setStuck(!entry?.isIntersecting),
      {
        threshold: [1],
        // Treat the mobile header as outside the "visible" top so stuck matches pin point.
        rootMargin: mobileNavPx > 0 ? `-${mobileNavPx}px 0px 0px 0px` : "0px",
      },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [mobileNavPx]);

  return (
    <>
      {/* When this leaves the pin line, the sticky nav below is stuck. */}
      <div ref={sentinelRef} className="h-px w-full shrink-0" aria-hidden />
      <nav
        aria-label="Token layers"
        style={{ top: mobileNavPx > 0 ? mobileNavPx : undefined }}
        className={`sticky z-sticky -mx-1 flex items-center gap-2 bg-surface-page/95 px-1 py-2 backdrop-blur-sm ${
          mobileNavPx > 0 ? "" : "top-0"
        } ${stuck ? "border-b-2 border-border-default" : "border-b-2 border-transparent"}`}
      >
        <div className="flex min-w-0 flex-1 gap-2 overflow-x-auto">
          {LAYERS.map((layer) => {
            const count = counts?.[layer.id];
            const active = openLayers?.[layer.id] ?? false;
            const label = count !== undefined ? `${layer.label} (${count})` : layer.label;
            const chipClass =
              layer.id === "from-snap"
                ? active
                  ? "border-dashed border-brand-primary bg-surface-page text-brand-primary"
                  : "border-dashed border-border-default bg-surface-page text-text-muted"
                : active
                  ? "border-brand-primary bg-surface-card text-brand-primary"
                  : "border-border-default bg-surface-card text-text-primary";
            return (
              <div
                key={layer.id}
                className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border-2 px-3 py-1.5 font-mono text-caption ${chipClass}`}
              >
                <a
                  href={`#layer-${layer.id}`}
                  onClick={(e) => {
                    if (onJumpToLayer) {
                      e.preventDefault();
                      onJumpToLayer(layer.id);
                    }
                  }}
                  className="hover:text-brand-primary"
                >
                  {label}
                </a>
                <InfoHint content={layer.tip} />
              </div>
            );
          })}
        </div>
        <div className="hidden shrink-0 lg:block">
          <UndoRedoToolbar />
        </div>
      </nav>
    </>
  );
}

interface LayerSectionProps {
  id: CategoryLayerId;
  title: string;
  tip: string;
  count?: number;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
  actions?: React.ReactNode;
  insight?: string;
}

/**
 * From snap = raw capture inventory (dashed, page surface, no hard shadow).
 * Primitives / System roles = the exportable system (solid card + shadow).
 */
export function LayerSection({
  id,
  title,
  tip,
  count,
  open,
  onToggle,
  children,
  actions,
  insight,
}: LayerSectionProps) {
  const isCapture = id === "from-snap";

  return (
    <section
      id={`layer-${id}`}
      className={`scroll-mt-[calc(var(--session-mobile-nav-height,0px)+4.5rem)] flex w-full flex-col gap-3 rounded-md border-2 p-4 ${
        isCapture
          ? "border-dashed border-border-default bg-surface-page"
          : "border-solid border-border-default bg-surface-card shadow-card"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            {isCapture && (
              <span
                className="rounded-sm border-2 border-border-default bg-brand-pop px-2 py-0.5 font-mono text-badge font-medium text-text-primary"
                title="Captured values — assign or exclude. Not the export."
              >
                capture
              </span>
            )}
            <h2 className="flex flex-wrap items-center gap-2 font-heading text-card-title font-medium">
              {title}
              {count !== undefined && (
                <span className="font-mono text-caption font-normal text-text-muted">({count})</span>
              )}
              <InfoHint content={tip} />
            </h2>
          </div>
          {isCapture && (
            <p className="text-caption text-text-muted">
              What came from your snap. Review here; Primitives and Roles below are what export.
            </p>
          )}
          {insight && <p className="text-caption text-text-muted">{insight}</p>}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {actions}
          <Button
            size="sm"
            variant="ghost"
            onClick={onToggle}
            aria-expanded={open}
            aria-controls={`layer-${id}-body`}
          >
            {open ? "Collapse" : "Show"}
          </Button>
        </div>
      </div>
      {open ? (
        <div id={`layer-${id}-body`} className="flex flex-col gap-3">
          {children}
        </div>
      ) : null}
    </section>
  );
}
