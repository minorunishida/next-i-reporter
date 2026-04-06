/**
 * iReporter Add-in 形式のセルコメントを生成・正規化する（cell-comment-spec.md）
 */
import * as XLSX from "xlsx";
import { buildCellCommentCatalog } from "./cell-comment-catalog";
import {
  padCommentLinesTo16,
  parseIReporterCellComment,
  splitCommentLines,
} from "./cell-comment-parse";
import type {
  CellCommentCatalog,
  CellCommentCatalogEntry,
  ClusterDefinition,
  FormStructure,
} from "./form-structure";

/** Add-in ApplicationConfig autoConvert に合わせた種別キー（Win 互換・仕様 §デバイスによる自動変換） */
export function typeKeyForIReporterComment(typeName: string): string {
  switch (typeName) {
    case "Handwriting":
      return "KeyboardText";
    case "Date":
      return "CalendarDate";
    case "CodeReader":
      return "QRCode";
    default:
      return typeName;
  }
}

/** 書き込み用: LF のみ・最低16行（仕様 §区切り・WriteComment 補完） */
export function normalizeCommentRawForWrite(raw: string): string {
  const lines = padCommentLinesTo16(splitCommentLines(raw.trim()));
  return lines.join("\n");
}

/**
 * AI クラスタ1件から 16 行コメント本文を生成する。
 * 行3/4: readOnly のとき拡張ON＋読み取り専用、それ以外は拡張OFF（仕様 §行3・§行4）
 */
export function buildCommentRawFromCluster(
  cluster: ClusterDefinition,
  clusterIndexInType: number
): string {
  const typeKey = typeKeyForIReporterComment(cluster.typeName);
  const extensionFlag = cluster.readOnly ? "1" : "0";
  const writableFlag = cluster.readOnly ? "1" : "0";
  const lines: string[] = [
    cluster.name ?? "",
    typeKey,
    String(clusterIndexInType),
    writableFlag,
    extensionFlag,
    cluster.inputParameters ?? "",
    "", "", "", "", "", "", "", "", "", "",
  ];
  return padCommentLinesTo16(lines).join("\n");
}

function normalizeCellAddr(addr: string): string {
  return addr.replace(/\$/g, "").split(":")[0]?.trim() ?? "";
}

function compareCellAddr(a: string, b: string): number {
  const da = XLSX.utils.decode_cell(normalizeCellAddr(a) || "A1");
  const db = XLSX.utils.decode_cell(normalizeCellAddr(b) || "A1");
  if (da.r !== db.r) return da.r - db.r;
  return da.c - db.c;
}

function catalogKey(sheetName: string, cell: string): string {
  return `${sheetName}\u0000${normalizeCellAddr(cell)}`;
}

/**
 * Excel 由来のコメント（正規化）に、コメント欠落セルのクラスタから Add-in 形式を合成する。
 * 同一セルでは Excel 側のコメントを優先（cell-comment-integration-issues.md A案: Excel を正）。
 */
export function buildMergedCommentCatalog(
  form: FormStructure,
  clusters: ClusterDefinition[]
): CellCommentCatalog {
  const fromExcel = buildCellCommentCatalog(form);
  const map = new Map<string, CellCommentCatalogEntry>();

  for (const e of fromExcel.entries) {
    const key = catalogKey(e.sheetName, e.cell);
    const norm = normalizeCommentRawForWrite(e.commentRaw);
    map.set(key, {
      ...e,
      commentRaw: norm,
      parsed: parseIReporterCellComment(norm),
    });
  }

  const byGroup = new Map<string, ClusterDefinition[]>();
  for (const c of clusters) {
    const sheet = form.sheets[c.sheetNo];
    if (!sheet) continue;
    const addr = normalizeCellAddr(c.cellAddress);
    if (!addr || !/^[A-Za-z]+\d+$/.test(addr)) continue;
    // 仕様: 同一シート・同一種別キー（Add-in 上のキー）で連番
    const gk = `${c.sheetNo}\t${typeKeyForIReporterComment(c.typeName)}`;
    if (!byGroup.has(gk)) byGroup.set(gk, []);
    byGroup.get(gk)!.push(c);
  }
  for (const arr of byGroup.values()) {
    arr.sort((a, b) => compareCellAddr(a.cellAddress, b.cellAddress));
  }
  const indexInType = new Map<string, number>();
  for (const arr of byGroup.values()) {
    arr.forEach((c, i) => indexInType.set(c.id, i));
  }

  for (const c of clusters) {
    const sheet = form.sheets[c.sheetNo];
    if (!sheet) continue;
    const addr = normalizeCellAddr(c.cellAddress);
    if (!addr || !/^[A-Za-z]+\d+$/.test(addr)) continue;
    const key = catalogKey(sheet.name, addr);
    if (map.has(key)) continue;

    const idx = indexInType.get(c.id) ?? 0;
    const raw = buildCommentRawFromCluster(c, idx);
    const decoded = XLSX.utils.decode_cell(addr);
    map.set(key, {
      sheetName: sheet.name,
      sheetIndex: sheet.index,
      cell: addr,
      row: decoded.r,
      col: decoded.c,
      commentRaw: raw,
      parsed: parseIReporterCellComment(raw),
    });
  }

  return {
    lastGeneratedAt: new Date().toISOString(),
    entries: [...map.values()],
  };
}
