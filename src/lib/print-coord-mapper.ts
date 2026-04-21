/**
 * クラスターの Excel px 座標 → PDF ページ上の 0-1 座標への変換
 *
 * printMeta の rows[]/columns[] (Excel COM の正確な pt 値) を使い、
 * excel-parser の px 座標から pt 座標への補間マッピングを行う。
 *
 * 既定では `cellAddress` が解決できる場合、行列入力の pt 境界を直参照し
 * px 補間誤差を抑える（IREPORTER_COORD_PX_ONLY=1 で従来のみに戻せる）。
 */

import type { SheetStructure, PrintMeta, CellInfo } from "./form-structure";

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
    const modulePath = "./logger";
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require(/* webpackIgnore: true */ modulePath);
    _log = mod.createLogger("print-coord-mapper");
  } catch {
    /* ignore */
  }
  return _log;
}

function coordDebugEnabled(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  const v = process.env.IREPORTER_COORD_DEBUG;
  return v === "1" || v === "true";
}

function forcePxOnly(): boolean {
  if (typeof process === "undefined" || !process.env) return false;
  const v = process.env.IREPORTER_COORD_PX_ONLY;
  return v === "1" || v === "true";
}

export type PdfRect = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * 単一セル参照（先頭のみ）を 1-based Excel 行・列に分解する。
 * 例: "$B$7" → { row: 7, col: 2 }
 */
export function parseExcelA1Ref(ref: string): { row: number; col: number } | null {
  const s = ref.trim().replace(/\$/g, "").split(":")[0];
  const m = /^([A-Za-z]{1,3})(\d{1,7})$/i.exec(s);
  if (!m) return null;
  const letters = m[1].toUpperCase();
  const row = parseInt(m[2], 10);
  if (!Number.isFinite(row) || row < 1) return null;
  let col = 0;
  for (let i = 0; i < letters.length; i++) {
    const code = letters.charCodeAt(i);
    if (code < 65 || code > 90) return null;
    col = col * 26 + (code - 64);
  }
  if (col < 1) return null;
  return { row, col };
}

function findCellByAddress(sheet: SheetStructure, raw: string): CellInfo | undefined {
  const key = raw.replace(/\$/g, "").split(":")[0].trim().toUpperCase();
  if (!key) return undefined;
  return sheet.cells.find((c) => c.address.toUpperCase() === key);
}

/**
 * printMeta グリッド照合用の 1-based 行・列の包含範囲（結合セルは外周）。
 */
export function resolvePrintMetaCellBounds1Based(
  sheet: SheetStructure,
  cellAddress: string
): { row1: number; row2: number; col1: number; col2: number } | null {
  const trimmed = cellAddress.trim();
  if (!trimmed) return null;
  const cell = findCellByAddress(sheet, trimmed);
  if (cell?.mergeRange) {
    const mr = cell.mergeRange;
    return {
      row1: mr.startRow + 1,
      row2: mr.endRow + 1,
      col1: mr.startCol + 1,
      col2: mr.endCol + 1,
    };
  }
  if (cell) {
    const r = cell.row + 1;
    const c = cell.col + 1;
    return { row1: r, row2: r, col1: c, col2: c };
  }
  const parsed = parseExcelA1Ref(trimmed);
  if (!parsed) return null;
  return {
    row1: parsed.row,
    row2: parsed.row,
    col1: parsed.col,
    col2: parsed.col,
  };
}

