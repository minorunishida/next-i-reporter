/**
 * クラスターの Excel px 座標 → PDF ページ上の 0-1 座標への変換
 *
 * printMeta の rows[]/columns[] (Excel COM の正確な pt 値) を使い、
 * excel-parser の px 座標から pt 座標への補間マッピングを行う。
 */

import type { SheetStructure, PrintMeta } from "./form-structure";

export type PdfRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * シートの印刷範囲を px 座標で計算する。
 * printMeta.printArea が未定義の場合は usedRange にフォールバック。
 */
export function computePrintAreaPx(
  sheet: SheetStructure,
  printMeta: PrintMeta
): { left: number; top: number; width: number; height: number } {
  const pa = printMeta.printArea ?? printMeta.usedRange;
  const rowTops = cumulativeSum(sheet.rowHeights);
  const colLefts = cumulativeSum(sheet.colWidths);
  const startRow = pa.startRow - 1;
  const startCol = pa.startCol - 1;
  const top = rowTops[startRow] ?? 0;
  const left = colLefts[startCol] ?? 0;
  const bottom = rowTops[pa.endRow] ?? rowTops[rowTops.length - 1] ?? 0;
  const right = colLefts[pa.endCol] ?? colLefts[colLefts.length - 1] ?? 0;
  return { left, top, width: right - left, height: bottom - top };
}

/**
 * PDF ページ上のコンテンツ描画領域を計算する。
 * zoom / fitToPage / デフォルトの3パターンでスケールを決定。
 * @returns left/top (pt), width/height (pt), scale
 */
export function computePdfContentArea(printMeta: PrintMeta): {
  left: number;
  top: number;
  width: number;
  height: number;
  scale: number;
} {
  const pa = printMeta.printArea ?? printMeta.usedRange;
  const contentW = printMeta.pdfPageWidthPt - printMeta.margins.left - printMeta.margins.right;
  const contentH = printMeta.pdfPageHeightPt - printMeta.margins.top - printMeta.margins.bottom;

  let scale: number;
  if (printMeta.zoom != null) {
    scale = printMeta.zoom / 100;
  } else if (printMeta.fitToPagesWide != null || printMeta.fitToPagesTall != null) {
    const scaleX = pa.width > 0 ? contentW / pa.width : 1;
    const scaleY = pa.height > 0 ? contentH / pa.height : 1;
    // Excel の fitToPage は拡大しない（1.0 が上限）
    scale = Math.min(scaleX, scaleY, 1.0);
  } else {
    scale = 1;
  }

  const renderedW = pa.width * scale;
  const renderedH = pa.height * scale;

  // fit-to-page で余白がある場合、Excel はコンテンツを水平中央揃えする
  const offsetX = (contentW - renderedW) / 2;

  return {
    left: printMeta.margins.left + offsetX,
    top: printMeta.margins.top,
    width: renderedW,
    height: renderedH,
    scale,
  };
}

/**
 * px→pt 補間マッパー
 *
 * 行/列の境界位置を (px, pt) のペアとして登録し、
 * 任意の px 値を線形補間で pt に変換する。
 */
export type PxPtPair = { px: number; pt: number };

export function interpolate(points: PxPtPair[], px: number): number {
  if (points.length === 0) return px;
  if (points.length === 1) return points[0].pt;

  // 範囲外は線形外挿
  if (px <= points[0].px) {
    const r = safeDivide(points[1].pt - points[0].pt, points[1].px - points[0].px, 1);
    return points[0].pt + (px - points[0].px) * r;
  }
  const last = points.length - 1;
  if (px >= points[last].px) {
    const r = safeDivide(points[last].pt - points[last - 1].pt, points[last].px - points[last - 1].px, 1);
    return points[last].pt + (px - points[last].px) * r;
  }

  // 二分探索 + 線形補間
  let lo = 0, hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].px <= px) lo = mid;
    else hi = mid;
  }
  const a = points[lo], b = points[hi];
  const t = safeDivide(px - a.px, b.px - a.px, 0);
  return a.pt + t * (b.pt - a.pt);
}

export function safeDivide(num: number, den: number, fallback: number): number {
  return den !== 0 ? num / den : fallback;
}

/**
 * クラスターの Excel px 座標 → PDF ページ上の 0-1 座標に変換
 */
