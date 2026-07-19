import { InfoHint } from "./Tooltip";
import { Button } from "./Button";

export type CategoryLayerId = "from-snap" | "primitives" | "system-roles";

const LAYERS: Array<{ id: CategoryLayerId; label: string; tip: string }> = [
  {
    id: "from-snap",
    label: "From snap",
    tip: "Raw capture inventory — assign roles or exclude. Not the exported system by itself.",
  },
  {
    id: "primitives",
    label: "Primitives",
    tip: "Named values the system keeps after merges — rename, un-merge, or remove. These export.",
  },
  {
    id: "system-roles",
    label: "System roles",
    tip: "Appendix B semantic slots pointing at primitives — the roles that lead design.md.",
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
 * Sticky jump chips under the category title. Click expands the band (if
 * collapsed) and scrolls to it.
 */
export function CategoryLayerNav({ counts, openLayers, onJumpToLayer }: CategoryLayerNavProps) {
  return (
    <nav
      aria-label="Token layers"
      className="sticky top-0 z-sticky -mx-1 flex gap-2 overflow-x-auto bg-surface-page/95 px-1 py-2 backdrop-blur-sm"
    >
      {LAYERS.map((layer) => {
        const count = counts?.[layer.id];
        const active = openLayers?.[layer.id] ?? false;
        const label = count !== undefined ? `${layer.label} (${count})` : layer.label;
        return (
          <a
            key={layer.id}
            href={`#layer-${layer.id}`}
            onClick={(e) => {
              if (onJumpToLayer) {
                e.preventDefault();
                onJumpToLayer(layer.id);
              }
            }}
            className={`inline-flex shrink-0 items-center gap-1.5 rounded-sm border-2 px-3 py-1.5 font-mono text-caption ${
              layer.id === "from-snap"
                ? active
                  ? "border-dashed border-brand-primary bg-surface-page text-brand-primary"
                  : "border-dashed border-border-default bg-surface-page text-text-muted hover:border-brand-primary hover:text-brand-primary"
                : active
                  ? "border-brand-primary bg-surface-card text-brand-primary"
                  : "border-border-default bg-surface-card text-text-primary hover:border-brand-primary"
            }`}
          >
            {label}
            <InfoHint content={layer.tip} />
          </a>
        );
      })}
    </nav>
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
      className={`scroll-mt-16 flex w-full flex-col gap-3 rounded-md border-2 p-4 ${
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
                title="Raw capture inventory — assign or exclude; not the exported system by itself"
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
              Source inventory from your snap — review and assign; the system below is what exports.
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
