import type {
  GradientValue,
  ShadowValue,
  StyleSnapToken,
  TypographyValue,
} from "../contract/types";

// Captured values (hexes, gradients, shadows) are DATA, not design tokens —
// they must render exactly as captured, so inline styles are correct here.
// Everything chrome-like (borders, radii, captions) stays on DESIGN.md tokens.

function cssColor(hex: string, opacity: number): string {
  if (opacity >= 1) return hex;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

function cssGradient(value: GradientValue): string {
  const stops = value.stops
    .map((s) => `${cssColor(s.color, s.opacity)} ${s.position * 100}%`)
    .join(", ");
  switch (value.kind) {
    case "linear":
      return `linear-gradient(${value.angle ?? 180}deg, ${stops})`;
    case "radial":
      return `radial-gradient(circle, ${stops})`;
    case "conic":
      return `conic-gradient(${stops})`;
  }
}

function cssShadow(value: ShadowValue): string {
  return value
    .map(
      (l) =>
        `${l.inset ? "inset " : ""}${l.offsetX}px ${l.offsetY}px ${l.blur}px ${l.spread}px ${cssColor(l.color, l.opacity)}`,
    )
    .join(", ");
}

// DESIGN.md §5.1: swatches with transparency render over a checkerboard of
// surface-card (#FFFFFF) / state-disabled-bg (#ECEAF2).
const CHECKERBOARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage:
    "repeating-conic-gradient(#ECEAF2 0% 25%, #FFFFFF 0% 50%)",
  backgroundSize: "12px 12px",
};

const swatchFrame = "h-12 w-12 shrink-0 rounded-sm border-2 border-border-default";
const caption = "font-mono text-caption text-text-muted";

function Caption({ children }: { children: React.ReactNode }) {
  return <span className={caption}>{children}</span>;
}

function ColorPreview({ hex, opacity }: { hex: string; opacity: number }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`${swatchFrame} overflow-hidden`} style={opacity < 1 ? CHECKERBOARD : undefined}>
        <div className="h-full w-full" style={{ backgroundColor: cssColor(hex, opacity) }} />
      </div>
      <Caption>
        {hex}
        {opacity < 1 && ` @ ${Math.round(opacity * 100)}%`}
      </Caption>
    </div>
  );
}

function GradientPreview({ value }: { value: GradientValue }) {
  return (
    <div className="flex items-center gap-3">
      <div className={swatchFrame} style={{ backgroundImage: cssGradient(value) }} />
      <Caption>
        {value.kind}
        {value.kind === "linear" && value.angle !== undefined && ` ${value.angle}°`}
      </Caption>
    </div>
  );
}

function TypographyPreview({ value }: { value: TypographyValue }) {
  const stack = value.fontStack?.join(", ") ?? value.fontFamily;
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden
        className="shrink-0 leading-none text-text-primary"
        style={{
          fontFamily: stack,
          fontWeight: value.fontWeight,
          fontStyle: value.fontStyle ?? "normal",
          fontSize: Math.min(value.fontSize, 48), // §5.1: clamp specimen to 48px
          letterSpacing: value.letterSpacing,
          textTransform: value.textTransform ?? "none",
        }}
      >
        Ag
      </span>
      <Caption>
        {value.fontFamily} · {value.fontSize}px/{value.fontWeight} · lh {value.lineHeight}
        {value.letterSpacing !== undefined && ` · ${value.letterSpacing}px tracking`}
        {value.textTransform && value.textTransform !== "none" && ` · ${value.textTransform}`}
      </Caption>
    </div>
  );
}

function NumericPreview({
  kind,
  value,
}: {
  kind: "spacing" | "border-radius" | "border-width";
  value: number;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="inline-flex shrink-0 items-center rounded-sm border-2 border-border-default bg-surface-page px-2 py-1 font-mono text-caption text-text-primary">
        {value}px
      </span>
      {kind === "spacing" && (
        <div
          className="h-2 rounded-sm bg-brand-primary"
          style={{ width: Math.min(value, 96) }}
          aria-hidden
        />
      )}
      {kind === "border-radius" && (
        <div
          className="h-6 w-6 border-2 border-border-default"
          style={{ borderRadius: `${Math.min(value, 24)}px 0 0 0` }}
          aria-hidden
        />
      )}
      {kind === "border-width" && (
        <div
          className="w-12 border-border-default"
          style={{ borderTopWidth: value, borderTopStyle: "solid" }}
          aria-hidden
        />
      )}
    </div>
  );
}

function ShadowPreview({ value }: { value: ShadowValue }) {
  return (
    <div className="flex items-center gap-3">
      {/* §5.1: card-colored square casting the real shadow on a page backdrop. */}
      <div className="shrink-0 rounded-sm bg-surface-page p-3">
        <div className="h-12 w-12 rounded-sm bg-surface-card" style={{ boxShadow: cssShadow(value) }} />
      </div>
      <Caption>
        {value
          .map((l) => `${l.inset ? "inset " : ""}${l.offsetX} ${l.offsetY} ${l.blur} ${l.spread}`)
          .join(" · ")}
      </Caption>
    </div>
  );
}

export function TokenPreview({ token }: { token: StyleSnapToken }) {
  switch (token.type) {
    case "color":
      return <ColorPreview hex={token.value} opacity={token.opacity} />;
    case "gradient":
      return <GradientPreview value={token.value} />;
    case "typography":
      return <TypographyPreview value={token.value} />;
    case "spacing":
    case "border-radius":
    case "border-width":
      return <NumericPreview kind={token.type} value={token.value} />;
    case "shadow":
      return <ShadowPreview value={token.value} />;
  }
}
