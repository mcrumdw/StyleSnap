// PRD §7.6 (FR-18) / Appendix B.5 — the completeness checklist as a pure
// function. Evaluated against CONFIRMED roles only (suggestions don't count —
// FR-16): the checklist is precisely "what still needs a human decision".
//
// Three severities:
//   required    — the ✅ rows of Appendix B; all met ⇒ system "complete".
//   recommended — roles the oracle lists as gaps when undecided (links,
//                 pressed state, secondary CTA, mono).
//   info        — captured-but-unassigned foundation values, and the
//                 never-capturable foundations (breakpoints, motion, z-index)
//                 that every export must flag (FR-27).

import type { StyleSnapToken, TokenType } from "../../contract/types";
import type { CaptureFoundations } from "../../contract/types";
import { ELEVATION_ROLE_SET, isDropShadowToken } from "../effect-kinds";
import { COLOR_ROLES, SPACE_SCALE_ROLES, roleDefinition } from "../roles/taxonomy";

export interface ChecklistItem {
  id: string;
  severity: "required" | "recommended" | "info";
  status: "met" | "gap";
  label: string;
  description: string;
  /** When present, "add a token with this type/role" would clear the gap. */
  action?: { tokenType: TokenType; role?: string };
}

export interface Checklist {
  items: ChecklistItem[];
  requiredMet: number;
  requiredTotal: number;
  /** All required items met (B.5) — the Create System gate can relax. */
  complete: boolean;
}

/** Oracle §Gaps: optional roles worth surfacing when undecided. */
const RECOMMENDED_ROLES = [
  "color/text/link",
  "color/action/primary-active",
  "color/action/secondary",
  "type/mono",
] as const;

const FOUNDATION_TYPES: TokenType[] = ["spacing", "border-radius", "border-width", "shadow"];

