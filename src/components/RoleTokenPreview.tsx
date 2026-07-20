import type { StyleSnapToken } from "../contract/types";
import { isBackdropBlurToken, backdropBlurPx } from "../engine/effect-kinds";
import {
  cssColor,
  cssGradient,
  cssShadow,
  humanValueLabel,
  describeShadowValue,
  previewBorderStrokeColor,
  type TokenPreviewContext,
  EMPTY_PREVIEW_CONTEXT,
} from "../state/token-display";

const CHECKERBOARD: React.CSSProperties = {
  backgroundColor: "#FFFFFF",
  backgroundImage: "repeating-conic-gradient(#ECEAF2 0% 25%, #FFFFFF 0% 50%)",
  backgroundSize: "10px 10px",
};

/** Flush left strip — StyleSnap backdrop; inner specimen uses captured roles. */
const STRIP =
  "flex h-full w-16 shrink-0 self-stretch overflow-hidden border-r-2 border-border-default bg-state-disabled-bg sm:w-[5.5rem]";

/** Same square tile for every shadow preview (inset + drop). */
const SHADOW_TILE = "size-14 shrink-0";

/** Two equal blocks separated by the token gap — fixed 20px tiles, real gap (clip if wide). */
function SpacingSpecimen({ gapPx, preview }: { gapPx: number; preview: TokenPreviewContext }) {
  const blockPx = 20;
  const stroke = previewBorderStrokeColor(preview);
  const blockStyle: React.CSSProperties = {
    width: blockPx,
    height: blockPx,
    boxSizing: "border-box",
    backgroundColor: preview.surfaceCard,
    border: `1px solid ${stroke}`,
    borderRadius: preview.cardRadiusPx,
    flexShrink: 0,
  };

  return (
    <div className="flex w-full items-center justify-center overflow-hidden px-1">
      <div className="flex items-center" style={{ gap: gapPx }}>
        <div style={blockStyle} />
        <div style={blockStyle} />
      </div>
    </div>
  );
}


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
  /** Captured design roles for the specimen inside the strip — not the strip backdrop. */
  preview?: TokenPreviewContext;
}

/** Left preview strip for filled role rows — one surface, no nested framed squares. */
export function RoleTokenPreview({ token, role, preview = EMPTY_PREVIEW_CONTEXT }: RoleTokenPreviewProps) {
  const title = humanValueLabel(token, role);

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
        <PreviewStrip title={title} className="items-center justify-center">
          <SpacingSpecimen gapPx={token.value} preview={preview} />
        </PreviewStrip>
      );
    case "border-radius":
      return (
        <PreviewStrip
          title={title}
          className="items-center justify-center"
        >
          <div
            className="h-[70%] w-[70%]"
            style={{ backgroundColor: preview.surfaceCard, borderRadius: token.value }}
          />
        </PreviewStrip>
      );
    case "border-width": {
      const width = Math.max(0, token.value);
      const stroke = previewBorderStrokeColor(preview);
      return (
        <PreviewStrip
          title={`${humanValueLabel(token, role)} · stroke ${preview.borderDefault}`}
          className="items-center justify-center"
        >
          <div
            className="box-border"
            style={{
              width: "70%",
              height: "70%",
              backgroundColor: preview.surfaceCard,
              border: `${width}px solid ${stroke}`,
              borderRadius: preview.cardRadiusPx,
            }}
          />
        </PreviewStrip>
      );
    }
    case "shadow": {
      if (isBackdropBlurToken(token)) {
        const blur = backdropBlurPx(token);
        return (
          <PreviewStrip title={title} className="items-center justify-center">
            <div
              className={SHADOW_TILE}
              style={{
                backgroundColor: preview.surfaceCard,
                borderRadius: preview.cardRadiusPx,
                backdropFilter: `blur(${blur}px)`,
                WebkitBackdropFilter: `blur(${blur}px)`,
                backgroundImage:
                  "linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.2))",
                border: `1px solid ${previewBorderStrokeColor(preview)}`,
              }}
            />
          </PreviewStrip>
        );
      }
      return (
        <PreviewStrip
          title={`${describeShadowValue(token.value)}${role ? ` (${role})` : ""}`}
          className="items-center justify-center"
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
