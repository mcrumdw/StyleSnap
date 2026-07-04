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
import { COLOR_ROLES, roleDefinition } from "../roles/taxonomy";

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
  confirmedRoles: ReadonlyMap<string, string>,
): Checklist {
  const assigned = new Set(confirmedRoles.values());
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
        : `No ${role} yet — ${def.meaning.toLowerCase()}. Add a token or assign the role to an existing one.`,
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
      : "No headline style yet — assign type/display or type/heading to a captured heading.",
    action: { tokenType: "typography", role: "type/heading" },
  });

  // B.3 — foundation scale minima.
  const slotCount = (prefix: string) =>
    new Set([...assigned].filter((r) => r.startsWith(prefix))).size;

  const spaceSteps = slotCount("space/");
  items.push({
    id: "space-scale",
    severity: "required",
    status: spaceSteps >= 4 ? "met" : "gap",
    label: "space/* scale (≥ 4 steps)",
    description:
      spaceSteps >= 4
        ? `${spaceSteps} spacing steps assigned`
        : `Only ${spaceSteps} spacing step${spaceSteps === 1 ? "" : "s"} assigned — assign at least 4 (space/xs … space/2xl).`,
    action: { tokenType: "spacing" },
  });
  items.push({
    id: "radius-scale",
    severity: "required",
    status: slotCount("radius/") >= 1 ? "met" : "gap",
    label: "radius/* (≥ 1)",
    description:
      slotCount("radius/") >= 1
        ? "Radius assigned"
        : "No radius slot assigned yet — assign radius/sm to a captured value.",
    action: { tokenType: "border-radius", role: "radius/sm" },
  });
  items.push({
    id: "shadow-scale",
    severity: "required",
    status: slotCount("shadow/") >= 1 ? "met" : "gap",
    label: "shadow/* (≥ 1)",
    description:
      slotCount("shadow/") >= 1
        ? "Shadow assigned"
        : "No shadow slot assigned yet — assign shadow/sm to a captured value.",
    action: { tokenType: "shadow", role: "shadow/sm" },
  });
  items.push({
    id: "border-width/default",
    severity: "required",
    status: assigned.has("border-width/default") ? "met" : "gap",
    label: "border-width/default",
    description: assigned.has("border-width/default")
      ? "Default border width assigned"
      : "No border-width/default yet — assign it to a captured width.",
    action: { tokenType: "border-width", role: "border-width/default" },
  });

  // Recommended roles (oracle §Gaps).
  for (const role of RECOMMENDED_ROLES) {
    items.push(roleItem(role, "recommended"));
  }

  // Captured foundation values without a confirmed slot (oracle: the 12px).
  for (const token of tokens) {
    if (!FOUNDATION_TYPES.includes(token.type)) continue;
    if (confirmedRoles.has(token.id)) continue;
    const valueLabel =
      token.type === "shadow" ? "shadow" : `${token.value as number}px ${token.type}`;
    items.push({
      id: `unassigned-${token.id}`,
      severity: "info",
      status: "gap",
      label: `${valueLabel} unassigned`,
      description: `Captured ${token.occurrences}× but not assigned to a scale slot — assign one or leave it out of the system.`,
    });
  }

  // Never capturable — always flagged, resolved manually (FR-27 in exports).
  items.push({
    id: "manual-foundations",
    severity: "info",
    status: "gap",
    label: "Breakpoints · motion/easing · z-index",
    description: "Never capturable — define these manually; they're flagged in every export.",
  });

  const required = items.filter((i) => i.severity === "required");
  const requiredMet = required.filter((i) => i.status === "met").length;
  return {
    items,
    requiredMet,
    requiredTotal: required.length,
    complete: requiredMet === required.length,
  };
}
