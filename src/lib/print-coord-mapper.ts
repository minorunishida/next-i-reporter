/**
 * クラスタの Excel px 座標 → PDF ページ上の 0-1 座標への変換
 */

import type { SheetStructure, PrintMeta } from "./form-structure";

export type PdfRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * シートの rowHeights/colWidths から printArea の px 範囲を算出
 */
export function computePrintAreaPx(
  sheet: SheetStructure,
  printMeta: PrintMeta
): { left: number; top: number; width: number; height: number } {
  const pa = printMeta.printArea ?? printMeta.usedRange;

  // 累積和を計算 (0-based index)
  const rowTops = cumulativeSum(sheet.rowHeights);
  const colLefts = cumulativeSum(sheet.colWidths);

  // printMeta の startRow/startCol は 1-based
  const startRow = pa.startRow - 1;
  const startCol = pa.startCol - 1;
  const endRow = pa.endRow; // endRow is inclusive, so rowTops[endRow] = bottom of last row
  const endCol = pa.endCol;

  const top = rowTops[startRow] ?? 0;
  const left = colLefts[startCol] ?? 0;
  const bottom = rowTops[endRow] ?? rowTops[rowTops.length - 1] ?? 0;
  const right = colLefts[endCol] ?? colLefts[colLefts.length - 1] ?? 0;

  return {
    left,
    top,
    width: right - left,
    height: bottom - top,
  };
}

/**
 * PDF ページ上のコンテンツ領域とスケールを算出
 */
export function computePdfContentArea(printMeta: PrintMeta): {
  left: number;   // pt
  top: number;    // pt
  width: number;  // pt (printArea が占める描画幅)
  height: number; // pt (printArea が占める描画高さ)
  scale: number;
} {
  const pa = printMeta.printArea ?? printMeta.usedRange;
  const contentW = printMeta.pdfPageWidthPt - printMeta.margins.left - printMeta.margins.right;
  const contentH = printMeta.pdfPageHeightPt - printMeta.margins.top - printMeta.margins.bottom;

  // fit-to-page のスケール算出
  let scale: number;
  if (printMeta.zoom != null) {
    scale = printMeta.zoom / 100;
  } else if (printMeta.fitToPagesWide != null || printMeta.fitToPagesTall != null) {
    const scaleX = pa.width > 0 ? contentW / pa.width : 1;
    const scaleY = pa.height > 0 ? contentH / pa.height : 1;
    scale = Math.min(scaleX, scaleY);
  } else {
    scale = 1;
  }

  const renderedW = pa.width * scale;
  const renderedH = pa.height * scale;

  return {
    left: printMeta.margins.left,
    top: printMeta.margins.top,
    width: renderedW,
    height: renderedH,
    scale,
  };
}

/**
 * クラスタの Excel px 座標 → PDF ページ上の 0-1 座標に変換
 *
 * @returns 0-1 の範囲の PdfRect、印刷範囲外の場合は null
 */
export function mapClusterRegionToPdf(
  region: PdfRect,
  sheet: SheetStructure,
  printMeta: PrintMeta
): PdfRect | null {
  const paPx = computePrintAreaPx(sheet, printMeta);
  const content = computePdfContentArea(printMeta);

  if (paPx.width <= 0 || paPx.height <= 0) return null;

  // クラスタの printArea 内の相対位置 (0-1)
  const relLeft = (region.left - paPx.left) / paPx.width;
  const relRight = (region.right - paPx.left) / paPx.width;
  const relTop = (region.top - paPx.top) / paPx.height;
  const relBottom = (region.bottom - paPx.top) / paPx.height;

  // PDF ページ上の位置 (0-1)
  const pageW = printMeta.pdfPageWidthPt;
  const pageH = printMeta.pdfPageHeightPt;

  return {
    left: (content.left + relLeft * content.width) / pageW,
    right: (content.left + relRight * content.width) / pageW,
    top: (content.top + relTop * content.height) / pageH,
    bottom: (content.top + relBottom * content.height) / pageH,
  };
}

function cumulativeSum(arr: number[]): number[] {
  const result = [0];
  for (let i = 0; i < arr.length; i++) {
    result.push(result[i] + arr[i]);
  }
  return result;
}
