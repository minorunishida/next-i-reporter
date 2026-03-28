import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { batchUpdateClusters, nudgeClusters, computeGroupBounds, rubberBandHitTest } from "./cluster-editor-utils.ts";
import type { ClusterDefinition } from "./form-structure.ts";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeCluster(id: string, region: { top: number; bottom: number; left: number; right: number }): ClusterDefinition {
  return {
    id,
    name: `cluster-${id}`,
    type: 65,
    typeName: "KeyboardText",
    sheetNo: 0,
    cellAddress: "A1",
    region,
    confidence: 0.95,
    readOnly: false,
    inputParameters: "",
  };
}

const identity = (c: ClusterDefinition) => ({
  top: c.region.top,
  left: c.region.left,
  right: c.region.right,
  bottom: c.region.bottom,
});

// ─── batchUpdateClusters ─────────────────────────────────────────────────────

describe("batchUpdateClusters", () => {
  it("applies multiple patches in a single pass", () => {
    const clusters = [
      makeCluster("a", { top: 0, bottom: 10, left: 0, right: 10 }),
      makeCluster("b", { top: 20, bottom: 30, left: 20, right: 30 }),
      makeCluster("c", { top: 40, bottom: 50, left: 40, right: 50 }),
    ];
    const patches = new Map<string, Partial<ClusterDefinition>>([
      ["a", { region: { top: 5, bottom: 15, left: 5, right: 15 } }],
      ["b", { region: { top: 25, bottom: 35, left: 25, right: 35 } }],
    ]);
    const result = batchUpdateClusters(clusters, patches);

    assert.deepStrictEqual(result[0].region, { top: 5, bottom: 15, left: 5, right: 15 });
    assert.deepStrictEqual(result[1].region, { top: 25, bottom: 35, left: 25, right: 35 });
    // Unpatched cluster unchanged
    assert.deepStrictEqual(result[2].region, { top: 40, bottom: 50, left: 40, right: 50 });
  });

  it("returns original cluster objects for unpatched entries", () => {
    const clusters = [makeCluster("a", { top: 0, bottom: 10, left: 0, right: 10 })];
    const result = batchUpdateClusters(clusters, new Map());
    assert.strictEqual(result[0], clusters[0]);
  });

  it("empty patches returns array of same references", () => {
    const clusters = [
      makeCluster("a", { top: 0, bottom: 10, left: 0, right: 10 }),
      makeCluster("b", { top: 20, bottom: 30, left: 20, right: 30 }),
    ];
    const result = batchUpdateClusters(clusters, new Map());
    assert.strictEqual(result[0], clusters[0]);
    assert.strictEqual(result[1], clusters[1]);
  });
});

// ─── nudgeClusters ───────────────────────────────────────────────────────────

describe("nudgeClusters", () => {
  it("shifts selected clusters by dx, dy", () => {
    const clusters = [
      makeCluster("a", { top: 10, bottom: 20, left: 10, right: 20 }),
      makeCluster("b", { top: 30, bottom: 40, left: 30, right: 40 }),
    ];
    const result = nudgeClusters(clusters, new Set(["a", "b"]), 5, -3);

    assert.deepStrictEqual(result[0].region, { top: 7, bottom: 17, left: 15, right: 25 });
    assert.deepStrictEqual(result[1].region, { top: 27, bottom: 37, left: 35, right: 45 });
  });

  it("leaves unselected clusters unchanged", () => {
    const clusters = [
      makeCluster("a", { top: 10, bottom: 20, left: 10, right: 20 }),
      makeCluster("b", { top: 30, bottom: 40, left: 30, right: 40 }),
    ];
    const result = nudgeClusters(clusters, new Set(["a"]), 5, 5);

    assert.deepStrictEqual(result[0].region, { top: 15, bottom: 25, left: 15, right: 25 });
    assert.strictEqual(result[1], clusters[1]); // same reference — untouched
  });

  it("with empty selection returns all clusters unchanged", () => {
    const clusters = [makeCluster("a", { top: 10, bottom: 20, left: 10, right: 20 })];
    const result = nudgeClusters(clusters, new Set(), 100, 100);
    assert.strictEqual(result[0], clusters[0]);
  });

  it("Shift+arrow nudge of 10px works correctly", () => {
    const clusters = [makeCluster("a", { top: 0, bottom: 50, left: 0, right: 50 })];
    const result = nudgeClusters(clusters, new Set(["a"]), 10, 10);
    assert.deepStrictEqual(result[0].region, { top: 10, bottom: 60, left: 10, right: 60 });
  });
});

