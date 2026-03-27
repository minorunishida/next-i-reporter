import test from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  parseExcel,
  cumulativeSum,
  buildMergeMap,
  extractStyle,
  extractPageSetup,
  getCellValue,
} from "./excel-parser.ts";

// --- cumulativeSum ---

test("cumulativeSum: empty array returns [0]", () => {
  assert.deepEqual(cumulativeSum([]), [0]);
});

test("cumulativeSum: normal array", () => {
  assert.deepEqual(cumulativeSum([10, 20, 30]), [0, 10, 30, 60]);
});

test("cumulativeSum: single element", () => {
  assert.deepEqual(cumulativeSum([5]), [0, 5]);
});

// --- buildMergeMap ---

test("buildMergeMap: empty merges returns empty map", () => {
  const map = buildMergeMap([]);
  assert.equal(map.size, 0);
});

test("buildMergeMap: single merge covers all cells", () => {
  const merges: XLSX.Range[] = [{ s: { r: 0, c: 0 }, e: { r: 1, c: 1 } }];
  const map = buildMergeMap(merges);
  // 2x2 merge = 4 entries
  assert.equal(map.size, 4);
  assert.ok(map.has("0,0"));
  assert.ok(map.has("0,1"));
  assert.ok(map.has("1,0"));
  assert.ok(map.has("1,1"));
  const info = map.get("0,0")!;
  assert.equal(info.startRow, 0);
  assert.equal(info.startCol, 0);
  assert.equal(info.endRow, 1);
  assert.equal(info.endCol, 1);
});

test("buildMergeMap: multiple non-overlapping merges", () => {
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // A1:B1
    { s: { r: 2, c: 2 }, e: { r: 3, c: 3 } }, // C3:D4
  ];
  const map = buildMergeMap(merges);
  assert.equal(map.size, 2 + 4); // 2 cells + 4 cells
  assert.ok(map.has("0,0"));
  assert.ok(map.has("2,2"));
});

// --- getCellValue ---

test("getCellValue: formatted text (w) takes priority", () => {
  const cell = { t: "s", v: "raw", w: "formatted" } as XLSX.CellObject;
  assert.equal(getCellValue(cell), "formatted");
});

test("getCellValue: falls back to v", () => {
  const cell = { t: "n", v: 42 } as XLSX.CellObject;
  assert.equal(getCellValue(cell), "42");
});

test("getCellValue: empty cell returns empty string", () => {
  const cell = { t: "z" } as XLSX.CellObject;
  assert.equal(getCellValue(cell), "");
});

// --- extractStyle ---

test("extractStyle: undefined cell returns empty style", () => {
  const style = extractStyle(undefined);
  assert.deepEqual(style, {});
});

test("extractStyle: cell with bold font", () => {
  const cell = { t: "s", v: "", s: { font: { bold: true } } } as unknown as XLSX.CellObject;
  const style = extractStyle(cell);
  assert.equal(style.bold, true);
});

test("extractStyle: cell with background color", () => {
  const cell = {
    t: "s", v: "",
    s: { fill: { fgColor: { rgb: "FF0000FF" } } },
  } as unknown as XLSX.CellObject;
  const style = extractStyle(cell);
  assert.equal(style.bgColor, "#0000FF");
});

test("extractStyle: cell with alignment", () => {
  const cell = {
    t: "s", v: "",
    s: { alignment: { horizontal: "center" } },
  } as unknown as XLSX.CellObject;
  const style = extractStyle(cell);
  assert.equal(style.horizontalAlignment, "center");
});

test("extractStyle: cell with number format via z property", () => {
  // cell.s must be truthy for extractStyle to proceed past the early return
  const cell = { t: "n", v: 1, z: "#,##0", s: {} } as unknown as XLSX.CellObject;
  const style = extractStyle(cell);
  assert.equal(style.numberFormat, "#,##0");
});

// --- extractPageSetup ---

test("extractPageSetup: default worksheet returns portrait A4", () => {
  const ws = XLSX.utils.aoa_to_sheet([["A"]]);
  const setup = extractPageSetup(ws);
  assert.equal(setup.orientation, "portrait");
  assert.equal(setup.paperSize, "A4");
});

test("extractPageSetup: landscape orientation", () => {
  const ws = XLSX.utils.aoa_to_sheet([["A"]]);
  (ws as Record<string, unknown>)["!pageSetup"] = { orientation: "landscape" };
  const setup = extractPageSetup(ws);
  assert.equal(setup.orientation, "landscape");
});

test("extractPageSetup: paper size codes mapped correctly", () => {
  const ws = XLSX.utils.aoa_to_sheet([["A"]]);

  (ws as Record<string, unknown>)["!pageSetup"] = { paperSize: 8 };
  assert.equal(extractPageSetup(ws).paperSize, "A3");

  (ws as Record<string, unknown>)["!pageSetup"] = { paperSize: 12 };
  assert.equal(extractPageSetup(ws).paperSize, "B4");

  (ws as Record<string, unknown>)["!pageSetup"] = { paperSize: 999 };
  assert.equal(extractPageSetup(ws).paperSize, "other");
});

test("extractPageSetup: margins converted from inches to mm", () => {
  const ws = XLSX.utils.aoa_to_sheet([["A"]]);
  (ws as Record<string, unknown>)["!margins"] = { top: 1, bottom: 1, left: 0.5, right: 0.5 };
  const setup = extractPageSetup(ws);
  assert.ok(Math.abs(setup.margins.top - 25.4) < 0.01);
  assert.ok(Math.abs(setup.margins.left - 12.7) < 0.01);
});

// --- parseExcel ---

test("parseExcel: simple workbook produces correct structure", () => {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([["Name", "Value"], ["Test", 42]]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const result = parseExcel(buf, "test.xlsx");
  assert.equal(result.fileName, "test.xlsx");
  assert.equal(result.sheets.length, 1);
  assert.equal(result.sheets[0].name, "Sheet1");
  assert.ok(result.sheets[0].rowCount >= 2);
  assert.ok(result.sheets[0].colCount >= 2);
  assert.ok(result.sheets[0].cells.length > 0);
});

test("parseExcel: ExcelOutputSetting sheet is filtered out", () => {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["A"]]), "Sheet1");
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["B"]]), "ExcelOutputSetting");
  const buf = XLSX.write(wb, { type: "array", bookType: "xlsx" });

  const result = parseExcel(buf, "test.xlsx");
  assert.equal(result.sheets.length, 1);
  assert.equal(result.sheets[0].name, "Sheet1");
});
