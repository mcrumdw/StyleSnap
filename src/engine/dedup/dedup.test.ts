import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseStyleSnapExport } from "../../contract/schema";
import type { SpacingToken, StyleSnapToken } from "../../contract/types";
import { applyMerges, detectClusters, flagLevels, type DedupCluster } from "./index";

const fixture = (name: string) =>
  readFileSync(new URL(`../../../docs/fixtures/${name}`, import.meta.url), "utf-8");

function fixtureTokens(): StyleSnapToken[] {
  const tokens: StyleSnapToken[] = [];
  for (const name of ["capture-browser-messy.json", "capture-figma-clean.json"]) {
    const result = parseStyleSnapExport(fixture(name));
    if (!result.ok) throw new Error(`fixture ${name} should parse`);
    tokens.push(...result.data.tokens);
  }
  return tokens;
}

const tokens = fixtureTokens();
const clusters = detectClusters(tokens);

const clusterOf = (id: string): DedupCluster | undefined =>
  clusters.find((c) => c.canonical.id === id || c.members.some((m) => m.token.id === id));

const memberIds = (c: DedupCluster) => [c.canonical.id, ...c.members.map((m) => m.token.id)];

describe("color clustering (A.2)", () => {
  it("puts the 4-way blues + the Figma blue in ONE cluster, canonical #2E6BFF", () => {
    const blues = clusterOf("ext_001")!;
    expect(blues.canonical.id).toBe("ext_001"); // #2E6BFF ×18 — most used
    expect(memberIds(blues).sort()).toEqual([
      "ext_001", // #2E6BFF
      "ext_002", // #2E6CFF
      "ext_003", // #2F6BFE
      "ext_004", // #3067FF
      "fig_001", // #2E6BFF (exact, from Figma)
    ]);
  });

  it("keeps the hover shade #2456CC OUT of the blues cluster", () => {
    const blues = clusterOf("ext_001")!;
    expect(memberIds(blues)).not.toContain("ext_005");
  });

  it("flags ext_006/ext_007/fig_002 (#101828 ×3) as exact duplicates", () => {
    const ink = clusterOf("ext_006")!;
    expect(ink.canonical.id).toBe("ext_006"); // ×44
    const others = ink.members.filter((m) => ["ext_007", "fig_002"].includes(m.token.id));
    expect(others).toHaveLength(2);
    expect(others.every((m) => m.level === "duplicate" && m.distance === 0)).toBe(true);
  });

  it("never clusters across differing opacity: the 50% scrim stays out", () => {
    const ink = clusterOf("ext_006")!;
    expect(memberIds(ink)).not.toContain("fig_004"); // #101828 @ 0.5
  });
});

describe("numeric clustering (A.3)", () => {
  it("15px joins 16px as similar; the 16s are duplicates; canonical is 16", () => {
    const cluster = clusterOf("ext_022")!; // the 15px capture
    expect((cluster.canonical as SpacingToken).value).toBe(16);
    expect(cluster.canonical.id).toBe("ext_023"); // 16px ×28 beats fig_007 ×18
    const fifteen = cluster.members.find((m) => m.token.id === "ext_022")!;
    expect(fifteen.level).toBe("similar");
    const figmaSixteen = cluster.members.find((m) => m.token.id === "fig_007")!;
    expect(figmaSixteen.level).toBe("duplicate");
  });

  it("4 and 8 never cluster", () => {
    const four = clusterOf("ext_019");
    expect(four === undefined || !memberIds(four).includes("ext_020")).toBe(true);
  });

  it("the two 12px radii are duplicates", () => {
    const radii = clusterOf("fig_008")!;
    expect(radii.canonical.id).toBe("fig_008"); // ×9 beats ×7
    expect(memberIds(radii).sort()).toEqual(["ext_028", "fig_008"]);
    expect(radii.members[0].level).toBe("duplicate");
  });
});

describe("typography clustering (A.4)", () => {
  it("body 16/400/1.5 from both sources = duplicate", () => {
    const body = clusterOf("ext_015")!;
    expect(body.canonical.id).toBe("ext_015"); // ×30
    const figmaBody = body.members.find((m) => m.token.id === "fig_006")!;
    expect(figmaBody.level).toBe("duplicate");
  });

  it("1.5 vs 1.45 lineHeight = similar, never duplicate", () => {
    const body = clusterOf("ext_015")!;
    const variant = body.members.find((m) => m.token.id === "ext_016")!;
    expect(variant.level).toBe("similar");
  });

  it("the tracked-uppercase label NEVER clusters with the caption", () => {
    const caption = clusterOf("ext_017");
    if (caption) expect(memberIds(caption)).not.toContain("ext_018");
    const label = clusterOf("ext_018");
    if (label) expect(memberIds(label)).not.toContain("ext_017");
  });
});

describe("shadow clustering (A.5)", () => {
  it("the identical dropdown/Figma md shadows are duplicates", () => {
    const md = clusterOf("fig_009")!;
    expect(md.canonical.id).toBe("fig_009"); // ×7 beats ×3
    expect(memberIds(md).sort()).toEqual(["ext_031", "fig_009"]);
    expect(md.members[0].level).toBe("duplicate");
  });

  it("the small card shadow stays separate (geometry beyond epsilon)", () => {
    const md = clusterOf("fig_009")!;
    expect(memberIds(md)).not.toContain("ext_030");
  });
});

