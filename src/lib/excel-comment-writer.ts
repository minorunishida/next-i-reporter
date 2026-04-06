import { buildCellCommentCatalog } from "./cell-comment-catalog";
import { injectCommentsIntoXlsxBuffer, type ZipCommentUpdate } from "./excel-comment-zip";
import { parseExcel } from "./excel-parser";
import type { CellCommentCatalog } from "./form-structure";

/** 既存 xlsx にセルコメントを付与する（ZIP 内 comments のみ更新） */
export type CellCommentUpdate = ZipCommentUpdate;

export const MAX_COMMENT_CELLS = 1000;

/**
 * カタログが空でも、埋め込み xlsx を再パースしてコメント付きセルを検出する（XML インポート等でカタログ欠落した場合の救済）。
 * パースには SheetJS read のみ使用（バイナリは書き換えない）。
 */
function resolveCatalogForMerge(
  excelBase64: string,
  fileName: string,
  catalog: CellCommentCatalog | undefined,
): CellCommentCatalog | undefined {
  if (catalog?.entries?.length) return catalog;
  if (!excelBase64) return undefined;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "xlsx") return undefined;
  try {
    const buf = Buffer.from(excelBase64, "base64");
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    const parsed = parseExcel(ab, fileName);
    const built = buildCellCommentCatalog(parsed);
    return built.entries.length > 0 ? built : undefined;
  } catch {
    return undefined;
  }
}

/**
 * definitionFile 用 Base64 に、パース済みカタログのコメント本文を反映する（.xlsx のみ）。
 * OOXML の comments パーツのみ差し替え、ブック全体の再シリアル化は行わない。
 */
export async function mergeCellCommentsIntoExcelBase64(
  excelBase64: string,
  fileName: string,
  catalog: CellCommentCatalog | undefined,
): Promise<string> {
  const effective = resolveCatalogForMerge(excelBase64, fileName, catalog);
  if (!excelBase64 || !effective?.entries?.length) return excelBase64;
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext !== "xlsx") return excelBase64;

  const updates: CellCommentUpdate[] = effective.entries
    .slice(0, MAX_COMMENT_CELLS)
    .map((e) => ({
      sheetName: e.sheetName,
      sheetIndex: e.sheetIndex,
      address: e.cell,
      text: e.commentRaw,
    }));

  const buf = Buffer.from(excelBase64, "base64");
  const out = await injectCommentsIntoXlsxBuffer(buf, updates);
  return out.toString("base64");
}
