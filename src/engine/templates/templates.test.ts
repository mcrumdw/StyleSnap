// FR-19b acceptance — sixty snippets, deterministic per-field scoring with
// family boost, "Pick for me" derives stable adjectives from the fixtures,
// and a fill never touches user text.

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../../contract/schema";
import type { StyleSnapToken } from "../../contract/types";
import { detectAnchors } from "../derive-system/anchors";
import { NOTE_FIELDS } from "../export";
import {
  ADJECTIVES,
  FAMILY_BOOST,
  MAX_ADJECTIVES,
  SNIPPET_LIBRARY,
  assembleDescription,
  autoAdjectives,
  bestSnippetForField,
  fillNotes,
  refreshNotesFromAssembly,
  scoreSnippetsForField,
} from "./index";

function fixtureTokens(name: string): StyleSnapToken[] {
  const result = parseStyleSnapExport(
    readFileSync(new URL(`../../../docs/fixtures/${name}`, import.meta.url), "utf-8"),
  );
  if (!result.ok) throw new Error(`fixture ${name} should parse`);
  return result.data.tokens;
}

describe("snippet library", () => {
  it("has twelve snippets per field (60 total)", () => {
    expect(SNIPPET_LIBRARY).toHaveLength(60);
    for (const field of NOTE_FIELDS) {
      expect(SNIPPET_LIBRARY.filter((s) => s.field === field.key)).toHaveLength(12);
    }
  });

  it("every snippet has real prose with motion ms and layout breakpoints", () => {
    for (const snippet of SNIPPET_LIBRARY) {
      expect(snippet.text.length, snippet.id).toBeGreaterThan(40);
      if (snippet.field === "motion") expect(snippet.text).toMatch(/\d+ms/);
      if (snippet.field === "layout") expect(snippet.text).toMatch(/[Bb]reakpoint/);
    }
  });

  it("every adjective is represented in at least two snippets", () => {
    for (const adjective of ADJECTIVES) {
      const carriers = SNIPPET_LIBRARY.filter((s) => (s.traits[adjective] ?? 0) > 0);
      expect(carriers.length, adjective).toBeGreaterThanOrEqual(2);
    }
  });
});

describe("per-field scoring", () => {
  it("is deterministic with a stable tie-break", () => {
    expect(bestSnippetForField("mood", ["energetic", "smooth"]).id).toBe("mood/fluid-motion");
    expect(assembleDescription(["calm", "minimal", "technical"]).moodFamily).toBe("technical");
    expect(assembleDescription([]).moodFamily).toBe("calm-saas");
    expect(scoreSnippetsForField("mood", ["bold"])).toEqual(
      scoreSnippetsForField("mood", ["bold", "bold"]),
    );
  });

  it("applies family boost after mood is chosen", () => {
    const mood = bestSnippetForField("mood", ["calm"], null);
    const motionScores = scoreSnippetsForField("motion", ["calm"], mood.family);
    const noBoostScores = scoreSnippetsForField("motion", ["calm"], null);
    const boostedWinner = motionScores[0];
    const sameSnippetNoBoost = noBoostScores.find((s) => s.snippet.id === boostedWinner.snippet.id)!;
    expect(boostedWinner.score).toBe(sameSnippetNoBoost.score + FAMILY_BOOST);
  });
});

describe("assembleDescription", () => {
  it("fills all five fields from snippets", () => {
    const assembled = assembleDescription(["luxurious", "elegant"]);
    for (const field of NOTE_FIELDS) {
      expect(assembled.notes[field.key].length).toBeGreaterThan(40);
      expect(assembled.sources[field.key]).toMatch(new RegExp(`^${field.key}/`));
    }
    expect(assembled.moodFamily).toBe("luxury");
  });
});

describe("autoAdjectives (Pick for me — no AI)", () => {
  it("derives stable picks from the fixtures", () => {
    const forFixture = (name: string) => {
      const tokens = fixtureTokens(name);
      return autoAdjectives(tokens, detectAnchors(tokens));
    };
    expect(forFixture("capture-thin.json")).toEqual([
      "energetic",
      "bold",
      "minimal",
      "technical",
      "trustworthy",
    ]);
    expect(forFixture("capture-test-drive.json")).toEqual([
      "technical",
      "friendly",
      "smooth",
      "confident",
      "elegant",
    ]);
    expect(forFixture("capture-browser-messy.json")).toEqual([
      "energetic",
      "bold",
      "technical",
      "elegant",
      "smooth",
    ]);
    expect(MAX_ADJECTIVES).toBe(5);
  });

  it("falls back deterministically with no tokens at all", () => {
    const picks = autoAdjectives([], {});
    expect(picks).toEqual(["minimal", "trustworthy", "calm", "serious", "refined"]);
  });
});

describe("fillNotes", () => {
  const assembled = assembleDescription(["calm"]);

  it("fills only empty fields and records sources", () => {
    const { notes, sources } = fillNotes({ mood: "My own words." }, assembled);
    expect(notes.mood).toBe("My own words.");
    expect(sources.mood).toBe("user");
    for (const field of NOTE_FIELDS) {
      if (field.key === "mood") continue;
      expect(notes[field.key]).toBe(assembled.notes[field.key]);
      expect(sources[field.key]).toBe(assembled.sources[field.key]);
    }
  });

  it("a second fill from another assembly never overwrites the first", () => {
    const first = fillNotes({}, assembled);
    const other = assembleDescription(["bold"]);
    const second = fillNotes(first.notes, other, first.sources);
    for (const field of NOTE_FIELDS) {
      expect(second.notes[field.key]).toBe(assembled.notes[field.key]);
      expect(second.sources[field.key]).toBe(assembled.sources[field.key]);
    }
  });
});

describe("refreshNotesFromAssembly", () => {
  it("updates snippet fields but never user-claimed text", () => {
    const calm = assembleDescription(["calm"]);
    const bold = assembleDescription(["bold"]);
    const seeded = fillNotes({ mood: "Hand-written." }, calm);
    const refreshed = refreshNotesFromAssembly(seeded.notes, bold, seeded.sources);
    expect(refreshed.notes.mood).toBe("Hand-written.");
    expect(refreshed.sources.mood).toBe("user");
    expect(refreshed.notes.motion).toBe(bold.notes.motion);
    expect(refreshed.sources.motion).toBe(bold.sources.motion);
  });
});
