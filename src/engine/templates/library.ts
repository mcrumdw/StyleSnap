// FR-19b — the starter library. Eight hand-written note sets, each a
// complete descriptive layer (all five fields, real design.md prose —
// motion carries durations/easing, layout carries container/grid/breakpoints,
// so no "never capturable" gap survives a fill). Trait weights connect each
// template to the adjective vocabulary; scoring is a pure sum.

import type { SystemNotes } from "../export/notes";
import type { Adjective } from "./adjectives";

export interface NoteTemplate {
  id: string;
  /** Shown in the UI and in the export provenance suffix. */
  displayName: string;
  /** 0–1 weight per adjective — how strongly this template embodies it. */
  traits: Partial<Record<Adjective, number>>;
  /** Complete content for every note field. */
  notes: Required<SystemNotes>;
}

export const TEMPLATE_LIBRARY: NoteTemplate[] = [
  {
    id: "calm-precise",
    displayName: "Calm & precise SaaS",
    traits: { calm: 1, trustworthy: 0.9, minimal: 0.6, serious: 0.6, smooth: 0.4, elegant: 0.3, technical: 0.3 },
    notes: {
      mood: "Calm, trustworthy, and precise. Generous whitespace, one saturated brand color used with restraint, soft layered elevation. Nothing shouts; hierarchy comes from space and weight, not decoration.",
      componentPrinciples:
        "Surfaces are quiet cards on a near-white page; elevation is communicated by the two smallest shadow steps, never by borders alone. The brand color is reserved for primary actions and focus — at most one strong accent per view.",
      motion:
        "Fast and unobtrusive: 150ms ease-out for hovers and state changes, 250ms ease-in-out for panels and dialogs. Elements fade and translate 4–8px, never bounce. Respect prefers-reduced-motion by dropping transforms.",
      voice:
        "Plain, direct, quietly helpful. Short sentences, sentence case everywhere, no exclamation marks. Errors say what happened and the next step; empty states point at the primary action.",
      layout:
        "Max content width 1200px on a 12-column grid with 24px gutters; page padding 24px. Breakpoints: 640 / 1024 / 1280px, desktop-first. Related controls group within 8px; sections separate by 48px.",
    },
  },
  {
    id: "neobrutalist",
    displayName: "Neobrutalist confidence",
    traits: { bold: 1, confident: 1, edgy: 0.8, energetic: 0.5, playful: 0.4 },
    notes: {
      mood: "Loud, tactile, and sure of itself. Hard offset shadows, thick dark borders, flat saturated fills — the interface looks pressable, like printed cardboard. Zero gradients, zero blur.",
      componentPrinciples:
        "Every interactive element carries a 2px solid border and a hard shadow that collapses on press (translate 2px/2px). Cards never float — they sit. Color fills are flat; state is shown by physically moving the element, not by tinting it.",
      motion:
        "Instant and mechanical: 100–150ms linear or ease-out, movement in straight lines. The signature interaction is the press (element translates into its shadow). No fades longer than 150ms, no springs.",
      voice:
        "Punchy and a little cheeky. Celebrate progress in one short line. Buttons are verbs. Never hedge — say the thing.",
      layout:
        "Max width 1200px, 12 columns, 24px gutters. Dense blocks separated by thick 2px rules rather than whitespace alone. Breakpoints 768 / 1200px; below 768 everything stacks full-width.",
    },
  },
  {
    id: "elegant-editorial",
    displayName: "Elegant editorial",
    traits: { elegant: 1, serious: 0.7, luxurious: 0.6, calm: 0.5, minimal: 0.4 },
    notes: {
      mood: "Refined and editorial, like a well-set magazine. Large serifs or high-contrast headings, restrained color, photography-first surfaces. The system frames content; it never competes with it.",
      componentPrinciples:
        "Type does the heavy lifting: scale and weight create hierarchy before color does. Hairline rules and generous margins structure the page; buttons are understated until hovered. One accent color, used like a highlighter — sparingly.",
      motion:
        "Measured: 200–300ms ease-in-out, opacity-led transitions with at most 8px of drift. Images cross-fade; nothing slides in from off-screen. Motion should feel like turning a page, not launching an app.",
      voice:
        "Composed and literate. Full sentences, considered word choice, no slang or emoji. Microcopy reads like a caption, not a notification.",
      layout:
        "Reading measure first: text columns cap at 680px inside a 1140px frame; 12 columns, 20px gutters. Breakpoints 600 / 900 / 1140px. Vertical rhythm on an 8px baseline, section breaks at 64–96px.",
    },
  },
  {
    id: "playful-energy",
    displayName: "Playful energy",
    traits: { playful: 1, energetic: 1, friendly: 0.7, bold: 0.4, warm: 0.4 },
    notes: {
      mood: "Bright, bouncy, and grinning. Saturated hues, chunky rounded shapes, stickers-and-confetti energy — the product feels like a game you're allowed to win.",
      componentPrinciples:
        "Big radii (pill buttons, squircle cards), thick friendly strokes, playful color pairs on every state. Feedback is celebratory: success gets color AND motion. Nothing is gray unless it's disabled.",
      motion:
        "Springy: 200–350ms with overshoot (spring or cubic-bezier(0.34, 1.56, 0.64, 1)). Buttons squash slightly on press; new items pop in at 0.9→1 scale. Keep individual animations under 400ms so the bounce never blocks.",
      voice:
        "Warm, funny, and encouraging — first person plural ('Nice, we saved that!'). Puns allowed, sarcasm not. Every error offers a friendly way out.",
      layout:
        "Max width 1080px, 12 columns, 24px gutters, card-first composition. Breakpoints 640 / 960px. Components breathe: 16px minimum internal padding, 32px between cards.",
    },
  },
  {
    id: "minimal-technical",
    displayName: "Minimal technical",
    traits: { technical: 1, minimal: 1, serious: 0.6, calm: 0.4, edgy: 0.3 },
    notes: {
      mood: "Engineering-grade minimalism: monospaced accents, precise alignment, near-monochrome palette with one functional accent. The UI looks like it was measured, because it was.",
      componentPrinciples:
        "Function first — every element earns its pixels. Data is set in mono; controls are compact and keyboard-first. Color signals state exclusively (accent = interactive, semantic hues = feedback); decoration is absent by policy.",
      motion:
        "Minimal and instant: 100ms ease-out or nothing. State changes may simply swap. Progress and loading are the only sanctioned animations. Always honor prefers-reduced-motion.",
      voice:
        "Terse and exact. Labels over sentences, numbers over adjectives, no marketing tone in the product. Error messages include the actual value that failed.",
      layout:
        "Fluid to 1440px with a 8px hard grid; panels split resizable at 240/320px rails. Breakpoints 800 / 1200px. Density is a feature — 4px control gaps inside groups, 24px between groups.",
    },
  },
  {
    id: "warm-friendly",
    displayName: "Warm & friendly",
    traits: { warm: 1, friendly: 1, trustworthy: 0.6, calm: 0.5, playful: 0.3 },
    notes: {
      mood: "Cozy and human. Warm neutrals, soft rounded corners, gentle shadows — the interface feels like being helped by a patient person, not processed by a machine.",
      componentPrinciples:
        "Soft containment: cards with 12–16px radii and warm off-white fills; buttons look cushioned. Illustrations and avatars over abstract icons where possible. States tint warm (never harsh red walls — errors are firm but kind).",
      motion:
        "Gentle: 200–250ms ease-in-out, soft fades with 4px drift. Feedback pulses subtly rather than flashing. Nothing moves fast enough to startle.",
      voice:
        "Conversational and reassuring — contractions, second person, plain words. Celebrate small wins, soften errors ('That didn't work — let's try again'). Read every string aloud; if it sounds cold, rewrite it.",
      layout:
        "Max width 1140px, 12 columns, 24px gutters, roomy 32px card padding. Breakpoints 640 / 1024px. White space is part of the warmth: sections separated by 56px minimum.",
    },
  },
  {
    id: "luxury-dark",
    displayName: "Luxury calm",
    traits: { luxurious: 1, elegant: 0.8, calm: 0.5, serious: 0.5, confident: 0.4 },
    notes: {
      mood: "Dark, rich, and unhurried. Deep near-black surfaces, gold-or-jewel accent used like jewelry, high-contrast type with generous tracking. Everything feels expensive because nothing is crowded.",
      componentPrinciples:
        "Dark surfaces first: elevation is rendered by lightening the surface a step, not by shadows. The accent appears only on the most valuable action per view. Fine 1px strokes at 20–30% white separate regions.",
      motion:
        "Slow and deliberate: 300ms ease-in-out, long fades, no bounce ever. Reveal content like drawing a curtain — opacity plus a 12px rise. Hover states glow subtly rather than jump.",
      voice:
        "Understated and assured. Few words, no urgency, never an exclamation mark. The product doesn't ask twice.",
      layout:
        "Centered 1200px frame, 12 columns, 32px gutters, dramatic 96px section spacing. Breakpoints 768 / 1200px. Content blocks stay narrow (max 560px text measure) to keep the gallery feel.",
    },
  },
  {
    id: "smooth-fluid",
    displayName: "Smooth motion-first",
    traits: { smooth: 1, energetic: 0.6, elegant: 0.5, playful: 0.4, confident: 0.4 },
    notes: {
      mood: "Fluid and continuous — the interface behaves like liquid glass. Soft gradients, large blurs, elements that morph rather than swap. Modern product-launch energy.",
      componentPrinciples:
        "Continuity over containment: panels share edges and morph between states; gradients (brand hue → deeper shade) mark primary surfaces. Corners are large (16–24px) and consistent so shapes can transition into each other.",
      motion:
        "Motion is the brand: 250–400ms spring-based transitions, shared-element morphs between views, parallax under 8px. Every state change animates — but each property animates once, and reduced-motion collapses everything to fades.",
      voice:
        "Light and modern. Short lines, present tense, momentum words ('Done. Next up…'). Copy keeps pace with the motion — never a paragraph where a phrase works.",
      layout:
        "Fluid full-bleed sections with a 1280px content core, 12 columns, 24px gutters. Breakpoints 640 / 1024 / 1440px. Sticky chrome stays translucent (blur backdrop) so content slides beneath it.",
    },
  },
];

const byId = new Map(TEMPLATE_LIBRARY.map((t) => [t.id, t]));

export function templateById(id: string): NoteTemplate | undefined {
  return byId.get(id);
}
