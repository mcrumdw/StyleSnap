// PRD §7.7 — naming. Slash-nested everywhere (Figma Variables' native
// nesting). FR-21: inline-editable names. FR-22: naming never blocks —
// unnamed tokens export with a generated, deterministic fallback.
//
// §2.65 — UI locks the type folder (`color/`, `blur/`, …); the user types only
// the path after it (optional extra `/` segments for nesting).

import type { StyleSnapToken } from "../../contract/types";
import { backdropBlurPx, isBackdropBlurToken } from "../effect-kinds";
import { normalizeRolePath } from "./custom";

export type EffectNameKind = "drop" | "inset" | "backdrop-blur";

export type NamePrefixOptions = { effectKind?: EffectNameKind };

// Segments: lowercase letters/digits, hyphen-joined; at least two segments
// (primitives live under a type prefix: "color/brand-indigo").
const SLASH_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)+$/;

export const NAME_ERROR =
  "Use lowercase letters, numbers, and hyphens — add / for folders (e.g. action/primary).";

/** Returns an error message, or null when the name is valid. */
export function validateSlashName(name: string): string | null {
  return SLASH_NAME.test(name) ? null : NAME_ERROR;
}

/**
 * Locked type folder for primitive names. Backdrop blur uses `blur/`; drop and
 * inset shadows use `shadow/`.
 */
export function namePrefixForType(
  tokenType: StyleSnapToken["type"],
  options?: NamePrefixOptions,
): string {
  switch (tokenType) {
    case "color":
      return "color/";
    case "gradient":
      return "gradient/";
    case "typography":
      return "type/";
    case "spacing":
      return "space/";
    case "border-radius":
      return "radius/";
    case "border-width":
      return "border-width/";
    case "shadow":
      if (options?.effectKind === "backdrop-blur") return "blur/";
      return "shadow/";
  }
}

/** What the user types after the locked prefix (may include extra `/` folders). */
export function nameSuffixPlaceholder(
  tokenType: StyleSnapToken["type"],
  options?: NamePrefixOptions,
): string {
  switch (tokenType) {
    case "color":
      return "brand-blue";
    case "gradient":
      return "hero";
    case "typography":
      return "inter-16-400";
    case "spacing":
      return "md";
    case "border-radius":
      return "md";
    case "border-width":
      return "default";
    case "shadow":
      if (options?.effectKind === "backdrop-blur") return "medium";
      if (options?.effectKind === "inset") return "pressed";
      return "card-elevation";
  }
}

/** Full example path — prefix + suffix (tests / legacy callers). */
export function namePlaceholder(
  tokenType: StyleSnapToken["type"],
  options?: NamePrefixOptions,
): string {
  return `${namePrefixForType(tokenType, options)}${nameSuffixPlaceholder(tokenType, options)}`;
}

/** Effect kind for naming UI when editing an existing shadow/blur token. */
export function effectKindForToken(token: StyleSnapToken): EffectNameKind | undefined {
  if (token.type !== "shadow") return undefined;
  if (isBackdropBlurToken(token)) return "backdrop-blur";
  if (token.value[0]?.inset) return "inset";
  return "drop";
}

/** Strip the locked prefix for the suffix-only input; leave other paths intact. */
export function stripNamePrefix(fullName: string, prefix: string): string {
  const trimmed = fullName.trim();
  if (trimmed.startsWith(prefix)) return trimmed.slice(prefix.length);
  return trimmed;
}

/**
 * Build a full slash name from the locked prefix + user suffix.
 * Empty suffix → empty name (optional). If the user pastes a path that already
 * starts with this prefix, the prefix is not doubled.
 */
export function composeSlashName(
  prefix: string,
  rawSuffix: string,
): { name: string } | { error: string } {
  const trimmed = rawSuffix.trim();
  if (!trimmed) return { name: "" };

  let path = trimmed.toLowerCase().replace(/[_\s]+/g, "-");
  if (path.startsWith(prefix)) {
    path = path.slice(prefix.length);
  }
  path = path.replace(/^\/+|\/+$/g, "");
  if (!path) {
    return { error: "Add a name after the prefix." };
  }

  const normalized = normalizeRolePath(path);
  if (!normalized) {
    return { error: NAME_ERROR };
  }

  const full = `${prefix}${normalized}`;
  const problem = validateSlashName(full);
  if (problem) return { error: problem };
  return { name: full };
}

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

/**
 * Pull a slash name from capture context (authored CSS var / utility) when it
 * already looks like a radius or border-width primitive path (§2.52).
 */
function nameFromAuthoredContext(token: StyleSnapToken): string | null {
  const raw = token.context?.authoredName?.trim();
  if (!raw) return null;

  if (validateSlashName(raw) === null) {
    if (token.type === "border-radius" && raw.startsWith("radius/")) return raw;
    if (token.type === "border-width" && raw.startsWith("border-width/")) return raw;
  }

  const cleaned = raw.replace(/^--/, "").toLowerCase();

  if (token.type === "border-radius") {
    const rounded = cleaned.match(/^rounded-?(full|none|sm|md|lg|xl|2xl|3xl)?$/);
    if (rounded) {
      const step = rounded[1];
      if (!step || step === "none") return null;
      return `radius/${step === "full" ? "full" : step}`;
    }
    const m = cleaned.match(/^(?:radius|border-radius)[/_.-](.+)$/);
    if (m?.[1]) {
      const step = slug(m[1]);
      if (step && step !== "none") return `radius/${step}`;
    }
  }

  if (token.type === "border-width") {
    const m = cleaned.match(/^(?:border-width|bw)[/_.-](.+)$/);
    if (m?.[1]) {
      const step = slug(m[1]);
      if (step) return `border-width/${step}`;
    }
  }

  return null;
}

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
      const angle =
        token.value.kind === "linear" && token.value.angle !== undefined
          ? `-${token.value.angle}`
          : "";
      return `gradient/${token.value.kind}${angle}`;
    }
    case "typography": {
      const v = token.value;
      const transform =
        v.textTransform && v.textTransform !== "none" ? `-${v.textTransform}` : "";
      return `type/${slug(v.fontFamily)}-${v.fontSize}-${v.fontWeight}${transform}`;
    }
    case "spacing":
      return `space/${token.value}`;
    case "border-radius": {
      const fromContext = nameFromAuthoredContext(token);
      if (fromContext) return fromContext;
      // CSS "9999px" / extreme values are pill / full radius.
      if (token.value >= 999) return "radius/full";
      const px = Number.isInteger(token.value) ? String(token.value) : String(token.value);
      return `radius/${px}`;
    }
    case "border-width": {
      const fromContext = nameFromAuthoredContext(token);
      if (fromContext) return fromContext;
      const px = Number.isInteger(token.value) ? String(token.value) : String(token.value);
      return `border-width/${px}`;
    }
    case "shadow": {
      if (isBackdropBlurToken(token)) {
        return `blur/backdrop-${backdropBlurPx(token)}`;
      }
      const l = token.value[0];
      const n = (v: number) => (v < 0 ? `n${-v}` : `${v}`); // negatives stay slug-safe
      const inset = l.inset ? "inset-" : "";
      return `shadow/${inset}${n(l.offsetX)}-${n(l.offsetY)}-${n(l.blur)}-${n(l.spread)}`;
    }
  }
}
