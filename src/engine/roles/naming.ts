// PRD §7.7 — naming. Slash-nested everywhere (Figma Variables' native
// nesting). FR-21: inline-editable names. FR-22: naming never blocks —
// unnamed tokens export with a generated, deterministic fallback.

import type { StyleSnapToken } from "../../contract/types";

// Segments: lowercase letters/digits, hyphen-joined; at least two segments
// (primitives live under a type prefix: "color/brand-indigo").
const SLASH_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

export const NAME_ERROR =
  "Names are slash-nested, like color/action/primary — lowercase letters, numbers, and hyphens.";

/** Returns an error message, or null when the name is valid. */
export function validateSlashName(name: string): string | null {
  return SLASH_NAME.test(name) ? null : NAME_ERROR;
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/** Deterministic generated name for export when the user didn't assign one. */
export function fallbackName(token: StyleSnapToken): string {
  switch (token.type) {
    case "color": {
      const hex = token.value.slice(1).toLowerCase();
      return token.opacity < 1
        ? `color/${hex}-${Math.round(token.opacity * 100)}`
        : `color/${hex}`;
    }
    case "gradient": {
      const angle = token.value.kind === "linear" && token.value.angle !== undefined
        ? `-${token.value.angle}`
        : "";
      return `gradient/${token.value.kind}${angle}`;
    }
    case "typography": {
      const v = token.value;
      const transform = v.textTransform && v.textTransform !== "none" ? `-${v.textTransform}` : "";
      return `type/${slug(v.fontFamily)}-${v.fontSize}-${v.fontWeight}${transform}`;
    }
    case "spacing":
      return `space/${token.value}`;
    case "border-radius":
      return `radius/${token.value}`;
    case "border-width":
      return `border-width/${token.value}`;
    case "shadow": {
      const l = token.value[0];
      const n = (v: number) => (v < 0 ? `n${-v}` : `${v}`); // negatives stay slug-safe
      return `shadow/${n(l.offsetX)}-${n(l.offsetY)}-${n(l.blur)}-${n(l.spread)}`;
    }
  }
}