export function computeChecklist(
  tokens: StyleSnapToken[],
  /** Phase 8 — role → token id (the pool's `assignments`, merge-resolved). */
  assignments: ReadonlyMap<string, string>,
  /** Schema 2.1 — page foundations from browser scan; clears permanent gaps when present. */
  foundations?: CaptureFoundations | null,
): Checklist {
  const assigned = new Set(assignments.keys());
  const assignedTokenIds = new Set(assignments.values());
  const items: ChecklistItem[] = [];

  const roleItem = (role: string, severity: "required" | "recommended"): ChecklistItem => {
    const def = roleDefinition(role)!;
    return {
      id: role,
      severity,
      status: assigned.has(role) ? "met" : "gap",
      label: role,
      description: assigned.has(role)
        ? def.meaning
        : `Missing — ${def.meaning.toLowerCase()}. Assign a token.`,
      action: { tokenType: def.tokenType, role },
    };
  };

  // B.1 — the 12 required color roles.
  for (const def of COLOR_ROLES.filter((r) => r.required)) {
    items.push(roleItem(def.role, "required"));
  }

  // B.2 — type/body + at least one of display/heading.
  items.push(roleItem("type/body", "required"));
  const hasHeadline = assigned.has("type/display") || assigned.has("type/heading");
  items.push({
    id: "type/display-or-heading",
    severity: "required",
    status: hasHeadline ? "met" : "gap",
    label: "type/display or type/heading",
    description: hasHeadline
      ? "Headline style assigned"
      : "Missing a headline. Assign type/display or type/heading.",
    action: { tokenType: "typography", role: "type/heading" },
  });

  // B.3 — foundation scale minima (spacing scale steps only — not semantic roles).
  const slotCount = (prefix: string) =>
    new Set([...assigned].filter((r) => r.startsWith(prefix))).size;

  const spaceSteps = [...assigned].filter((r) => SPACE_SCALE_ROLES.has(r)).length;
  items.push({
    id: "space-scale",
    severity: "required",
    status: spaceSteps >= 4 ? "met" : "gap",
    label: "space/* scale (≥ 4 steps)",
    description:
      spaceSteps >= 4
        ? `${spaceSteps} spacing scale steps assigned`
        : `Only ${spaceSteps} spacing scale step${spaceSteps === 1 ? "" : "s"}. Need at least 4.`,
    action: { tokenType: "spacing", role: "space/md" },
  });
  items.push(roleItem("space/page", "required"));
  items.push({
    id: "radius-scale",
    severity: "required",
    status: slotCount("radius/") >= 1 ? "met" : "gap",
    label: "radius/* (≥ 1)",
    description:
      slotCount("radius/") >= 1
        ? "Radius assigned"
        : "Missing a radius. Assign radius/sm.",
    action: { tokenType: "border-radius", role: "radius/sm" },
  });
  const elevationCount = [...assigned].filter((r) => ELEVATION_ROLE_SET.has(r)).length;
  // §2.63 — require elevation only when the snap had drop shadows; otherwise
  // recommend (borders/outlines often carry elevation instead).
  const snapHadDropShadow = tokens.some((t) => isDropShadowToken(t));
  items.push({
    id: "shadow-scale",
    severity: snapHadDropShadow ? "required" : "recommended",
    status: elevationCount >= 1 ? "met" : "gap",
    label: "shadow/sm|md|lg (≥ 1)",
    description:
      elevationCount >= 1
        ? "Elevation shadow assigned"
        : snapHadDropShadow
          ? "Missing a drop shadow. Assign shadow/sm."
          : "No drop shadows in snap — leave empty if elevation uses borders/outlines, or add shadow/sm.",
    action: { tokenType: "shadow", role: "shadow/sm" },
  });
  items.push({
    id: "border-width/default",
    severity: "required",
    status: assigned.has("border-width/default") ? "met" : "gap",
    label: "border-width/default",
    description: assigned.has("border-width/default")
      ? "Default border width assigned"
      : "Missing default border width. Assign one.",
    action: { tokenType: "border-width", role: "border-width/default" },
  });

  // Recommended roles (oracle §Gaps).
  for (const role of RECOMMENDED_ROLES) {
    items.push(roleItem(role, "recommended"));
  }

  // Captured foundation values no slot points at (oracle: the 12px).
  const slotValue = (rolePrefix: string): number[] =>
    [...assignments.entries()]
      .filter(([role]) =>
        rolePrefix === "space/"
          ? SPACE_SCALE_ROLES.has(role)
          : role.startsWith(rolePrefix),
      )
      .map(([, id]) => tokens.find((t) => t.id === id)?.value)
      .filter((v): v is number => typeof v === "number");

  const snap4 = (v: number) => Math.max(4, Math.round(v / 4) * 4);
  const nearSlot = (token: StyleSnapToken): boolean => {
    if (token.type === "spacing") {
      const snapped = snap4(token.value);
      return slotValue("space/").some(
        (v) => Math.abs(v - snapped) <= 4 || Math.abs(v - token.value) <= 4,
      );
    }
    if (token.type === "border-radius") {
      return slotValue("radius/").some((v) => Math.abs(v - token.value) <= 2);
    }
    return false;
  };

  for (const token of tokens) {
    if (!FOUNDATION_TYPES.includes(token.type)) continue;
    if (assignedTokenIds.has(token.id)) continue;
    if (nearSlot(token)) continue;
    const valueLabel =
      token.type === "shadow" ? "shadow" : `${token.value as number}px ${token.type}`;
    items.push({
      id: `unassigned-${token.id}`,
      severity: "info",
      status: "gap",
      label: `${valueLabel} unassigned`,
      description: `Seen ${token.occurrences}× — assign to a slot, or leave out.`,
    });
  }

  // Page foundations — permanent gap only for what's still missing (FR-27).
  const missingFoundation: string[] = [];
  if (!foundations?.breakpointsPx?.length) missingFoundation.push("breakpoints");
  if (!foundations?.zIndex?.length) missingFoundation.push("z-index");
  // Motion can live in System notes or foundations.motion — still flag if neither path filled later.
  if (!foundations?.motion?.length) missingFoundation.push("motion/easing");
  if (missingFoundation.length > 0) {
    items.push({
      id: "manual-foundations",
      severity: "info",
      status: "gap",
      label: missingFoundation.join(" · "),
      description:
        foundations && Object.keys(foundations).length > 0
          ? `Still undefined: ${missingFoundation.join(", ")}. Add by hand or re-scan the page.`
          : "Not capturable from this session — add these by hand, or Scan page in the extension.",
    });
  } else {
    items.push({
      id: "manual-foundations",
      severity: "info",
      status: "met",
      label: "Breakpoints · motion/easing · z-index",
      description: "Captured via page foundations scan.",
    });
  }

  const required = items.filter((i) => i.severity === "required");
  const requiredMet = required.filter((i) => i.status === "met").length;
  return {
    items,
    requiredMet,
    requiredTotal: required.length,
    complete: requiredMet === required.length,
  };
}
