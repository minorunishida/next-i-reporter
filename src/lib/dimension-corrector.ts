import type { SheetStructure, PrintMeta } from "./form-structure";

/**
 * printMeta の正確な pt データを使って、SheetJS の不正確な colWidths/rowHeights を補正する。
 * pt 値をそのまま px として使用（1pt ≈ 1.333px だが、座標マッパーが px→pt 補間するため
 * px 値の相対的な比率が正確であれば問題ない）。
 *
 * 実質的に: colWidths[i] = printMeta.columns[i].width (pt) を px 単位として扱う。
 * これにより補間マッパーの px 側と pt 側が同じ比率になり、補間が恒等変換に近づく。
 */
export function correctDimensionsFromPrintMeta(sheet: SheetStructure, meta: PrintMeta) {
  // 行高さの補正
  if (meta.rows.length > 0) {
    const maxRow = meta.rows[meta.rows.length - 1].row; // 1-based
    const newRowHeights: number[] = new Array(maxRow).fill(15); // default pt
    for (let i = 0; i < sheet.rowHeights.length && i < maxRow; i++) {
      newRowHeights[i] = sheet.rowHeights[i];
    }
    for (const r of meta.rows) {
      const idx = r.row - 1;
      if (idx >= 0 && idx < maxRow) {
        newRowHeights[idx] = r.height;
      }
    }
    sheet.rowHeights = newRowHeights;
    sheet.rowCount = Math.max(sheet.rowCount, maxRow);
  }

  // 列幅の補正
  if (meta.columns.length > 0) {
    const maxCol = meta.columns[meta.columns.length - 1].col; // 1-based
    const newColWidths: number[] = new Array(maxCol).fill(12); // default pt
    for (let i = 0; i < sheet.colWidths.length && i < maxCol; i++) {
      newColWidths[i] = sheet.colWidths[i];
    }
    for (const c of meta.columns) {
      const idx = c.col - 1;
      if (idx >= 0 && idx < maxCol) {
        newColWidths[idx] = c.width;
      }
    }
    sheet.colWidths = newColWidths;
    sheet.colCount = Math.max(sheet.colCount, maxCol);
  }

  // totalWidth/totalHeight を再計算
  sheet.totalWidth = sheet.colWidths.reduce((a, b) => a + b, 0);
  sheet.totalHeight = sheet.rowHeights.reduce((a, b) => a + b, 0);

  // セルの region 座標を再計算
  const rowTops = [0];
  for (let i = 0; i < sheet.rowHeights.length; i++) {
    rowTops.push(rowTops[i] + sheet.rowHeights[i]);
  }
  const colLefts = [0];
  for (let i = 0; i < sheet.colWidths.length; i++) {
    colLefts.push(colLefts[i] + sheet.colWidths[i]);
  }

  for (const cell of sheet.cells) {
    const endRow = cell.mergeRange ? cell.mergeRange.endRow : cell.row;
    const endCol = cell.mergeRange ? cell.mergeRange.endCol : cell.col;
    cell.region = {
      top: rowTops[cell.row] ?? 0,
      bottom: rowTops[endRow + 1] ?? rowTops[endRow] ?? 0,
      left: colLefts[cell.col] ?? 0,
      right: colLefts[endCol + 1] ?? colLefts[endCol] ?? 0,
    };
  }
}