export function mapClusterRegionToPdf(
  region: PdfRect,
  sheet: SheetStructure,
  printMeta: PrintMeta
): PdfRect | null {
  const pa = printMeta.printArea ?? printMeta.usedRange;
  const content = computePdfContentArea(printMeta);

  if (pa.width <= 0 || pa.height <= 0) return null;

  // SheetJS の colWidths/rowHeights は近似値で、列幅が取得できず
  // DEFAULT (64px) になることが多い。printMeta は正確な pt 値を持つ。
  //
  // 戦略: printMeta の rows/columns をもとに、行/列番号で px↔pt を対応づける。
  // SheetJS の px 累積和が不正確でも、行/列番号ベースで正しくマッピングする。

  const rowTopsPx = cumulativeSum(sheet.rowHeights);
  const colLeftsPx = cumulativeSum(sheet.colWidths);

  // 行の (px, pt) ペアを構築
  const rowPairs: PxPtPair[] = [];
  for (const r of printMeta.rows) {
    const idx0 = r.row - 1;
    const px = idx0 < rowTopsPx.length ? rowTopsPx[idx0] : extrapolatePx(rowTopsPx, idx0);
    rowPairs.push({ px, pt: r.top });
  }
  if (printMeta.rows.length > 0) {
    const last = printMeta.rows[printMeta.rows.length - 1];
    const idx0 = last.row - 1;
    const px = idx0 + 1 < rowTopsPx.length ? rowTopsPx[idx0 + 1] : extrapolatePx(rowTopsPx, idx0 + 1);
    rowPairs.push({ px, pt: last.top + last.height });
  }

  // 列の (px, pt) ペアを構築
  const colPairs: PxPtPair[] = [];
  for (const c of printMeta.columns) {
    const idx0 = c.col - 1;
    const px = idx0 < colLeftsPx.length ? colLeftsPx[idx0] : extrapolatePx(colLeftsPx, idx0);
    colPairs.push({ px, pt: c.left });
  }
  if (printMeta.columns.length > 0) {
    const last = printMeta.columns[printMeta.columns.length - 1];
    const idx0 = last.col - 1;
    const px = idx0 + 1 < colLeftsPx.length ? colLeftsPx[idx0 + 1] : extrapolatePx(colLeftsPx, idx0 + 1);
    colPairs.push({ px, pt: last.left + last.width });
  }

  // px → pt 補間
  const ptTop = interpolate(rowPairs, region.top);
  const ptBottom = interpolate(rowPairs, region.bottom);
  const ptLeft = interpolate(colPairs, region.left);
  const ptRight = interpolate(colPairs, region.right);

  // printArea 内の相対位置 (pt ベース)
  const relTop = (ptTop - pa.top) / pa.height;
  const relBottom = (ptBottom - pa.top) / pa.height;
  const relLeft = (ptLeft - pa.left) / pa.width;
  const relRight = (ptRight - pa.left) / pa.width;

  // PDF ページ上の 0-1 座標
  const pageW = printMeta.pdfPageWidthPt;
  const pageH = printMeta.pdfPageHeightPt;

  const result = {
    left: (content.left + relLeft * content.width) / pageW,
    right: (content.left + relRight * content.width) / pageW,
    top: (content.top + relTop * content.height) / pageH,
    bottom: (content.top + relBottom * content.height) / pageH,
  };

  // デバッグ出力 (最初の3クラスターのみ、数値展開済み)
  if (typeof window !== "undefined") {
    if (!(window as any).__pdfMapDebugCount) (window as any).__pdfMapDebugCount = 0;
    if ((window as any).__pdfMapDebugCount < 3) {
      (window as any).__pdfMapDebugCount++;
      const n = (v: number) => Math.round(v * 10000) / 10000;
      console.log(`[coord-mapper] #${(window as any).__pdfMapDebugCount} region(px): T=${n(region.top)} B=${n(region.bottom)} L=${n(region.left)} R=${n(region.right)}`);
      console.log(`  → pt: T=${n(ptTop)} B=${n(ptBottom)} L=${n(ptLeft)} R=${n(ptRight)}`);
      console.log(`  printArea: T=${pa.top} L=${pa.left} W=${pa.width} H=${pa.height}`);
      console.log(`  relative: T=${n(relTop)} B=${n(relBottom)} L=${n(relLeft)} R=${n(relRight)}`);
      console.log(`  content: L=${n(content.left)} T=${n(content.top)} W=${n(content.width)} H=${n(content.height)} scale=${n(content.scale)}`);
      console.log(`  margins: T=${printMeta.margins.top} B=${printMeta.margins.bottom} L=${printMeta.margins.left} R=${printMeta.margins.right} header=${printMeta.margins.header} footer=${printMeta.margins.footer}`);
      console.log(`  contentArea: W=${n(printMeta.pdfPageWidthPt - printMeta.margins.left - printMeta.margins.right)} H=${n(printMeta.pdfPageHeightPt - printMeta.margins.top - printMeta.margins.bottom)}`);
      console.log(`  scaleX=${n((printMeta.pdfPageWidthPt - printMeta.margins.left - printMeta.margins.right) / pa.width)} scaleY=${n((printMeta.pdfPageHeightPt - printMeta.margins.top - printMeta.margins.bottom) / pa.height)}`);
      console.log(`  page: ${pageW} x ${pageH}`);
      console.log(`  result: T=${n(result.top)} B=${n(result.bottom)} L=${n(result.left)} R=${n(result.right)}`);
      console.log(`  colPairs[0..2]:`, colPairs.slice(0, 3).map(p => `px=${n(p.px)}→pt=${n(p.pt)}`).join(", "));
      console.log(`  colPairs[-2..]:`, colPairs.slice(-2).map(p => `px=${n(p.px)}→pt=${n(p.pt)}`).join(", "));
    }
  }

  return result;
}

/**
 * px 累積配列の範囲外のインデックスに対して、最後の要素幅で外挿
 */
export function extrapolatePx(cumulative: number[], idx: number): number {
  if (cumulative.length < 2) return idx * 64; // 完全フォールバック
  const lastIdx = cumulative.length - 1;
  const lastWidth = cumulative[lastIdx] - cumulative[lastIdx - 1];
  return cumulative[lastIdx] + lastWidth * (idx - lastIdx);
}

export function cumulativeSum(arr: number[]): number[] {
  const result = [0];
  for (let i = 0; i < arr.length; i++) {
    result.push(result[i] + arr[i]);
  }
  return result;
}
