import test from "node:test";
import assert from "node:assert/strict";
import { rectsOverlap, removeOverlaps } from "./overlap-utils.ts";
import type { ClusterDefinition } from "./form-structure.ts";

function makeCluster(overrides: Partial<ClusterDefinition>): ClusterDefinition {
  return {
    id: "0-0",
    name: "",
    type: 30,
    typeName: "KeyboardText",
    sheetNo: 0,
    cellAddress: "A1",
    region: { top: 0, bottom: 10, left: 0, right: 10 },
    confidence: 0.9,
    readOnly: false,
    inputParameters: "",
    ...overrides,
  };
}

// --- rectsOverlap ---

test("rectsOverlap: non-overlapping rects (horizontally separated) returns false", () => {
  const a = { top: 0, bottom: 10, left: 0, right: 10 };
  const b = { top: 0, bottom: 10, left: 20, right: 30 };
  assert.equal(rectsOverlap(a, b), false);
});

test("rectsOverlap: non-overlapping rects (vertically separated) returns false", () => {
  const a = { top: 0, bottom: 10, left: 0, right: 10 };
  const b = { top: 20, bottom: 30, left: 0, right: 10 };
  assert.equal(rectsOverlap(a, b), false);
});

test("rectsOverlap: identical rects returns true", () => {
  const a = { top: 0, bottom: 10, left: 0, right: 10 };
  assert.equal(rectsOverlap(a, a), true);
});

test("rectsOverlap: one rect fully contained in another returns true", () => {
  const outer = { top: 0, bottom: 100, left: 0, right: 100 };
  const inner = { top: 10, bottom: 20, left: 10, right: 20 };
  assert.equal(rectsOverlap(outer, inner), true);
});

test("rectsOverlap: small overlap (<50%) returns false", () => {
  const a = { top: 0, bottom: 10, left: 0, right: 10 }; // area=100
  const b = { top: 0, bottom: 10, left: 8, right: 18 }; // area=100, overlap=2*10=20 -> 20%
  assert.equal(rectsOverlap(a, b), false);
});

test("rectsOverlap: large overlap (>50%) returns true", () => {
  const a = { top: 0, bottom: 10, left: 0, right: 10 }; // area=100
  const b = { top: 0, bottom: 10, left: 3, right: 13 }; // area=100, overlap=7*10=70 -> 70%
  assert.equal(rectsOverlap(a, b), true);
});

test("rectsOverlap: edge-touching rects (zero overlap) returns false", () => {
  const a = { top: 0, bottom: 10, left: 0, right: 10 };
  const b = { top: 0, bottom: 10, left: 10, right: 20 };
  assert.equal(rectsOverlap(a, b), false);
});

// --- removeOverlaps ---

test("removeOverlaps: no overlapping clusters keeps all", () => {
  const clusters = [
    makeCluster({ id: "0-0", region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.9 }),
    makeCluster({ id: "0-1", region: { top: 0, bottom: 10, left: 20, right: 30 }, confidence: 0.8 }),
  ];
  const result = removeOverlaps(clusters);
  assert.equal(result.length, 2);
});

test("removeOverlaps: overlapping clusters keeps higher confidence", () => {
  const clusters = [
    makeCluster({ id: "0-0", region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.7 }),
    makeCluster({ id: "0-1", region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.95 }),
  ];
  const result = removeOverlaps(clusters);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "0-1");
});

test("removeOverlaps: overlapping clusters with equal confidence keeps first", () => {
  const clusters = [
    makeCluster({ id: "0-0", region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.9 }),
    makeCluster({ id: "0-1", region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.9 }),
  ];
  const result = removeOverlaps(clusters);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, "0-0");
});

test("removeOverlaps: clusters on different sheets with overlapping regions both kept", () => {
  const clusters = [
    makeCluster({ id: "0-0", sheetNo: 0, region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.9 }),
    makeCluster({ id: "1-0", sheetNo: 1, region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.8 }),
  ];
  const result = removeOverlaps(clusters);
  assert.equal(result.length, 2);
});

test("removeOverlaps: multiple clusters with partial overlaps", () => {
  const clusters = [
    makeCluster({ id: "0-0", region: { top: 0, bottom: 10, left: 0, right: 10 }, confidence: 0.9 }),
    makeCluster({ id: "0-1", region: { top: 0, bottom: 10, left: 3, right: 13 }, confidence: 0.95 }), // overlaps with 0-0
    makeCluster({ id: "0-2", region: { top: 20, bottom: 30, left: 0, right: 10 }, confidence: 0.8 }), // no overlap
  ];
  const result = removeOverlaps(clusters);
  assert.equal(result.length, 2);
  assert.ok(result.some((c) => c.id === "0-1"));
  assert.ok(result.some((c) => c.id === "0-2"));
});
