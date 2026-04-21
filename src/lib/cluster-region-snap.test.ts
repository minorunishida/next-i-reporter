import test from "node:test";
import assert from "node:assert/strict";
import { snapClusterRegionToCell } from "./cluster-region-snap.ts";
import type { SheetStructure } from "./form-structure.ts";

const baseSheet = (): SheetStructure => ({
  name: "S",
  index: 0,
  rowCount: 2,
  colCount: 2,
  rowHeights: [10, 20],
  colWidths: [30, 50],
  totalWidth: 80,
  totalHeight: 30,
  cells: [
    {
      address: "B2",
      row: 1,
      col: 1,
      value: "v",
      isMerged: false,
      region: { top: 10, bottom: 30, left: 30, right: 80 },
      style: {},
    },
  ],
  pageSetup: { orientation: "portrait", paperSize: "A4", margins: { top: 10, bottom: 10, left: 10, right: 10 } },
});

test("snapClusterRegionToCell: replaces with sheet cell region", () => {
  const sheet = baseSheet();
  const wrong = { top: 0, bottom: 5, left: 0, right: 5 };
  const out = snapClusterRegionToCell(sheet, "B2", wrong);
  assert.deepEqual(out, { top: 10, bottom: 30, left: 30, right: 80 });
});

test("snapClusterRegionToCell: strips $ and keeps fallback when unknown", () => {
  const sheet = baseSheet();
  const fb = { top: 1, bottom: 2, left: 3, right: 4 };
  assert.deepEqual(snapClusterRegionToCell(sheet, "$Z$99", fb), fb);
});
