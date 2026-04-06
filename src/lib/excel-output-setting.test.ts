import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { injectExcelOutputSettingSheet } from "./excel-output-setting";
import type { AnalysisResult } from "./form-structure";
import { buildExcelOutputSettingXml } from "./excel-setting-xml-builder";

function emptyXlsxBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[""]]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const w = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const u8 = w instanceof Uint8Array ? w : new Uint8Array(w as ArrayBuffer);
  return Buffer.from(u8);
}

function minimalAnalysisResult(): AnalysisResult {
  return {
    formStructure: {
      fileName: "test.xlsx",
      sheets: [
        {
          index: 0,
          name: "Sheet1",
          rowCount: 10,
          colCount: 10,
          rowHeights: [],
          colWidths: [],
          totalWidth: 100,
          totalHeight: 100,
          cells: [],
          pageSetup: {
            orientation: "portrait",
            paperSize: "A4",
            margins: { top: 0, bottom: 0, left: 0, right: 0 },
          },
        },
      ],
      excelBase64: "",
    },
    clusters: [
      {
        id: "c1",
        sheetNo: 0,
        name: "A",
        type: 30,
        typeName: "KeyboardText",
        cellAddress: "A1",
        region: { top: 0, bottom: 0.1, left: 0, right: 0.1 },
        confidence: 1,
        readOnly: false,
        inputParameters: "",
      },
    ],
    summary: {
      totalClusters: 1,
      highConfidence: 1,
      mediumConfidence: 0,
      lowConfidence: 0,
    },
  };
}

describe("injectExcelOutputSettingSheet", () => {
  it("空 xlsx に ExcelOutputSetting を追加し、A1 に設定 XML を書き込む", async () => {
    const buf = emptyXlsxBuffer();
    const xml = "<top><test>1</test></top>";
    const out = await injectExcelOutputSettingSheet(buf, xml);

    const wb = XLSX.read(out, { type: "buffer", cellText: false, cellDates: false });
    assert.ok(wb.SheetNames.includes("ExcelOutputSetting"));

    const ws = wb.Sheets.ExcelOutputSetting;
    assert.ok(ws);
    const a1 = ws!["A1"] as XLSX.CellObject | undefined;
    assert.ok(a1);
    assert.equal(a1!.w ?? a1!.v, xml);
  });

  it("buildExcelOutputSettingXml の内容がそのまま A1 に入る", async () => {
    const buf = emptyXlsxBuffer();
    const result = minimalAnalysisResult();
    const settingXml = buildExcelOutputSettingXml(result);
    const out = await injectExcelOutputSettingSheet(buf, settingXml);

    const wb = XLSX.read(out, { type: "buffer" });
    const ws = wb.Sheets.ExcelOutputSetting;
    const a1 = ws!["A1"] as XLSX.CellObject;
    const got = String(a1.w ?? a1.v ?? "");
    assert.equal(got, settingXml);
    assert.match(got, /<top>/);
    assert.match(got, /<sheetCount>1<\/sheetCount>/);
    assert.match(got, /<sheets>/);
    assert.match(got, /<sheet>/);
    assert.match(got, /<cluster>/);
  });
});
