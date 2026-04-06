import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  padCommentLinesTo16,
  parseIReporterCellComment,
  splitCommentLines,
} from "./cell-comment-parse";

describe("splitCommentLines", () => {
  it("CRLF と単独 CR を LF 相当の行分割に正規化する", () => {
    const raw = "a\r\nb\rc";
    const lines = splitCommentLines(raw);
    assert.deepEqual(lines, ["a", "b", "c"]);
  });
});

describe("padCommentLinesTo16", () => {
  it("不足行は行3・4のみ 0 で埋める（Add-in WriteComment 相当）", () => {
    const short = ["a", "b", "c"];
    const padded = padCommentLinesTo16(short);
    assert.equal(padded.length, 16);
    assert.equal(padded[0], "a");
    assert.equal(padded[1], "b");
    assert.equal(padded[2], "c");
    assert.equal(padded[3], "0");
    assert.equal(padded[4], "0");
    assert.equal(padded[5], "");
  });
});

describe("parseIReporterCellComment", () => {
  it("仕様の最小テキスト例（氏名 KeyboardText）を解釈する", () => {
    const raw = [
      "氏名",
      "KeyboardText",
      "0",
      "0",
      "0",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
    ].join("\n");
    const r = parseIReporterCellComment(raw);
    assert.equal(r.core.clusterName, "氏名");
    assert.equal(r.core.typeKey, "KeyboardText");
    assert.equal(r.core.clusterIndex, "0");
    assert.equal(r.core.writableFlag, "0");
    assert.equal(r.core.extensionFlag, "0");
    assert.equal(r.table, undefined);
    assert.ok(r.warnings.length === 0);
  });

  it("拡張0かつ書き込み1のとき警告を出す", () => {
    const lines = Array(16).fill("");
    lines[0] = "x";
    lines[1] = "KeyboardText";
    lines[3] = "1";
    lines[4] = "0";
    const r = parseIReporterCellComment(lines.join("\n"));
    assert.ok(r.warnings.some((w) => w.includes("拡張フラグ")));
  });

  it("テーブル行16以降を解釈する", () => {
    const base = Array(16).fill("");
    base[0] = "数量";
    base[1] = "InputNumeric";
    const table = ["1", "受注表", "0", "", "数量", "QTY", "numeric", "", "製品A"];
    const raw = [...base, ...table].join("\n");
    const r = parseIReporterCellComment(raw);
    assert.ok(r.table);
    assert.equal(r.table!.tableNo, "1");
    assert.equal(r.table!.tableName, "受注表");
    assert.equal(r.table!.colName, "数量");
    assert.equal(r.table!.rowName, "製品A");
  });

  it("TableNo が 0 のとき警告する", () => {
    const base = Array(16).fill("");
    const table = ["0", "T", "0", "", "", "", "numeric", "", ""];
    const raw = [...base, ...table].join("\n");
    const r = parseIReporterCellComment(raw);
    assert.ok(r.warnings.some((w) => w.includes("TableNo")));
  });
});
