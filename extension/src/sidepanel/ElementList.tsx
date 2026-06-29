import type {
  CapturedElement,
  ElementRole,
  StyleSnapToken,
} from "../shared/types";

const ROLES: ElementRole[] = [
  "button",
  "card",
  "menu",
  "input",
  "heading",
  "text",
  "badge",
  "container",
  "image",
  "link",
  "icon",
  "other",
];

const TYPE_LABEL: Record<StyleSnapToken["type"], string> = {
  color: "Color",
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

function TokenRow({ t }: { t: StyleSnapToken }) {
  return (
    <div className="token-row">
      {t.type === "color" ? (
        <span
          className="swatch"
          style={{ background: t.value, opacity: t.opacity }}
          aria-hidden
        />
      ) : (
        <span className="swatch swatch--meta" aria-hidden />
      )}
      <span className="token-type">{TYPE_LABEL[t.type]}</span>
      <span className="token-value">{valueLabel(t)}</span>
    </div>
  );
}

export function ElementList({
  elements,
  onRemove,
  onSetRole,
}: {
  elements: CapturedElement[];
  onRemove: (id: string) => void;
  onSetRole: (id: string, role: ElementRole) => void;
}) {
  return (
    <div className="list">
      {elements.map((el) => (
        <section className="el-card" key={el.id} aria-label={el.label}>
          <div className="el-head">
            <select
              className="role-select"
              value={el.role}
              onChange={(e) => onSetRole(el.id, e.target.value as ElementRole)}
              aria-label={`Element type for ${el.label}`}
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
            <span className="el-label" title={el.label}>
              {el.label}
            </span>
            <button
              className="remove"
              onClick={() => onRemove(el.id)}
              aria-label={`Remove element ${el.label}`}
            >
              ×
            </button>
          </div>
          <div className="el-tokens">
            {el.tokens.map((t) => (
              <TokenRow key={t.id} t={t} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
