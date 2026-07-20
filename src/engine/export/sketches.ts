// Phase 9a — component sketches (PRD §11): one line per same-element capture
// group, reconstructed from RAW tokens so a member whose value merged into
// another group still contributes its role (the oracle's Card radius lives on
// a Figma survivor). Anatomy beyond what was captured is never invented.
// Schema 2.1: padding/margin sides, hover/focus, layout recipes.

import type { StyleSnapToken } from "../../contract/types";
import { fallbackName, isSpaceSemanticRole, roleOrderIndex } from "../roles";
import type { ExportInput } from "./index";

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Part labels in anatomy order — the order parts appear on a sketch line. */
const PART_ORDER = [
  "bg",
  "border",
  "radius",
  "shadow",
  "hover →",
  "focus →",
  "inner gap",
  "padding",
  "layout",
  "title",
] as const;
type PartLabel = (typeof PART_ORDER)[number];

/** Page-scaffold elements can't anchor a component sketch. */
const SCAFFOLD_ELEMENTS = new Set(["html", "body", "main", "header", "footer"]);

/** A Figma layer path like "Button/Primary" (never a CSS selector). */
const isFigmaSource = (source: string) => source.includes("/") && !source.startsWith(".");

/**
 * What a raw member describes on the component, or undefined when it isn't
 * component anatomy (text colors, page-level styles, style-sheet captures).
 */
function partLabel(raw: StyleSnapToken): PartLabel | undefined {
  const css = raw.context?.cssProperty;
  switch (raw.type) {
    case "color":
      if (css === "background-color") {
        if (raw.context?.state === "hover") return "hover →";
        if (raw.context?.state === "focus") return "focus →";
        return "bg";
      }
      if (css === "outline-color") return "focus →";
      return css === "border-color" ? "border" : undefined;
    case "gradient":
      return css === "background-image" || css === undefined ? "bg" : undefined;
    case "typography":
      return raw.context?.element === "h1" || raw.context?.element === "h2"
        ? "title"
        : undefined;
    case "spacing":
      if (css === "gap" || css === "row-gap" || css === "column-gap") return "inner gap";
      if (
        css === "padding" ||
        css === "margin" ||
        css?.startsWith("padding-") ||
        css?.startsWith("margin-")
      ) {
        return "padding";
      }
      return undefined;
    case "border-radius":
      return "radius";
    case "border-width":
      return css === "outline-width" ? "focus →" : "border";
    case "shadow":
      return "shadow";
  }
}

function layoutPhrase(raw: StyleSnapToken): string | undefined {
  const layout = raw.context?.layout;
  if (!layout) return undefined;
  const bits: string[] = [layout.display];
  if (layout.flexDirection && layout.flexDirection !== "row") {
    bits.push(layout.flexDirection);
  }
  if (layout.gapPx !== undefined) bits.push(`gap ${layout.gapPx}px`);
  if (layout.maxWidthPx !== undefined) bits.push(`max-width ${layout.maxWidthPx}px`);
  if (layout.alignItems && layout.alignItems !== "normal" && layout.alignItems !== "stretch") {
    bits.push(`align ${layout.alignItems}`);
  }
  return bits.join(" ");
}

/**
 * When one primitive fills several roles (e.g. brand blue → primary + link),
 * pick the role that matches the anatomy part — not taxonomy order alone
 * (text/link sorts before action/primary in Appendix B).
 */
function sketchRoleRank(part: PartLabel, role: string): number {
  if (part === "bg") {
    if (role.startsWith("color/action/")) return 0;
    if (role.startsWith("color/surface/")) return 1;
    if (role.startsWith("gradient/")) return 0;
    if (role.startsWith("color/text/")) return 8;
  }
  if (part === "border" || part === "focus →") {
    if (role.startsWith("color/border/")) return 0;
  }
  if ((part === "title") && role.startsWith("color/text/")) return 0;
  return 4;
}

export interface SketchLine {
  captureId: string;
  text: string;
  /** Raw index of the group's first contributing member — the sort key. */
  order: number;
}

