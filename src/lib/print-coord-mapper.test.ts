import test from "node:test";
import assert from "node:assert/strict";
import {
  interpolate,
  cumulativeSum,
  extrapolatePx,
  safeDivide,
  computePdfContentArea,
  computePrintAreaPx,
  mapClusterRegionToPdf,
} from "./print-coord-mapper.ts";
import type { PxPtPair } from "./print-coord-mapper.ts";
import type { SheetStructure, PrintMeta } from "./form-structure.ts";

// --- cumulativeSum ---

test("cumulativeSum: empty array returns [0]", () => {
  assert.deepEqual(cumulativeSum([]), [0]);
});

test("cumulativeSum: normal array", () => {
  assert.deepEqual(cumulativeSum([10, 20, 30]), [0, 10, 30, 60]);
});

// --- safeDivide ---

test("safeDivide: normal division", () => {
  assert.equal(safeDivide(10, 2, 0), 5);
});

test("safeDivide: division by zero returns fallback", () => {
  assert.equal(safeDivide(10, 0, 99), 99);
});

// --- extrapolatePx ---

test("extrapolatePx: in-range index returns cumulative value", () => {
  // Not really testing extrapolation here, just the out-of-range path
  const cum = [0, 10, 30, 60]; // lengths [10, 20, 30]
  const result = extrapolatePx(cum, 4); // one past the end
  // lastWidth = 60 - 30 = 30, extrapolated = 60 + 30 * (4 - 3) = 90
  assert.equal(result, 90);
});

test("extrapolatePx: array with < 2 elements uses fallback", () => {
  assert.equal(extrapolatePx([0], 3), 3 * 64);
});

// --- interpolate ---

test("interpolate: empty points returns px unchanged", () => {
  assert.equal(interpolate([], 50), 50);
});

test("interpolate: single point returns that pt", () => {
  const points: PxPtPair[] = [{ px: 0, pt: 100 }];
  assert.equal(interpolate(points, 50), 100);
});

test("interpolate: exact match returns exact pt", () => {
  const points: PxPtPair[] = [
    { px: 0, pt: 0 },
    { px: 100, pt: 200 },
  ];
  assert.equal(interpolate(points, 0), 0);
  assert.equal(interpolate(points, 100), 200);
});

test("interpolate: midpoint returns linear interpolation", () => {
  const points: PxPtPair[] = [
    { px: 0, pt: 0 },
    { px: 100, pt: 200 },
  ];
  assert.equal(interpolate(points, 50), 100);
});

test("interpolate: below range extrapolates", () => {
  const points: PxPtPair[] = [
    { px: 10, pt: 20 },
    { px: 20, pt: 40 },
  ];
  // ratio = (40-20)/(20-10) = 2, result = 20 + (0-10)*2 = 0
  assert.equal(interpolate(points, 0), 0);
});

test("interpolate: above range extrapolates", () => {
  const points: PxPtPair[] = [
    { px: 0, pt: 0 },
    { px: 10, pt: 20 },
  ];
  // ratio = 20/10 = 2, result = 20 + (15-10)*2 = 30
  assert.equal(interpolate(points, 15), 30);
});

test("interpolate: binary search with many points", () => {
  const points: PxPtPair[] = [
    { px: 0, pt: 0 },
    { px: 10, pt: 10 },
    { px: 20, pt: 20 },
    { px: 30, pt: 30 },
    { px: 40, pt: 40 },
  ];
  assert.equal(interpolate(points, 25), 25);
  assert.equal(interpolate(points, 35), 35);
});

// --- computePdfContentArea ---

function makePrintMeta(overrides?: Partial<PrintMeta>): PrintMeta {
  return {
    name: "Sheet1",
    usedRange: { startRow: 1, startCol: 1, endRow: 10, endCol: 5, top: 0, left: 0, width: 400, height: 600 },
    margins: { top: 36, bottom: 36, left: 36, right: 36, header: 18, footer: 18 },
    paperSize: 9,
    orientation: 1,
    pdfPageWidthPt: 595.28,
    pdfPageHeightPt: 841.89,
    rows: [],
    columns: [],
    ...overrides,
  };
}