function lookupPtRectFromPrintMetaGrid(
  printMeta: PrintMeta,
  row1: number,
  row2: number,
  col1: number,
  col2: number
): { top: number; bottom: number; left: number; right: number } | null {
  const rowMap = new Map(printMeta.rows.map((r) => [r.row, r]));
  const colMap = new Map(printMeta.columns.map((c) => [c.col, c]));
  const rLo = Math.min(row1, row2);
  const rHi = Math.max(row1, row2);
  const cLo = Math.min(col1, col2);
  const cHi = Math.max(col1, col2);

  let top: number | null = null;
  let bottom: number | null = null;
  for (let r = rLo; r <= rHi; r++) {
    const entry = rowMap.get(r);
    if (!entry) return null;
    const btm = entry.top + entry.height;
    if (top === null || entry.top < top) top = entry.top;
    if (bottom === null || btm > bottom) bottom = btm;
  }

  let left: number | null = null;
  let right: number | null = null;
  for (let c = cLo; c <= cHi; c++) {
    const entry = colMap.get(c);
    if (!entry) return null;
    const rgt = entry.left + entry.width;
    if (left === null || entry.left < left) left = entry.left;
    if (right === null || rgt > right) right = rgt;
  }

  if (top === null || bottom === null || left === null || right === null) return null;
  return { top, bottom, left, right };
}

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
    scale = Math.min(scaleX, scaleY, 1.0);
  } else {
    scale = 1;
  }

  const renderedW = pa.width * scale;
  const renderedH = pa.height * scale;

  // Excel の「ページに合わせる」縮小時は、余白内で印刷範囲が水平中央になることが多い。
  // 既定の 100% 印刷では PageSetup.CenterHorizontally がオフのことが多く、
  // 左マージンからそのまま配置される。ここで常に (contentW - renderedW)/2 を足すと
  // Designer / 実 PDF より右にずれた座標になる（横ズレの主因）。
  let offsetX = 0;
  if (printMeta.fitToPagesWide != null || printMeta.fitToPagesTall != null) {
    offsetX = (contentW - renderedW) / 2;
  }

  return {
    left: printMeta.margins.left + offsetX,
    top: printMeta.margins.top,
    width: renderedW,
    height: renderedH,
    scale,
  };
}

export type PxPtPair = { px: number; pt: number };

export function interpolate(points: PxPtPair[], px: number): number {
  if (points.length === 0) return px;
  if (points.length === 1) return points[0].pt;

  if (px <= points[0].px) {
    const r = safeDivide(points[1].pt - points[0].pt, points[1].px - points[0].px, 1);
    return points[0].pt + (px - points[0].px) * r;
  }
  const last = points.length - 1;
  if (px >= points[last].px) {
    const r = safeDivide(points[last].pt - points[last - 1].pt, points[last].px - points[last - 1].px, 1);
    return points[last].pt + (px - points[last].px) * r;
  }

  let lo = 0,
    hi = last;
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1;
    if (points[mid].px <= px) lo = mid;
    else hi = mid;
  }
  const a = points[lo],
    b = points[hi];
  const t = safeDivide(px - a.px, b.px - a.px, 0);
  return a.pt + t * (b.pt - a.pt);
}

export function safeDivide(num: number, den: number, fallback: number): number {
  return den !== 0 ? num / den : fallback;
}

function mapPxRegionToPtRect(
  region: PdfRect,
  sheet: SheetStructure,
  printMeta: PrintMeta
): { top: number; bottom: number; left: number; right: number } | null {
  const pa = printMeta.printArea ?? printMeta.usedRange;
  if (pa.width <= 0 || pa.height <= 0) return null;

  const rowTopsPx = cumulativeSum(sheet.rowHeights);
  const colLeftsPx = cumulativeSum(sheet.colWidths);

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

  return {
    top: interpolate(rowPairs, region.top),
    bottom: interpolate(rowPairs, region.bottom),
    left: interpolate(colPairs, region.left),
    right: interpolate(colPairs, region.right),
  };
}

function ptRectToPdfNormalized(
  ptTop: number,
  ptBottom: number,
  ptLeft: number,
  ptRight: number,
  printMeta: PrintMeta
): PdfRect | null {
  const pa = printMeta.printArea ?? printMeta.usedRange;
  const content = computePdfContentArea(printMeta);

  if (pa.width <= 0 || pa.height <= 0) return null;

  const relTop = (ptTop - pa.top) / pa.height;
  const relBottom = (ptBottom - pa.top) / pa.height;
  const relLeft = (ptLeft - pa.left) / pa.width;
  const relRight = (ptRight - pa.left) / pa.width;

  const pageW = printMeta.pdfPageWidthPt;
  const pageH = printMeta.pdfPageHeightPt;

  return {
    left: (content.left + relLeft * content.width) / pageW,
    right: (content.left + relRight * content.width) / pageW,
    top: (content.top + relTop * content.height) / pageH,
    bottom: (content.top + relBottom * content.height) / pageH,
  };
}

