import test from "node:test";
import assert from "node:assert/strict";
import { correctDimensionsFromPrintMeta } from "./dimension-corrector.ts";
import type { SheetStructure, PrintMeta } from "./form-structure.ts";

function makeSheet(overrides?: Partial<SheetStructure>): SheetStructure {
  return {
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
    ...overrides,
  };
}

function makePrintMeta(overrides?: Partial<PrintMeta>): PrintMeta {
  return {
    name: "Sheet1",
    usedRange: { startRow: 1, startCol: 1, endRow: 3, endCol: 3, top: 0, left: 0, width: 300, height: 200 },
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

test("correctDimensionsFromPrintMeta: row heights corrected from printMeta", () => {
  const sheet = makeSheet();
  const meta = makePrintMeta({
    rows: [
      { row: 1, height: 30, top: 0 },
      { row: 2, height: 40, top: 30 },
      { row: 3, height: 50, top: 70 },
    ],
  });
  correctDimensionsFromPrintMeta(sheet, meta);
  assert.deepEqual(sheet.rowHeights, [30, 40, 50]);
  assert.equal(sheet.totalHeight, 120);
});

test("correctDimensionsFromPrintMeta: column widths corrected from printMeta", () => {
  const sheet = makeSheet();
  const meta = makePrintMeta({
    columns: [
      { col: 1, width: 100, left: 0 },
      { col: 2, width: 150, left: 100 },
      { col: 3, width: 200, left: 250 },
    ],
  });
  correctDimensionsFromPrintMeta(sheet, meta);
  assert.deepEqual(sheet.colWidths, [100, 150, 200]);
  assert.equal(sheet.totalWidth, 450);
});

test("correctDimensionsFromPrintMeta: cell regions recalculated", () => {
  const sheet = makeSheet({
    cells: [
      {
        address: "A1", row: 0, col: 0, value: "test", isMerged: false,
        region: { top: 0, bottom: 20, left: 0, right: 64 },
        style: {},
      },
    ],
  });
  const meta = makePrintMeta({
    rows: [{ row: 1, height: 50, top: 0 }],
    columns: [{ col: 1, width: 100, left: 0 }],
  });
  correctDimensionsFromPrintMeta(sheet, meta);
  assert.equal(sheet.cells[0].region.top, 0);
  assert.equal(sheet.cells[0].region.bottom, 50);
  assert.equal(sheet.cells[0].region.left, 0);
  assert.equal(sheet.cells[0].region.right, 100);
});

test("correctDimensionsFromPrintMeta: no rows/columns in meta leaves sheet unchanged", () => {
  const sheet = makeSheet();
  const origWidths = [...sheet.colWidths];
  const origHeights = [...sheet.rowHeights];
  const meta = makePrintMeta({ rows: [], columns: [] });
  correctDimensionsFromPrintMeta(sheet, meta);
  assert.deepEqual(sheet.colWidths, origWidths);
  assert.deepEqual(sheet.rowHeights, origHeights);
});