test("computePdfContentArea: with zoom=100 returns scale=1", () => {
  const pm = makePrintMeta({ zoom: 100 });
  const result = computePdfContentArea(pm);
  assert.equal(result.scale, 1);
  const expectedW = 595.28 - 36 - 36;
  assert.ok(Math.abs(result.width - pm.usedRange.width) < 0.01);
});

test("computePdfContentArea: with fitToPage and small content, scale capped at 1", () => {
  const pm = makePrintMeta({
    fitToPagesWide: 1,
    usedRange: { startRow: 1, startCol: 1, endRow: 5, endCol: 3, top: 0, left: 0, width: 100, height: 100 },
  });
  const result = computePdfContentArea(pm);
  assert.equal(result.scale, 1.0); // should not upscale
});

test("computePdfContentArea: with fitToPage and large content, scale < 1", () => {
  const pm = makePrintMeta({
    fitToPagesWide: 1,
    usedRange: { startRow: 1, startCol: 1, endRow: 50, endCol: 20, top: 0, left: 0, width: 2000, height: 3000 },
  });
  const result = computePdfContentArea(pm);
  assert.ok(result.scale < 1);
});

// --- computePrintAreaPx ---

test("computePrintAreaPx: basic computation", () => {
  const sheet: SheetStructure = {
    name: "Sheet1",
    index: 0,
    rowCount: 3,
    colCount: 3,
    rowHeights: [20, 20, 20],
    colWidths: [64, 64, 64],
    totalWidth: 192,
    totalHeight: 60,
    cells: [],
    pageSetup: { orientation: "portrait", paperSize: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } },
  };
  const pm = makePrintMeta({
    usedRange: { startRow: 1, startCol: 1, endRow: 3, endCol: 3, top: 0, left: 0, width: 200, height: 100 },
  });
  const result = computePrintAreaPx(sheet, pm);
  assert.equal(result.left, 0);
  assert.equal(result.top, 0);
  assert.equal(result.width, 192); // all 3 columns
  assert.equal(result.height, 60); // all 3 rows
});

// --- mapClusterRegionToPdf ---

test("mapClusterRegionToPdf: returns null when print area has zero dimensions", () => {
  const sheet: SheetStructure = {
    name: "Sheet1", index: 0, rowCount: 3, colCount: 3,
    rowHeights: [20, 20, 20], colWidths: [64, 64, 64],
    totalWidth: 192, totalHeight: 60, cells: [],
    pageSetup: { orientation: "portrait", paperSize: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } },
  };
  const pm = makePrintMeta({
    usedRange: { startRow: 1, startCol: 1, endRow: 1, endCol: 1, top: 0, left: 0, width: 0, height: 0 },
  });
  const result = mapClusterRegionToPdf({ top: 0, bottom: 20, left: 0, right: 64 }, sheet, pm);
  assert.equal(result, null);
});

test("mapClusterRegionToPdf: returns 0-1 normalized coordinates", () => {
  const sheet: SheetStructure = {
    name: "Sheet1", index: 0, rowCount: 10, colCount: 5,
    rowHeights: Array(10).fill(20), colWidths: Array(5).fill(64),
    totalWidth: 320, totalHeight: 200, cells: [],
    pageSetup: { orientation: "portrait", paperSize: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } },
  };
  const pm = makePrintMeta({
    zoom: 100,
    usedRange: { startRow: 1, startCol: 1, endRow: 10, endCol: 5, top: 0, left: 0, width: 400, height: 300 },
    rows: Array.from({ length: 10 }, (_, i) => ({ row: i + 1, height: 30, top: i * 30 })),
    columns: Array.from({ length: 5 }, (_, i) => ({ col: i + 1, width: 80, left: i * 80 })),
  });
  const result = mapClusterRegionToPdf({ top: 0, bottom: 20, left: 0, right: 64 }, sheet, pm);
  assert.ok(result);
  assert.ok(result.top >= 0 && result.top <= 1, `top ${result.top} out of range`);
  assert.ok(result.bottom >= 0 && result.bottom <= 1, `bottom ${result.bottom} out of range`);
  assert.ok(result.left >= 0 && result.left <= 1, `left ${result.left} out of range`);
  assert.ok(result.right >= 0 && result.right <= 1, `right ${result.right} out of range`);
  assert.ok(result.bottom > result.top);
  assert.ok(result.right > result.left);
});