export function componentSketches(input: ExportInput): SketchLine[] {
  const reviewedById = new Map(input.tokens.map((t) => [t.id, t]));
  const survivorOf = new Map<string, StyleSnapToken>();
  for (const token of input.tokens) {
    survivorOf.set(token.id, token);
    for (const id of token.mergedFrom ?? []) survivorOf.set(id, token);
  }
  const rolesOf = new Map<string, string[]>();
  for (const [role, tokenId] of input.assignments) {
    rolesOf.set(tokenId, [...(rolesOf.get(tokenId) ?? []), role]);
  }
  // Default sort for non-part-aware callers; per-part re-sort happens below.
  for (const roles of rolesOf.values()) {
    roles.sort((a, b) => {
      const aSem = isSpaceSemanticRole(a) ? 0 : 1;
      const bSem = isSpaceSemanticRole(b) ? 0 : 1;
      if (aSem !== bSem) return aSem - bSem;
      return roleOrderIndex(a) - roleOrderIndex(b) || byString(a, b);
    });
  }

  const rawInOrder = [...input.rawById.values()];
  const rawIndex = new Map(rawInOrder.map((t, i) => [t.id, i]));
  const groups = new Map<string, StyleSnapToken[]>();
  for (const raw of rawInOrder) {
    groups.set(raw.captureId, [...(groups.get(raw.captureId) ?? []), raw]);
  }

  const lines: SketchLine[] = [];
  for (const [captureId, members] of groups) {
    const anchors = members.filter(
      (m) =>
        m.context?.selector !== undefined ||
        (m.context?.element !== undefined && !SCAFFOLD_ELEMENTS.has(m.context.element)),
    );
    if (anchors.length === 0) continue;

    const parts = new Map<PartLabel, string[]>();
    const contributors: StyleSnapToken[] = [];
    let assignedCount = 0;
    let firstRenderable = Number.MAX_SAFE_INTEGER;
    for (const raw of members) {
      const label = partLabel(raw);
      if (!label) continue;
      const survivor = survivorOf.get(raw.id) ?? reviewedById.get(raw.id);
      if (!survivor) continue;
      const roles = rolesOf.get(survivor.id);
      let ref: string;
      if (roles && roles.length > 0) {
        const ranked = [...roles].sort(
          (a, b) =>
            sketchRoleRank(label, a) - sketchRoleRank(label, b) ||
            (isSpaceSemanticRole(a) ? 0 : 1) - (isSpaceSemanticRole(b) ? 0 : 1) ||
            roleOrderIndex(a) - roleOrderIndex(b) ||
            byString(a, b),
        );
        ref = `\`${ranked[0]}\``;
        assignedCount++;
      } else {
        const name = input.names.get(survivor.id) ?? survivor.name;
        if (!name) continue;
        ref = `\`${name}\``;
      }
      contributors.push(raw);
      firstRenderable = Math.min(firstRenderable, rawIndex.get(raw.id) ?? 0);
      const refs = parts.get(label) ?? [];
      if (!refs.includes(ref)) parts.set(label, [...refs, ref]);
    }

    // Layout phrase from any member that carried a layout recipe.
    for (const raw of members) {
      const phrase = layoutPhrase(raw);
      if (!phrase) continue;
      const refs = parts.get("layout") ?? [];
      if (!refs.includes(phrase)) parts.set("layout", [...refs, phrase]);
      break;
    }

    if (assignedCount < 2) continue;

    const selectors = [
      ...new Set(
        contributors
          .map((m) => m.context?.selector?.replace(/:[a-z-]+$/i, ""))
          .filter((s): s is string => s !== undefined),
      ),
    ].sort(byString);
    const figmaSources = [
      ...new Set(
        contributors.flatMap((m) => {
          const survivor = survivorOf.get(m.id);
          const absorbed = (survivor?.mergedFrom ?? [])
            .map((id) => input.rawById.get(id)?.source)
            .filter((s): s is string => s !== undefined);
          return [m.source, survivor?.source, ...absorbed].filter(
            (s): s is string => s !== undefined && isFigmaSource(s),
          );
        }),
      ),
    ].sort(byString);
    const descriptorParts = [
      ...selectors.slice(0, 1).map((s) => `\`${s}\``),
      ...figmaSources.slice(0, 1).map((s) => `Figma \`${s}\``),
    ];
    const descriptor = descriptorParts.join(" / ");

    const name = sketchName(figmaSources[0], anchors, selectors[0]);

    const body = PART_ORDER.filter((label) => parts.has(label))
      .map((label) => {
        const refs = parts.get(label)!.sort(byString);
        if (label === "layout") return `layout ${refs.join("; ")}`;
        const joiner = label === "padding" || label === "inner gap" ? "/" : " ";
        return `${label} ${refs.join(joiner)}`;
      })
      .join(" · ");

    lines.push({
      captureId,
      text: `**${name}** (${descriptor || "capture"}): ${body}.`,
      order: firstRenderable,
    });
  }
  return lines.sort((a, b) => a.order - b.order || byString(a.captureId, b.captureId));
}

function sketchName(
  figmaSource: string | undefined,
  anchors: StyleSnapToken[],
  selector: string | undefined,
): string {
  if (figmaSource) return figmaSource.split("/")[0]!;
  for (const anchor of anchors) {
    const el = anchor.context?.element;
    if (el === "input" || el === "textarea" || el === "select") return "Input";
    if (el === "button" || anchor.context?.ariaRole === "button") return "Button";
  }
  if (selector) {
    const word = selector.replace(/^[.#]/, "").split(/[^a-zA-Z0-9]/)[0]!;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }
  const first = anchors[0]!;
  const label = fallbackName(first);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function componentsSection(input: ExportInput): string {
  const sketches = componentSketches(input);
  const lines = ["## Components (derived from captures)", ""];
  if (sketches.length === 0) {
    lines.push("*(no same-element groups with two or more assigned tokens yet)*");
    return lines.join("\n");
  }
  lines.push(
    "Sketches reconstructed from same-element capture groups; anatomy beyond this",
    "was not captured.",
    "",
    ...sketches.map((s) => `- ${s.text}`),
  );
  return lines.join("\n");
}
