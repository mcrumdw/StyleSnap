// FR-26 / §2.66 — build the Figma Variables + Styles handoff from a reviewed
// export session. Pure + deterministic.

import type { StyleSnapToken } from "../../contract/types";
import {
  backdropBlurPx,
  isBackdropBlurToken,
  isInsetShadowToken,
} from "../effect-kinds";
import { fallbackName } from "../roles";
import type {
  FigmaEffectStyle,
  FigmaHandoff,
  FigmaPaintStyle,
  FigmaPrimitiveVariable,
  FigmaSemanticVariable,
  FigmaTextStyle,
} from "../../../docs/figma-handoff";
import { FIGMA_HANDOFF_VERSION } from "../../../docs/figma-handoff";

const byString = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

export interface FigmaHandoffInput {
  tokens: StyleSnapToken[];
  assignments: ReadonlyMap<string, string>;
  names: ReadonlyMap<string, string>;
}

function nameOf(token: StyleSnapToken, names: ReadonlyMap<string, string>): string {
  return names.get(token.id) ?? token.name ?? fallbackName(token);
}

function isNumericPrimitive(token: StyleSnapToken): boolean {
  return (
    token.type === "spacing" ||
    token.type === "border-radius" ||
    token.type === "border-width"
  );
}

function isVariablePrimitive(token: StyleSnapToken): boolean {
  return token.type === "color" || isNumericPrimitive(token);
}

/** Roles that map to FLOAT/COLOR semantic variables (not text/effect styles alone). */
function isVariableRole(role: string): boolean {
  return (
    role.startsWith("color/") ||
    role.startsWith("space/") ||
    role.startsWith("radius/") ||
    role.startsWith("border-width/")
  );
}

function effectKindForToken(token: StyleSnapToken): FigmaEffectStyle["kind"] {
  if (isBackdropBlurToken(token)) return "backdrop-blur";
  if (isInsetShadowToken(token)) return "inset";
  return "drop";
}

/**
 * Build roles map + figmaHandoff from the session export input.
 * Tokens must already be the reviewed view (merges applied).
 */
export function buildFigmaHandoff(input: FigmaHandoffInput): {
  roles: Record<string, string>;
  figmaHandoff: FigmaHandoff;
} {
  const byId = new Map(input.tokens.map((t) => [t.id, t]));
  const roles: Record<string, string> = {};
  for (const [role, id] of [...input.assignments.entries()].sort(
    (a, b) => byString(a[0], b[0]),
  )) {
    roles[role] = id;
  }

  const primitives: FigmaPrimitiveVariable[] = [];
  const seenPrimitiveNames = new Set<string>();

  for (const token of [...input.tokens].sort((a, b) => byString(a.id, b.id))) {
    if (!isVariablePrimitive(token)) continue;
    const name = nameOf(token, input.names);
    if (seenPrimitiveNames.has(name)) continue;
    seenPrimitiveNames.add(name);
    if (token.type === "color") {
      primitives.push({
        name,
        type: "COLOR",
        value: token.value,
        opacity: token.opacity,
        tokenId: token.id,
      });
    } else if (isNumericPrimitive(token)) {
      primitives.push({
        name,
        type: "FLOAT",
        value: token.value as number,
        tokenId: token.id,
      });
    }
  }

  const semantic: FigmaSemanticVariable[] = [];
  const paint: FigmaPaintStyle[] = [];
  const text: FigmaTextStyle[] = [];
  const effect: FigmaEffectStyle[] = [];
  const seenPaint = new Set<string>();
  const seenText = new Set<string>();
  const seenEffect = new Set<string>();
  const tokensWithRole = new Set<string>();

  for (const [role, tokenId] of Object.entries(roles).sort((a, b) => byString(a[0], b[0]))) {
    const token = byId.get(tokenId);
    if (!token) continue;
    tokensWithRole.add(tokenId);
    const primitiveName = nameOf(token, input.names);

    if (isVariableRole(role) && isVariablePrimitive(token)) {
      const type = token.type === "color" ? "COLOR" : "FLOAT";
      semantic.push({
        name: role,
        type,
        aliasOf: primitiveName,
        role,
        tokenId,
      });
      if (token.type === "color" && !seenPaint.has(role)) {
        paint.push({
          name: role,
          kind: "solid",
          bindVariableName: role,
          hex: token.value,
          opacity: token.opacity,
          tokenId,
          role,
        });
        seenPaint.add(role);
      }
    }

    if (role.startsWith("type/") && token.type === "typography" && !seenText.has(role)) {
      text.push({
        name: role,
        value: token.value,
        tokenId,
        role,
      });
      seenText.add(role);
    }

    if (
      (role.startsWith("shadow/") || role.startsWith("blur/") || role.startsWith("effect/")) &&
      token.type === "shadow" &&
      !seenEffect.has(role)
    ) {
      const kind = effectKindForToken(token);
      effect.push({
        name: role,
        kind,
        layers: kind === "backdrop-blur" ? [] : token.value,
        blurPx: kind === "backdrop-blur" ? backdropBlurPx(token) : undefined,
        tokenId,
        role,
      });
      seenEffect.add(role);
    }
  }

  // Gradients → paint styles (no COLOR variable).
  for (const token of input.tokens) {
    if (token.type !== "gradient") continue;
    const name = nameOf(token, input.names);
    if (seenPaint.has(name)) continue;
    paint.push({
      name,
      kind: "gradient",
      value: token.value,
      tokenId: token.id,
    });
    seenPaint.add(name);
  }

  // Unassigned typography primitives → text styles under primitive name.
  for (const token of input.tokens) {
    if (token.type !== "typography") continue;
    if (tokensWithRole.has(token.id)) continue;
    const name = nameOf(token, input.names);
    if (seenText.has(name)) continue;
    text.push({ name, value: token.value, tokenId: token.id });
    seenText.add(name);
  }

  // Named unassigned shadows → effect styles under primitive name.
  for (const token of input.tokens) {
    if (token.type !== "shadow") continue;
    if (tokensWithRole.has(token.id)) continue;
    const name = nameOf(token, input.names);
    if (seenEffect.has(name)) continue;
    const kind = effectKindForToken(token);
    effect.push({
      name,
      kind,
      layers: kind === "backdrop-blur" ? [] : token.value,
      blurPx: kind === "backdrop-blur" ? backdropBlurPx(token) : undefined,
      tokenId: token.id,
    });
    seenEffect.add(name);
  }

  primitives.sort((a, b) => byString(a.name, b.name));
  semantic.sort((a, b) => byString(a.name, b.name));
  paint.sort((a, b) => byString(a.name, b.name));
  text.sort((a, b) => byString(a.name, b.name));
  effect.sort((a, b) => byString(a.name, b.name));

  return {
    roles,
    figmaHandoff: {
      version: FIGMA_HANDOFF_VERSION,
      collections: { primitives, semantic },
      styles: { paint, text, effect },
    },
  };
}
