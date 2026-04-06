/**
 * iReporter Excel Add-in 形式のセルコメント（LF 区切り 16 行＋任意でテーブル 9 行）を解析する。
 * @see cell-comment-spec.md
 */

/** 行0〜15 の意味づけ済みフィールド */
export type IReporterCommentCore = {
  clusterName: string;
  typeKey: string;
  clusterIndex: string;
  /** 行3: "0"=書き込み可, "1"=読み取り専用（拡張ON時のみ有効） */
  writableFlag: string;
  /** 行4: "0"=拡張なし, "1"=拡張あり */
  extensionFlag: string;
  inputParameter: string;
  /** 行6〜15 */
  remarks: [
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
    string,
  ];
};

/** 行16〜24（テーブルセル用） */
export type IReporterTableExtension = {
  tableNo: string;
  tableName: string;
  collaborationFlag: string;
  colIndex: string;
  colName: string;
  colKey: string;
  colType: string;
  rowIndex: string;
  rowName: string;
};

export type ParseIReporterCommentResult = {
  core: IReporterCommentCore;
  /** 行が 17 以上ある場合に解釈（16 行ちょううでも空行のみのときは undefined） */
  table?: IReporterTableExtension;
  warnings: string[];
};

/** Add-in WriteComment と同様の不足行補完（読み取り寛容モード） */
export function padCommentLinesTo16(lines: string[]): string[] {
  const out = lines.slice();
  while (out.length < 16) {
    const nextIndex = out.length;
    out.push(nextIndex === 3 || nextIndex === 4 ? "0" : "");
  }
  return out;
}

/** CR/LF を LF に正規化してから \n で分割 */
export function splitCommentLines(raw: string): string[] {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return normalized.split("\n");
}

/**
 * セルコメント raw 文字列を解析する。
 */
export function parseIReporterCellComment(raw: string): ParseIReporterCommentResult {
  const warnings: string[] = [];
  const parts = splitCommentLines(raw);
  const lines = padCommentLinesTo16(parts);

  const remarks: IReporterCommentCore["remarks"] = [
    lines[6] ?? "",
    lines[7] ?? "",
    lines[8] ?? "",
    lines[9] ?? "",
    lines[10] ?? "",
    lines[11] ?? "",
    lines[12] ?? "",
    lines[13] ?? "",
    lines[14] ?? "",
    lines[15] ?? "",
  ];

  const core: IReporterCommentCore = {
    clusterName: lines[0] ?? "",
    typeKey: lines[1] ?? "",
    clusterIndex: lines[2] ?? "",
    writableFlag: lines[3] ?? "0",
    extensionFlag: lines[4] ?? "0",
    inputParameter: lines[5] ?? "",
    remarks,
  };

  if (core.extensionFlag !== "1" && core.writableFlag !== "0") {
    warnings.push(
      "拡張フラグが0のため、書き込み可フラグは無視され「書き込み可」として扱われる（仕様）"
    );
  }

  let table: IReporterTableExtension | undefined;
  if (parts.length > 16) {
    const t = padTableLines(parts.slice(16));
    table = {
      tableNo: t[0] ?? "",
      tableName: t[1] ?? "",
      collaborationFlag: t[2] ?? "",
      colIndex: t[3] ?? "",
      colName: t[4] ?? "",
      colKey: t[5] ?? "",
      colType: t[6] ?? "",
      rowIndex: t[7] ?? "",
      rowName: t[8] ?? "",
    };
    const n = parseInt(table.tableNo, 10);
    if (table.tableNo.trim() !== "" && (!Number.isFinite(n) || n < 1)) {
      warnings.push(
        "TableNo は 1 以上の整数である必要がある（1 未満のセルはテーブルとして認識されない）"
      );
    }
  }

  return { core, table, warnings };
}

function padTableLines(lines: string[]): string[] {
  const out = lines.slice(0, 9);
  while (out.length < 9) out.push("");
  return out;
}