// ─── computeGroupBounds ──────────────────────────────────────────────────────

describe("computeGroupBounds", () => {
  it("returns bounding rect for 2+ selected clusters", () => {
    const clusters = [
      makeCluster("a", { top: 10, bottom: 30, left: 5, right: 25 }),
      makeCluster("b", { top: 50, bottom: 80, left: 40, right: 70 }),
      makeCluster("c", { top: 100, bottom: 110, left: 100, right: 110 }),
    ];
    const result = computeGroupBounds(clusters, new Set(["a", "b"]), identity);
    assert.deepStrictEqual(result, { left: 5, top: 10, width: 65, height: 70 });
  });

  it("returns null for single selection", () => {
    const clusters = [makeCluster("a", { top: 10, bottom: 30, left: 5, right: 25 })];
    const result = computeGroupBounds(clusters, new Set(["a"]), identity);
    assert.strictEqual(result, null);
  });

  it("returns null for empty selection", () => {
    const clusters = [makeCluster("a", { top: 10, bottom: 30, left: 5, right: 25 })];
    const result = computeGroupBounds(clusters, new Set(), identity);
    assert.strictEqual(result, null);
  });

  it("skips clusters where toScreenRect returns null", () => {
    const clusters = [
      makeCluster("a", { top: 10, bottom: 30, left: 5, right: 25 }),
      makeCluster("b", { top: 50, bottom: 80, left: 40, right: 70 }),
      makeCluster("c", { top: 0, bottom: 0, left: 0, right: 0 }),
    ];
    // c returns null from toScreenRect
    const toScreen = (c: ClusterDefinition) => c.id === "c" ? null : identity(c);
    const result = computeGroupBounds(clusters, new Set(["a", "b", "c"]), toScreen);
    assert.deepStrictEqual(result, { left: 5, top: 10, width: 65, height: 70 });
  });
});

// ─── rubberBandHitTest ───────────────────────────────────────────────────────

describe("rubberBandHitTest", () => {
  const clusters = [
    makeCluster("a", { top: 10, bottom: 30, left: 10, right: 30 }),
    makeCluster("b", { top: 50, bottom: 70, left: 50, right: 70 }),
    makeCluster("c", { top: 100, bottom: 120, left: 100, right: 120 }),
  ];

  it("selects clusters overlapping the selection rect", () => {
    const sel = { left: 0, top: 0, right: 40, bottom: 40 };
    const result = rubberBandHitTest(clusters, sel, identity);
    assert.deepStrictEqual(result, new Set(["a"]));
  });

  it("selects multiple clusters in a large rect", () => {
    const sel = { left: 0, top: 0, right: 200, bottom: 200 };
    const result = rubberBandHitTest(clusters, sel, identity);
    assert.deepStrictEqual(result, new Set(["a", "b", "c"]));
  });

  it("returns empty set when no clusters overlap", () => {
    const sel = { left: 200, top: 200, right: 300, bottom: 300 };
    const result = rubberBandHitTest(clusters, sel, identity);
    assert.strictEqual(result.size, 0);
  });

  it("partial overlap counts as hit", () => {
    // Selection rect overlaps just the corner of cluster "b"
    const sel = { left: 45, top: 45, right: 55, bottom: 55 };
    const result = rubberBandHitTest(clusters, sel, identity);
    assert.deepStrictEqual(result, new Set(["b"]));
  });

  it("edge-touching (zero area overlap) does not count as hit", () => {
    // Selection rect touches the right edge of "a" exactly
    const sel = { left: 30, top: 10, right: 40, bottom: 30 };
    const result = rubberBandHitTest(clusters, sel, identity);
    assert.strictEqual(result.size, 0);
  });

  it("skips clusters where toScreenRect returns null", () => {
    const sel = { left: 0, top: 0, right: 200, bottom: 200 };
    const toScreen = (c: ClusterDefinition) => c.id === "b" ? null : identity(c);
    const result = rubberBandHitTest(clusters, sel, toScreen);
    assert.deepStrictEqual(result, new Set(["a", "c"]));
  });
});
