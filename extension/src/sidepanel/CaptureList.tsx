import type { Capture, StyleSnapToken } from "../shared/types";

const TYPE_LABEL: Record<StyleSnapToken["type"], string> = {
  color: "Color",
  gradient: "Gradient",
  typography: "Type",
  spacing: "Spacing",
  "border-radius": "Radius",
  "border-width": "Border",
  shadow: "Shadow",
};

function valueLabel(t: StyleSnapToken): string {
  switch (t.type) {
    case "color":
      return `${t.value}${t.opacity < 1 ? ` · ${Math.round(t.opacity * 100)}%` : ""}`;
    case "gradient":
      return `${t.value.kind}${t.value.angle != null ? ` ${t.value.angle}°` : ""} · ${t.value.stops.length} stops`;
    case "typography":
      return `${t.value.fontFamily} ${t.value.fontSize}px / ${t.value.fontWeight}`;
    case "spacing":
    case "border-radius":
    case "border-width":
      return `${t.value}px`;
    case "shadow":
      return `${t.value.length} layer${t.value.length > 1 ? "s" : ""}`;
  }
}

function Swatch({ t }: { t: StyleSnapToken }) {
  if (t.type === "color")
    return (
      <span
        className="swatch"
        style={{ background: t.value, opacity: t.opacity }}
        aria-hidden
      />
    );
  if (t.type === "gradient") {
    const bg = `linear-gradient(90deg, ${t.value.stops
      .map((s) => s.color)
      .join(", ")})`;
    return <span className="swatch" style={{ background: bg }} aria-hidden />;
  }
  return <span className="swatch swatch--meta" aria-hidden />;
}

function TokenRow({ t }: { t: StyleSnapToken }) {
  return (
    <div className="token-row">
      <Swatch t={t} />
      <span className="token-type">{TYPE_LABEL[t.type]}</span>
      <span className="token-value">{valueLabel(t)}</span>
      {t.context?.cssProperty && (
        <span className="token-ctx">{t.context.cssProperty}</span>
      )}
    </div>
  );
}

export function CaptureList({
  captures,
  onRemove,
}: {
  captures: Capture[];
  onRemove: (captureId: string) => void;
}) {
  return (
    <div className="list">
      {captures.map((c) => (
        <section className="el-card" key={c.captureId} aria-label={c.source}>
          <div className="el-head">
            <span className="el-label" title={c.source}>
              {c.source}
            </span>
            <span className="el-count">{c.tokens.length}</span>
            <button
              className="remove"
              onClick={() => onRemove(c.captureId)}
              aria-label={`Remove capture ${c.source}`}
            >
              ×
            </button>
          </div>
          <div className="el-tokens">
            {c.tokens.map((t) => (
              <TokenRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
