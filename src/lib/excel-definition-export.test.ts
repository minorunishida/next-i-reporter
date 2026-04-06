import test from "node:test";
import assert from "node:assert/strict";
import { buildMergedDefinitionExcelBase64 } from "./excel-definition-export.ts";
import type { AnalysisResult, ClusterDefinition, FormStructure } from "./form-structure.ts";

function makeMinimalResult(opts?: { excelBase64?: string }): AnalysisResult {
  const formStructure: FormStructure = {
    fileName: "test.xlsx",
    excelBase64: opts?.excelBase64,
    sheets: [
      {
        name: "Sheet1",
        index: 0,
        rowCount: 10,
        colCount: 5,
        rowHeights: Array(10).fill(20),
        colWidths: Array(5).fill(64),
        totalWidth: 320,
        totalHeight: 200,
        cells: [],
        pageSetup: {
          orientation: "portrait",
          paperSize: "A4",
          margins: { top: 20, bottom: 20, left: 20, right: 20 },
        },
      },
    ],
  };

  const clusters: ClusterDefinition[] = [
    {
      id: "0-0",
      name: "クラスタ1",
      type: 30,
      typeName: "KeyboardText",
      sheetNo: 0,
      cellAddress: "A1",
      region: { top: 0, bottom: 20, left: 0, right: 64 },
      confidence: 0.9,
      readOnly: false,
      inputParameters: "Required=0",
    },
  ];

  return {
    formStructure,
    clusters,
    summary: {
      totalClusters: 1,
      highConfidence: 1,
      mediumConfidence: 0,
      lowConfidence: 0,
    },
  };
}

test("buildMergedDefinitionExcelBase64: excel 未定義は空文字", async () => {
  const out = await buildMergedDefinitionExcelBase64(makeMinimalResult());
  assert.equal(out, "");
});

test("buildMergedDefinitionExcelBase64: excel 空文字は空文字", async () => {
  const out = await buildMergedDefinitionExcelBase64(makeMinimalResult({ excelBase64: "" }));
  assert.equal(out, "");
});