describe("badge levels (FR-6)", () => {
  it("canonical + exact duplicates flag DUP; similar members flag SIM", () => {
    const flags = flagLevels(clusters);
    expect(flags.get("ext_006")).toBe("dup"); // ink canonical with exact dups
    expect(flags.get("ext_007")).toBe("dup");
    expect(flags.get("ext_022")).toBe("sim"); // the 15px similar member
    expect(flags.get("ext_023")).toBe("dup"); // 16px canonical (fig_007 is exact)
    expect(flags.has("ext_005")).toBe(false); // hover blue — unflagged
  });
});

describe("determinism (A.6)", () => {
  it("same input in any order ⇒ identical cluster output", () => {
    const snapshot = (cs: DedupCluster[]) =>
      cs.map((c) => `${c.id}:${c.members.map((m) => `${m.token.id}=${m.level}`).join(",")}`);
    expect(snapshot(detectClusters([...tokens].reverse()))).toEqual(snapshot(clusters));
    expect(snapshot(detectClusters(tokens))).toEqual(snapshot(clusters));
  });
});

describe("sensitivity slider (A.6)", () => {
  const spacing = (id: string, value: number, occurrences: number): SpacingToken => ({
    id,
    captureId: `cap-${id}`,
    source: "x",
    name: null,
    occurrences,
    merged: false,
    type: "spacing",
    value,
  });

  it("rounds spacing decimals then clusters near values (8.5 ≈ 9.4 → 9)", () => {
    const pair = [spacing("a", 8.5, 3), spacing("b", 9.4, 2)];
    // Values are clustered as-captured; pool normalizes on import — simulate that.
    const rounded = pair.map((t) => ({ ...t, value: Math.round(t.value) }));
    const clusters = detectClusters(rounded);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.every((m) => m.level === "duplicate")).toBe(true);
    expect((clusters[0].canonical as SpacingToken).value).toBe(9);
  });

  it("spacing similar floor is 2px — 8 and 9 flag as similar", () => {
    const pair = [spacing("a", 8, 5), spacing("b", 9, 2)];
    const clusters = detectClusters(pair);
    expect(clusters).toHaveLength(1);
    expect(clusters[0].members[0].level).toBe("similar");
  });

  it("×1.5 loose picks up a pair that ×1 default leaves apart — flags only", () => {
    const pair = [spacing("a", 100, 5), spacing("b", 107, 2)];
    expect(detectClusters(pair, "default")).toHaveLength(0); // gap 7 > tol 5
    const loose = detectClusters(pair, "loose"); // tol 8 ≥ 7
    expect(loose).toHaveLength(1);
    expect(loose[0].members[0].level).toBe("similar");
  });

  it("strict keeps the 15/16 similar flag (1px floor) but is never below it", () => {
    const strict = detectClusters(tokens, "strict");
    const cluster = strict.find((c) => c.members.some((m) => m.token.id === "ext_022"));
    expect(cluster).toBeDefined();
  });
});

describe("merge + un-merge (§7.4, FR-12/13)", () => {
  const wrap = (ts: StyleSnapToken[]) => ts.map((token) => ({ token }));

  it("survivor inherits Σ occurrences and mergedFrom; absorbed tokens leave the view", () => {
    const blues = clusterOf("ext_001")!;
    const merge = {
      survivorId: "ext_001",
      mergedIds: blues.members.map((m) => m.token.id),
      mergedAt: "2026-07-04T12:00:00Z",
    };
    const view = applyMerges(wrap(tokens), [merge]);
    const survivor = view.find((e) => e.token.id === "ext_001")!;
    expect(survivor.token.merged).toBe(true);
    expect(survivor.token.occurrences).toBe(18 + 3 + 1 + 2 + 12); // Σ cluster
    expect(survivor.token.mergedFrom!.sort()).toEqual(["ext_002", "ext_003", "ext_004", "fig_001"]);
    expect(view.some((e) => e.token.id === "ext_002")).toBe(false);
    expect(view).toHaveLength(tokens.length - 4);
  });

  it("un-merge (dropping the record) restores the original state exactly", () => {
    const merge = {
      survivorId: "ext_001",
      mergedIds: ["ext_002", "ext_003", "ext_004", "fig_001"],
      mergedAt: "2026-07-04T12:00:00Z",
    };
    const before = wrap(tokens);
    applyMerges(before, [merge]); // apply…
    expect(applyMerges(before, [])).toEqual(wrap(tokens)); // …drop the record
    expect(before.map((e) => e.token.id)).toEqual(tokens.map((t) => t.id)); // input untouched
  });

  it("a second merge absorbing a survivor carries its mergedFrom along", () => {
    const first = { survivorId: "ext_002", mergedIds: ["ext_003"], mergedAt: "t1" };
    const second = { survivorId: "ext_001", mergedIds: ["ext_002"], mergedAt: "t2" };
    const view = applyMerges(wrap(tokens), [first, second]);
    const survivor = view.find((e) => e.token.id === "ext_001")!;
    expect(survivor.token.mergedFrom!.sort()).toEqual(["ext_002", "ext_003"]);
    expect(survivor.token.occurrences).toBe(18 + 3 + 1);
  });

  it("missing survivor still hides absorbed members — Remove ≠ Un-merge (§2.53)", () => {
    const merge = {
      survivorId: "ext_001",
      mergedIds: ["ext_002", "ext_003"],
      mergedAt: "t",
    };
    const withoutSurvivor = wrap(tokens).filter((e) => e.token.id !== "ext_001");
    const view = applyMerges(withoutSurvivor, [merge]);
    expect(view.find((e) => e.token.id === "ext_001")).toBeUndefined();
    expect(view.find((e) => e.token.id === "ext_002")).toBeUndefined();
    expect(view.find((e) => e.token.id === "ext_003")).toBeUndefined();
  });
});
