import type { StyleSnapToken, TokenType } from "../shared/types";

const GROUPS: { type: TokenType; label: string }[] = [
  { type: "color", label: "Color" },
  { type: "typography", label: "Typography" },
  { type: "spacing", label: "Spacing" },
  { type: "border-radius", label: "Radius" },
  { type: "border-width", label: "Border" },
  { type: "shadow", label: "Shadow" },
];

function valueLabel(t: StyleSnapToken): string {
  switch (t.type) {
    case "color":
      return `${t.value}${t.opacity < 1 ? ` · ${Math.round(t.opacity * 100)}%` : ""}`;
    case "typography":
      return `${t.value.fontFamily} ${t.value.fontSize}px / ${t.value.fontWeight}`;
    case "spacing":
    case "border-radius":
    case "border-width":
      return `${t.value}px`;
    case "shadow":
      return `${t.value.offsetX},${t.value.offsetY} blur ${t.value.blur} · ${t.value.color}`;
  }
}

function Preview({ t }: { t: StyleSnapToken }) {
  if (t.type === "color")
    return (
      <span
        className="swatch"
        style={{ background: t.value, opacity: t.opacity }}
        aria-hidden
      />
    );
  return <span className="swatch swatch--meta" aria-hidden />;
}

export function TokenList({
  tokens,
  onRemove,
}: {
  tokens: StyleSnapToken[];
  onRemove: (id: string) => void;
}) {
  return (
    <div className="list">
      {GROUPS.map(({ type, label }) => {
        const items = tokens.filter((t) => t.type === type);
        if (items.length === 0) return null;
        return (
          <section key={type} className="group" aria-label={label}>
            <h2 className="group-title">
              {label} <span className="count">{items.length}</span>
            </h2>
            {items.map((t) => (
              <div className="row" key={t.id}>
                <Preview t={t} />
                <div className="row-text">
                  <span className="row-value">{valueLabel(t)}</span>
                  <span className="row-source">{t.source}</span>
                </div>
                <button
                  className="remove"
                  onClick={() => onRemove(t.id)}
                  aria-label={`Remove ${label} token from ${t.source}`}
                >
                  ×
                </button>
              </div>
            ))}
          </section>
        );
      })}
    </div>
  );
}
