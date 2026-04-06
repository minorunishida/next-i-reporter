import type { CellCommentCatalog, CellCommentCatalogEntry, FormStructure } from "./form-structure";
import { parseIReporterCellComment } from "./cell-comment-parse";

/**
 * FormStructure から、コメント付きセルのみを抽出してパース済みカタログを生成する。
 * Excel を正とし、手入力カタログを作らない（課題ドキュメント B案の自動生成）。
 */
export function buildCellCommentCatalog(form: FormStructure): CellCommentCatalog {
  const entries: CellCommentCatalogEntry[] = [];
  const lastGeneratedAt = new Date().toISOString();

  for (const sheet of form.sheets) {
    for (const cell of sheet.cells) {
      const raw = cell.commentRaw?.trim();
      if (!raw) continue;
      entries.push({
        sheetName: sheet.name,
        sheetIndex: sheet.index,
        cell: cell.address,
        row: cell.row,
        col: cell.col,
        commentRaw: cell.commentRaw!,
        parsed: parseIReporterCellComment(cell.commentRaw!),
      });
    }
  }

  return { lastGeneratedAt, entries };
}
