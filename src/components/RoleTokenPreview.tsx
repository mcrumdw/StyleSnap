import type { StyleSnapToken } from "../contract/types";
import {
  cssColor,
  cssGradient,
  cssShadow,
  humanValueLabel,
  describeShadowValue,
  type TokenPreviewContext,
  EMPTY_PREVIEW_CONTEXT,
} from "../state/token-display";

const CHECKERBOARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage: "repeating-conic-gradient(#ECEAF2 0% 25%, #FFFFFF 0% 50%)",
  backgroundSize: "10px 10px",
};

/** Flush left strip — no own corner radius; parent row clips with overflow-hidden. */
const STRIP =
  "flex h-full w-[5.5rem] shrink-0 self-stretch border-r-2 border-border-default overflow-hidden";

/** Same square tile for every shadow preview (inset + drop). */
const SHADOW_TILE = "size-14 shrink-0";

function PreviewStrip({
  title,
  className = "",
  style,
  children,
}: {
  title: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <div className={`${STRIP} ${className}`} title={title} style={style} aria-hidden={children === undefined}>
      {children}
    </div>
  );
}

interface RoleTokenPreviewProps {
  token: StyleSnapToken;
  role?: string;
  /** Captured design roles — previews must not use StyleSnap app chrome (DECISIONS §2.19). */
  preview?: TokenPreviewContext;
}

/** Left preview strip for filled role rows — one surface, no nested framed squares. */
export function RoleTokenPreview({ token, role, preview = EMPTY_PREVIEW_CONTEXT }: RoleTokenPreviewProps) {
  const title =
    token.type === "shadow"
      ? `${describeShadowValue(token.value)}${role ? ` (${role})` : ""}`
      : humanValueLabel(token, role);

  switch (token.type) {
    case "color":
      if (token.opacity < 1) {
        return (
          <PreviewStrip title={title} style={CHECKERBOARD}>
            <div className="h-full w-full" style={{ backgroundColor: cssColor(token.value, token.opacity) }} />
          </PreviewStrip>
        );
      }
      return (
        <PreviewStrip
          title={title}
          style={{ backgroundColor: cssColor(token.value, token.opacity) }}
        />
      );
    case "gradient":
      return (
        <PreviewStrip title={title} style={{ backgroundImage: cssGradient(token.value) }} />
      );
    case "typography": {
      const v = token.value;
      const stack = v.fontStack?.join(", ") ?? v.fontFamily;
      return (
        <PreviewStrip
          title={title}
          className="items-center justify-center"
          style={{ backgroundColor: preview.surfacePage }}
        >
          <span
            style={{
              color: preview.textPrimary,
              fontFamily: stack,
              fontWeight: v.fontWeight,
              fontStyle: v.fontStyle ?? "normal",
              fontSize: Math.min(v.fontSize, 32),
              lineHeight: 1.1,
            }}
          >
            Aa
          </span>
        </PreviewStrip>
      );
    }
    case "spacing":
      return (
        <PreviewStrip
          title={title}
          className="items-center justify-center"
          style={{ backgroundColor: preview.surfacePage }}
        >
          <div className="flex h-[55%] w-[75%] items-center justify-center gap-1">
            <span
              className="h-full w-3"
              style={{ backgroundColor: preview.surfaceCard, borderRadius: preview.cardRadiusPx }}
            />
            <span
              className="h-1 shrink-0"
              style={{
                width: `${Math.min(token.value, 48)}px`,
                backgroundColor: preview.actionPrimary,
                borderRadius: Math.min(preview.cardRadiusPx, 4),
              }}
            />
            <span
              className="h-full w-3"
              style={{ backgroundColor: preview.surfaceCard, borderRadius: preview.cardRadiusPx }}
            />
          </div>
        </PreviewStrip>
      );
    case "border-radius":
      return (
        <PreviewStrip
          title={title}
          className="items-center justify-center"
          style={{ backgroundColor: preview.surfacePage }}
        >
          <div
            className="h-[70%] w-[70%]"
            style={{ backgroundColor: preview.surfaceCard, borderRadius: token.value }}
          />
        </PreviewStrip>
      );
    case "border-width":
      return (
        <PreviewStrip
          title={title}
          className="items-center justify-center p-[18%]"
          style={{ backgroundColor: preview.surfacePage }}
        >
          <div
            className="h-full w-full"
            style={{
              backgroundColor: preview.surfaceCard,
              borderColor: preview.borderDefault,
              borderWidth: token.value,
              borderStyle: "solid",
              borderRadius: preview.cardRadiusPx,
            }}
          />
        </PreviewStrip>
      );
    case "shadow": {
      return (
        <PreviewStrip
          title={title}
          className="items-center justify-center"
          style={{ backgroundColor: preview.surfacePage }}
        >
          <div
            className={SHADOW_TILE}
            style={{
              backgroundColor: preview.surfaceCard,
              borderRadius: preview.cardRadiusPx,
              boxShadow: cssShadow(token.value),
            }}
          />
        </PreviewStrip>
      );
    }
  }
}
