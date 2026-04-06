import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as XLSX from "xlsx";
import { normalizeCommentRawForWrite } from "./cell-comment-build";
import { extractCellCommentRaw } from "./excel-parser";
import { injectCommentsIntoXlsxBuffer, MAX_ZIP_COMMENT_CELLS } from "./excel-comment-zip";
import { mergeCellCommentsIntoExcelBase64 } from "./excel-comment-writer";
import { parseIReporterCellComment } from "./cell-comment-parse";
import type { CellCommentCatalog } from "./form-structure";

/** テスト用の空 xlsx（ここだけ SheetJS write — 本番の definitionFile 経路では使わない） */
function emptyXlsxBuffer(): Buffer {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([[""]]);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const w = XLSX.write(wb, { type: "array", bookType: "xlsx" });
  const u8 = w instanceof Uint8Array ? w : new Uint8Array(w as ArrayBuffer);
  return Buffer.from(u8);
}

describe("injectCommentsIntoXlsxBuffer (ZIP のみ)", () => {
  it("シート名が一致しなくても sheetIndex でコメントを付けられる", async () => {
    const buf = emptyXlsxBuffer();
    const text = "a\nKeyboardText\n0\n0\n0\n";
    const expectedStored = normalizeCommentRawForWrite(text);
    const out = await injectCommentsIntoXlsxBuffer(buf, [
      {
        sheetName: "名前のミスマッチ",
        sheetIndex: 0,
        address: "B2",
        text,
      },
    ]);
    const wb2 = XLSX.read(out, { type: "buffer" });
    const raw = extractCellCommentRaw(wb2.Sheets["Sheet1"]!["B2"] as XLSX.CellObject);
    assert.equal(raw, expectedStored);
  });

  it("comments パーツにコメントを書き、読み戻せる", async () => {
    const buf = emptyXlsxBuffer();
    const text = "氏名\nKeyboardText\n0\n0\n0\n";
    const expectedStored = normalizeCommentRawForWrite(text);
    const out = await injectCommentsIntoXlsxBuffer(buf, [
      { sheetName: "Sheet1", address: "A1", text },
    ]);

    const wb2 = XLSX.read(out, { type: "buffer" });
    const ws2 = wb2.Sheets["Sheet1"];
    assert.ok(ws2);
    const raw = extractCellCommentRaw(ws2!["A1"] as XLSX.CellObject);
    assert.equal(raw, expectedStored);
  });

  it(`${MAX_ZIP_COMMENT_CELLS + 1} 件で例外`, async () => {
    const buf = emptyXlsxBuffer();
    const updates = Array.from({ length: MAX_ZIP_COMMENT_CELLS + 1 }, (_, i) => ({
      sheetName: "Sheet1",
      address: `A${i + 1}`,
      text: "x",
    }));
    await assert.rejects(
      () => injectCommentsIntoXlsxBuffer(buf, updates),
      /最大/,
    );
  });
});

describe("mergeCellCommentsIntoExcelBase64", () => {
  it("Base64 往復でカタログのコメントが埋め込まれる", async () => {
    const b64 = emptyXlsxBuffer().toString("base64");

    const text = "項目\nKeyboardText\n0\n0\n0\n";
    const expectedStored = normalizeCommentRawForWrite(text);
    const catalog: CellCommentCatalog = {
      lastGeneratedAt: "",
      entries: [
        {
          sheetName: "Sheet1",
          sheetIndex: 0,
          cell: "A1",
          row: 0,
          col: 0,
          commentRaw: text,
          parsed: parseIReporterCellComment(text),
        },
      ],
    };

    const outB64 = await mergeCellCommentsIntoExcelBase64(b64, "book.xlsx", catalog);
    const outBuf = Buffer.from(outB64, "base64");
    const wb2 = XLSX.read(outBuf, { type: "buffer" });
    const raw = extractCellCommentRaw(wb2.Sheets["Sheet1"]!["A1"] as XLSX.CellObject);
    assert.equal(raw, expectedStored);
  });

  it("カタログが空なら入力 Base64 をそのまま返す", async () => {
    const b64 = Buffer.from("hello").toString("base64");
    assert.equal(
      await mergeCellCommentsIntoExcelBase64(b64, "a.xlsx", undefined),
      b64,
    );
  });

  it("カタログ欠落時は xlsx を再パースしてコメントを書き戻す", async () => {
    const buf = emptyXlsxBuffer();
    const text = "再パース\nKeyboardText\n0\n0\n0\n";
    const expectedStored = normalizeCommentRawForWrite(text);
    const withComment = await injectCommentsIntoXlsxBuffer(buf, [
      { sheetName: "Sheet1", address: "A1", text },
    ]);
    const b64 = withComment.toString("base64");

    const outB64 = await mergeCellCommentsIntoExcelBase64(b64, "c.xlsx", undefined);
    const wb2 = XLSX.read(Buffer.from(outB64, "base64"), { type: "buffer" });
    const raw = extractCellCommentRaw(wb2.Sheets["Sheet1"]!["A1"] as XLSX.CellObject);
    assert.equal(raw, expectedStored);
  });
});
