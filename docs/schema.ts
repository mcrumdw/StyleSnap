// StyleSnap — Runtime validation schema (zod)
// The runtime twin of docs/types.ts · schema version 2.0
//
// WHY THIS FILE EXISTS
// TypeScript types are erased at compile time — types.ts cannot check JSON a
// user pastes at runtime. This zod schema implements PRD FR-2: validate pasted
// / uploaded JSON and produce a friendly, specific error instead of crashing.
//
// WHAT IT VALIDATES — the ENVELOPE only.
// A raw, messy, unconsolidated capture (30 near-duplicate blues, everything
// unnamed, no roles) is VALID by design — see DECISIONS.md §2.2. This schema
// rejects only genuine malformation: wrong field types, missing fields,
// malformed hex, out-of-range opacity, unknown token types.
//
// KEEPING IN SYNC WITH types.ts
// docs/types.ts stays the canonical human-readable contract shared by all
// three codebases. The compile-time assertions at the bottom of this file
// make `tsc` fail if this schema and types.ts ever drift structurally.
// Constraints the type system cannot express (6-digit hex, 0–1 ranges,
// "2+ gradient stops") live only here — that is the value this file adds.
//
// Written for zod v3. (zod v4: replace z.string().datetime(...) with
// z.iso.datetime(...).)

import { z } from "zod";
import type { StyleSnapExport, StyleSnapToken } from "./types";

// ─────────────────────────────────────────
// Primitive values
// ─────────────────────────────────────────

/** 6-digit hex, alpha NEVER baked in — it lives in `opacity` (types.ts rule). */
export const colorValueSchema = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "expected a 6-digit hex color like #FF46AF (no alpha in the hex)");

const opacity01 = z.number().min(0).max(1);

export const gradientStopSchema = z.object({
  color: colorValueSchema,
  opacity: opacity01,
  position: z.number().min(0).max(1),
});

export const gradientValueSchema = z.object({
  kind: z.enum(["linear", "radial", "conic"]),
  // Contract: "degrees — linear only". Kept lenient (not rejected on
  // radial/conic) so a harmless extra field never fails a whole import.
  angle: z.number().finite().optional(),
  stops: z.array(gradientStopSchema).min(2, "a gradient needs at least 2 stops"),
});

export const typographyValueSchema = z.object({
  fontFamily: z.string().min(1),
  fontStack: z.array(z.string()).optional(),
  fontSize: z.number().positive(),
  fontWeight: z.number().min(100).max(900), // producers normalize "bold"→700, "normal"→400
  fontStyle: z.enum(["normal", "italic"]).optional(),
  lineHeight: z.number().positive(), // unitless ratio
  letterSpacing: z.number().finite().optional(), // px — may legitimately be negative
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
});

export const shadowLayerSchema = z.object({
  inset: z.boolean(),
  offsetX: z.number().finite(),
  offsetY: z.number().finite(),
  blur: z.number().min(0), // CSS blur cannot be negative
  spread: z.number().finite(),
  color: colorValueSchema,
  opacity: opacity01,
});

export const shadowValueSchema = z.array(shadowLayerSchema).min(1);

// Numeric values: kept lenient (any finite number). Spacing captured from
// margins can be negative in the wild; rejecting it would fail real captures.
const numericValue = z.number().finite();

// ─────────────────────────────────────────
// Capture context
// ─────────────────────────────────────────

export const captureStateSchema = z.enum([
  "default",
  "hover",
  "focus",
  "active",
  "disabled",
  "visited",
]);

export const tokenContextSchema = z.object({
  cssProperty: z.string().optional(),
  element: z.string().optional(),
  ariaRole: z.string().optional(),
  state: captureStateSchema.optional(),
  selector: z.string().optional(),
  authoredName: z.string().optional(),
});

// ─────────────────────────────────────────
// Base token (shared fields)
// ─────────────────────────────────────────

const baseTokenShape = {
  id: z.string().min(1),
  captureId: z.string().min(1),
  source: z.string(),
  name: z.string().nullable(),
  occurrences: z.number().int().min(1), // a captured value appeared at least once
  merged: z.boolean(),
  mergedFrom: z.array(z.string()).optional(),
  context: tokenContextSchema.optional(),
} as const;

// ─────────────────────────────────────────
// Token variants (discriminated union on `type`)
// ─────────────────────────────────────────

export const colorTokenSchema = z.object({
  ...baseTokenShape,
  type: z.literal("color"),
  value: colorValueSchema,
  opacity: opacity01,
});

export const gradientTokenSchema = z.object({
  ...baseTokenShape,
  type: z.literal("gradient"),
  value: gradientValueSchema,
});

export const typographyTokenSchema = z.object({
  ...baseTokenShape,
  type: z.literal("typography"),
  value: typographyValueSchema,
});