function emitCoordLog(
  mode: "address" | "px",
  region: PdfRect,
  ptRect: { top: number; bottom: number; left: number; right: number },
  result: PdfRect,
  printMeta: PrintMeta,
  cellAddress?: string
): void {
  const log = getLog();
  if (!log) return;

  const pageW = printMeta.pdfPageWidthPt;
  const pageH = printMeta.pdfPageHeightPt;
  const pdfToMm = (norm: number, pagePt: number) => +(norm * pagePt * 25.4 / 72).toFixed(2);

  const payload = {
    mode,
    cellAddress: cellAddress ?? "",
    regionPx: {
      top: +region.top.toFixed(1),
      bottom: +region.bottom.toFixed(1),
      left: +region.left.toFixed(1),
      right: +region.right.toFixed(1),
    },
    ptRegion: {
      top: +ptRect.top.toFixed(2),
      bottom: +ptRect.bottom.toFixed(2),
      left: +ptRect.left.toFixed(2),
      right: +ptRect.right.toFixed(2),
    },
    pdfNormalized: {
      top: +result.top.toFixed(4),
      bottom: +result.bottom.toFixed(4),
      left: +result.left.toFixed(4),
      right: +result.right.toFixed(4),
    },
    mmOnPaper: {
      top: pdfToMm(result.top, pageH),
      bottom: pdfToMm(result.bottom, pageH),
      left: pdfToMm(result.left, pageW),
      right: pdfToMm(result.right, pageW),
    },
  };

  if (coordDebugEnabled()) {
    log.info("Coordinate mapping", payload);
  } else {
    log.debug("Coordinate mapping", payload);
  }
}

export type ClusterBoundsPdfMapping = {
  pdf: PdfRect;
  /** printMeta 行列入力で pt を取ったか / px 補間か */
  mode: "address" | "px";
  /** 印刷レイアウト上の pt 矩形（シート原点） */
  ptRect: { top: number; bottom: number; left: number; right: number };
};

/**
 * px 由来の region と任意の cellAddress を統合し、PDF 上の 0〜1 矩形と経路情報を返す。
 * cellAddress が printMeta グリッド上で解決できればアドレス直参照（オプション A）。
 */
export function mapClusterBoundsToPdfDetailed(
  region: PdfRect,
  cellAddress: string | undefined,
  sheet: SheetStructure,
  printMeta: PrintMeta
): ClusterBoundsPdfMapping | null {
  const pa = printMeta.printArea ?? printMeta.usedRange;
  if (pa.width <= 0 || pa.height <= 0) return null;

  let mode: "address" | "px" = "px";
  let ptRect: { top: number; bottom: number; left: number; right: number } | null = null;

  if (!forcePxOnly() && cellAddress?.trim()) {
    const bounds = resolvePrintMetaCellBounds1Based(sheet, cellAddress);
    if (bounds) {
      ptRect = lookupPtRectFromPrintMetaGrid(
        printMeta,
        bounds.row1,
        bounds.row2,
        bounds.col1,
        bounds.col2
      );
      if (ptRect) mode = "address";
    }
  }

  if (!ptRect) {
    ptRect = mapPxRegionToPtRect(region, sheet, printMeta);
    if (!ptRect) return null;
    mode = "px";
  }

  const result = ptRectToPdfNormalized(ptRect.top, ptRect.bottom, ptRect.left, ptRect.right, printMeta);
  if (!result) return null;

  emitCoordLog(mode, region, ptRect, result, printMeta, cellAddress);

  return { pdf: result, mode, ptRect };
}

/**
 * mapClusterBoundsToPdfDetailed の pdf のみ（後方互換）
 */
export function mapClusterBoundsToPdf(
  region: PdfRect,
  cellAddress: string | undefined,
  sheet: SheetStructure,
  printMeta: PrintMeta
): PdfRect | null {
  return mapClusterBoundsToPdfDetailed(region, cellAddress, sheet, printMeta)?.pdf ?? null;
}

/**
 * クラスターの Excel px 座標 → PDF ページ上の 0-1 座標に変換（後方互換: px のみ）
 */
export function mapClusterRegionToPdf(
  region: PdfRect,
  sheet: SheetStructure,
  printMeta: PrintMeta
): PdfRect | null {
  return mapClusterBoundsToPdf(region, undefined, sheet, printMeta);
}

export function extrapolatePx(cumulative: number[], idx: number): number {
  if (cumulative.length < 2) return idx * 64;
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
