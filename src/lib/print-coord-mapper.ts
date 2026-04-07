/**
 * クラスターの Excel px 座標 → PDF ページ上の 0-1 座標への変換
 *
 * printMeta の rows[]/columns[] (Excel COM の正確な pt 値) を使い、
 * excel-parser の px 座標から pt 座標への補間マッピングを行う。
 */

import type { SheetStructure, PrintMeta } from "./form-structure";

// Logger interface (duplicated to avoid importing logger.ts in client bundle)
type LogFn = (message: string, data?: Record<string, unknown>) => void;
type SimpleLogger = { debug: LogFn; info: LogFn; warn: LogFn; error: LogFn };

// Lazy-load logger only on server side to avoid bundling node:fs in browser
let _log: SimpleLogger | null = null;
let _logChecked = false;
function getLog(): SimpleLogger | null {
  if (_logChecked) return _log;
  _logChecked = true;
  if (typeof window !== "undefined") return null;
  try {
    // Dynamic path that webpack cannot statically analyze
    const modulePath = "./logger";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(/* webpackIgnore: true */ modulePath);
    _log = mod.createLogger("print-coord-mapper");
  } catch { /* ignore */ }
  return _log;
}

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

  // 座標監査証跡 — サーバーサイドのみ構造化ログ出力
  const log = getLog();
  if (log) {
    // pt → mm 変換 (1pt = 25.4/72 mm)
    const ptToMm = (pt: number) => +(pt * 25.4 / 72).toFixed(2);
    const pdfToMm = (norm: number, pagePt: number) => +(norm * pagePt * 25.4 / 72).toFixed(2);

    log.debug("Coordinate mapping", {
      regionPx: { top: +region.top.toFixed(1), bottom: +region.bottom.toFixed(1), left: +region.left.toFixed(1), right: +region.right.toFixed(1) },
      ptRegion: { top: +ptTop.toFixed(2), bottom: +ptBottom.toFixed(2), left: +ptLeft.toFixed(2), right: +ptRight.toFixed(2) },
      relative: { top: +relTop.toFixed(4), bottom: +relBottom.toFixed(4), left: +relLeft.toFixed(4), right: +relRight.toFixed(4) },
      pdfNormalized: { top: +result.top.toFixed(4), bottom: +result.bottom.toFixed(4), left: +result.left.toFixed(4), right: +result.right.toFixed(4) },
      mmOnPaper: {
        top: pdfToMm(result.top, pageH),
        bottom: pdfToMm(result.bottom, pageH),
        left: pdfToMm(result.left, pageW),
        right: pdfToMm(result.right, pageW),
      },
      anchorPoints: { rows: rowPairs.length, cols: colPairs.length },
    });
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