export const spacingTokenSchema = z.object({
  ...baseTokenShape,
  type: z.literal("spacing"),
  value: numericValue,
});

export const borderRadiusTokenSchema = z.object({
  ...baseTokenShape,
  type: z.literal("border-radius"),
  value: numericValue,
});

export const borderWidthTokenSchema = z.object({
  ...baseTokenShape,
  type: z.literal("border-width"),
  value: numericValue,
});

export const shadowTokenSchema = z.object({
  ...baseTokenShape,
  type: z.literal("shadow"),
  value: shadowValueSchema,
});

export const styleSnapTokenSchema = z.discriminatedUnion("type", [
  colorTokenSchema,
  gradientTokenSchema,
  typographyTokenSchema,
  spacingTokenSchema,
  borderRadiusTokenSchema,
  borderWidthTokenSchema,
  shadowTokenSchema,
]);

// ─────────────────────────────────────────
// Root export
// ─────────────────────────────────────────

export const styleSnapMetaSchema = z.object({
  source: z.enum(["figma", "browser-extension"]),
  exportedAt: z.string().datetime({ offset: true }), // ISO 8601
  figmaFile: z.string().optional(), // contract: present when source is "figma" (not enforced — lenient envelope)
  pageUrl: z.string().optional(), //  contract: present when source is "browser-extension" (idem)
  version: z.string(), // any string accepted here; the app warns on mismatch (FR-4), it doesn't reject
});

export const styleSnapExportSchema = z.object({
  meta: styleSnapMetaSchema,
  tokens: z.array(styleSnapTokenSchema), // an empty capture is structurally valid
});

// ─────────────────────────────────────────
// FR-2 / FR-4 helper — paste-zone entry point
// ─────────────────────────────────────────

export const SCHEMA_VERSION = "2.0";

export type ParseResult =
  | { ok: true; data: StyleSnapExport; versionWarning?: string }
  | { ok: false; error: string; details: string[] };

/** Friendly copy from DESIGN.md §9. */
const FRIENDLY_ERROR =
  "That doesn't look like a StyleSnap capture. Mind checking the file?";

/**
 * Contract rule (types.ts): token ids are globally unique. Duplicate ids
 * silently clobber earlier tokens when the webtool builds Map(id → token) —
 * colors vanish. Reject at parse time with a specific FR-2 detail.
 */
function duplicateIdDetails(tokens: ReadonlyArray<{ id: string }>): string[] {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token.id, (counts.get(token.id) ?? 0) + 1);
  }
  const dups = [...counts.entries()]
    .filter(([, n]) => n > 1)
    .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  if (dups.length === 0) return [];
  const [id, n] = dups[0];
  const more = dups.length > 1 ? ` (+${dups.length - 1} more colliding id${dups.length === 2 ? "" : "s"})` : "";
  return [
    `token ids must be unique — ${id} appears ${n}×${more}; update the extension or Figma plugin that produced this capture`,
  ];
}

/**
 * Single entry point for the paste zone / file upload.
 * Never throws; returns either the typed export (with an optional FR-4
 * version warning) or a friendly error plus the first few specific issues.
 */
export function parseStyleSnapExport(text: string): ParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { ok: false, error: FRIENDLY_ERROR, details: ["The text isn't valid JSON."] };
  }

  const result = styleSnapExportSchema.safeParse(json);
  if (!result.success) {
    return {
      ok: false,
      error: FRIENDLY_ERROR,
      details: result.error.issues
        .slice(0, 5)
        .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`),
    };
  }

  const dupDetails = duplicateIdDetails(result.data.tokens);
  if (dupDetails.length > 0) {
    return { ok: false, error: FRIENDLY_ERROR, details: dupDetails };
  }

  const versionWarning =
    result.data.meta.version !== SCHEMA_VERSION
      ? `This capture is schema v${result.data.meta.version}; the app expects v${SCHEMA_VERSION}. Import will proceed, but some fields may be missing or ignored.`
      : undefined;

  return { ok: true, data: result.data, versionWarning };
}

// ─────────────────────────────────────────
// Compile-time sync assertions
// ─────────────────────────────────────────
// If docs/types.ts and this schema ever drift structurally, `tsc` fails on
// one of these two lines. Direction A: everything the schema accepts is a
// valid StyleSnapExport. Direction B: everything types.ts allows is accepted
// by the schema (structurally — value constraints like hex format only exist
// here, which is intentional).

type Extends<A extends B, B> = A;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type _schemaOutputIsValidContract = Extends<z.infer<typeof styleSnapExportSchema>, StyleSnapExport>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type _contractIsAcceptedBySchema = Extends<StyleSnapExport, z.infer<typeof styleSnapExportSchema>>;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export type _tokenUnionMatches = Extends<z.infer<typeof styleSnapTokenSchema>, StyleSnapToken>;
