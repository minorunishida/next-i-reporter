import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildCommentRawFromCluster,
  buildMergedCommentCatalog,
  normalizeCommentRawForWrite,
  typeKeyForIReporterComment,
} from "./cell-comment-build";
import type { ClusterDefinition, FormStructure } from "./form-structure";

describe("typeKeyForIReporterComment", () => {
  it("autoConvert 相当のマッピング", () => {
    assert.equal(typeKeyForIReporterComment("Date"), "CalendarDate");
    assert.equal(typeKeyForIReporterComment("Handwriting"), "KeyboardText");
    assert.equal(typeKeyForIReporterComment("CodeReader"), "QRCode");
    assert.equal(typeKeyForIReporterComment("KeyboardText"), "KeyboardText");
  });
});

describe("normalizeCommentRawForWrite", () => {
  it("16行・LF のみ", () => {
    const out = normalizeCommentRawForWrite("a\nb\nc");
    const lines = out.split("\n");
    assert.equal(lines.length, 16);
    assert.equal(lines[0], "a");
    assert.equal(lines[1], "b");
    assert.equal(lines[2], "c");
    assert.ok(!out.includes("\r"));
  });
});

describe("buildCommentRawFromCluster", () => {
  it("16行の Add-in 形式になる", () => {
    const c: ClusterDefinition = {
      id: "1",
      name: "氏名",
      type: 30,
      typeName: "KeyboardText",
      sheetNo: 0,
      cellAddress: "B2",
      region: { top: 0, bottom: 1, left: 0, right: 1 },
      confidence: 0.9,
      readOnly: false,
      inputParameters: "Required=0",
    };
    const raw = buildCommentRawFromCluster(c, 0);
    const lines = raw.split("\n");
    assert.equal(lines.length, 16);
    assert.equal(lines[0], "氏名");
    assert.equal(lines[1], "KeyboardText");
    assert.equal(lines[2], "0");
  });
});

describe("buildMergedCommentCatalog", () => {
  it("クラスタのみでセルにコメント本文が付くエントリができる", () => {
    const form: FormStructure = {
      fileName: "t.xlsx",
      sheets: [
        {
          name: "Sheet1",
          index: 0,
          rowCount: 5,
          colCount: 5,
          rowHeights: [20, 20, 20, 20, 20],
          colWidths: [64, 64, 64, 64, 64],
          totalWidth: 320,
          totalHeight: 100,
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
        id: "x",
        name: "項目",
        type: 30,
        typeName: "KeyboardText",
        sheetNo: 0,
        cellAddress: "C3",
        region: { top: 0, bottom: 20, left: 0, right: 64 },
        confidence: 0.9,
        readOnly: false,
        inputParameters: "",
      },
    ];
    const cat = buildMergedCommentCatalog(form, clusters);
    assert.equal(cat.entries.length, 1);
    assert.equal(cat.entries[0]!.cell, "C3");
    assert.ok(cat.entries[0]!.commentRaw.includes("KeyboardText"));
    assert.equal(cat.entries[0]!.commentRaw.split("\n").length, 16);
  });
});
