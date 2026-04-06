import * as XLSX from "xlsx";
import type {
  FormStructure,
  SheetStructure,
  CellInfo,
  CellStyle,
  PageSetup,
} from "./form-structure";

/** Excel の行高さ/列幅のデフォルト値 (px 換算) */
const DEFAULT_ROW_HEIGHT = 20;
const DEFAULT_COL_WIDTH = 64;

/** Excel の列幅単位 (文字数) → px への変換係数 */
const COL_WIDTH_TO_PX = 7.5;
/** Excel の行高さ (ポイント) → px への変換係数 */
const ROW_HEIGHT_TO_PX = 1.333;

/**
 * .xlsx ファイルの ArrayBuffer を解析し FormStructure に変換する
 */
export function parseExcel(
  buffer: ArrayBuffer,
  fileName: string
): FormStructure {
  const workbook = XLSX.read(buffer, {
    type: "array",
    cellStyles: true,
    cellFormula: true,
    cellNF: true,
  });

  const filteredNames = workbook.SheetNames.filter(
    (name) => name.toLowerCase() !== "exceloutputsetting"
  );

  const sheets: SheetStructure[] = filteredNames.map((name, index) => {
    const ws = workbook.Sheets[name];
    return parseSheet(ws, name, index);
  });

  return { fileName, sheets };
}

function parseSheet(
  ws: XLSX.WorkSheet,
  name: string,
  index: number
): SheetStructure {
  const ref = ws["!ref"];
  if (!ref) {
    return {
      name,
      index,
      rowCount: 0,
      colCount: 0,
      rowHeights: [],
      colWidths: [],
      totalWidth: 0,
      totalHeight: 0,
      cells: [],
      pageSetup: extractPageSetup(ws),
    };
  }

  const range = XLSX.utils.decode_range(ref);
  const rowCount = range.e.r + 1;
  const colCount = range.e.c + 1;

  // 行高さ (px)
  const rowHeights: number[] = [];
  for (let r = 0; r < rowCount; r++) {
    const rowInfo = ws["!rows"]?.[r];
    const hpt = rowInfo?.hpt ?? rowInfo?.hpx ?? null;
    rowHeights.push(hpt ? hpt * ROW_HEIGHT_TO_PX : DEFAULT_ROW_HEIGHT);
  }

  // 列幅 (px)
  const colWidths: number[] = [];
  for (let c = 0; c < colCount; c++) {
    const colInfo = ws["!cols"]?.[c];
    const wch = colInfo?.wch ?? colInfo?.wpx ?? null;
    if (colInfo?.wpx) {
      colWidths.push(colInfo.wpx);
    } else if (wch) {
      colWidths.push(wch * COL_WIDTH_TO_PX);
    } else {
      colWidths.push(DEFAULT_COL_WIDTH);
    }
  }

  // デバッグ: SheetJS の列幅の生データ
  console.log(`[excel-parser] Sheet "${name}" ref=${ref} rowCount=${rowCount} colCount=${colCount}`);
  console.log(`[excel-parser] colWidths (first 10):`, colWidths.slice(0, 10).map((w, i) => {
    const ci = ws["!cols"]?.[i];
    return { col: i, px: w, raw: ci ? { wch: ci.wch, wpx: ci.wpx, width: ci.width } : "default" };
  }));
  console.log(`[excel-parser] totalWidth=${colWidths.reduce((a, b) => a + b, 0).toFixed(1)} totalHeight=${rowHeights.reduce((a, b) => a + b, 0).toFixed(1)}`);

  // ページ設定の抽出
  const pageSetup = extractPageSetup(ws);

  // 累積座標の事前計算
  const rowTops = cumulativeSum(rowHeights);
  const colLefts = cumulativeSum(colWidths);
  const totalWidth = colLefts[colCount] ?? 0;
  const totalHeight = rowTops[rowCount] ?? 0;

  // セル結合情報をマップ化
  const mergeMap = buildMergeMap(ws["!merges"] ?? []);

  // セル情報の抽出
  const cells: CellInfo[] = [];
  for (let r = 0; r <= range.e.r; r++) {
    for (let c = 0; c <= range.e.c; c++) {
      const address = XLSX.utils.encode_cell({ r, c });
      const cell = ws[address];

      // 結合セルの子セル (左上以外) はスキップ
      const mergeKey = `${r},${c}`;
      const merge = mergeMap.get(mergeKey);
      if (merge && (merge.startRow !== r || merge.startCol !== c)) {
        continue;
      }

      const endRow = merge ? merge.endRow : r;
      const endCol = merge ? merge.endCol : c;

      const value = cell ? getCellValue(cell) : "";
      const formula = cell?.f ? String(cell.f) : undefined;
      const style = extractStyle(cell);
      const dataValidation = extractDataValidation(ws, address);
      const commentRaw = extractCellCommentRaw(cell);

      cells.push({
        address,
        row: r,
        col: c,
        value,
        formula,
        commentRaw,
        isMerged: !!merge,
        mergeRange: merge
          ? {
              startRow: merge.startRow,
              startCol: merge.startCol,
              endRow: merge.endRow,
              endCol: merge.endCol,
            }
          : undefined,
        region: {
          top: rowTops[r],
          bottom: rowTops[endRow + 1] ?? rowTops[endRow] + rowHeights[endRow],
          left: colLefts[c],
          right:
            colLefts[endCol + 1] ?? colLefts[endCol] + colWidths[endCol],
        },
        style,
        dataValidation,
      });
    }
  }

  return {
    name,
    index,
    rowCount,
    colCount,
    rowHeights,
    colWidths,
    totalWidth,
    totalHeight,
    cells,
    pageSetup,
  };
}

// --- ページ設定の抽出 ---

/** SheetJS の paperSize コード → 用紙名 */
const PAPER_SIZE_MAP: Record<number, PageSetup["paperSize"]> = {
  9: "A4",  // A4 (210 x 297 mm)
  8: "A3",  // A3 (297 x 420 mm)
  12: "B4", // B4 (JIS) (257 x 364 mm)
};

/** SheetJS のマージン (インチ) → mm への変換係数 */
const INCH_TO_MM = 25.4;

/** デフォルトマージン (mm) — Excel のデフォルト値に合わせる */
const DEFAULT_MARGINS = { top: 19.1, bottom: 19.1, left: 17.8, right: 17.8 };

export function extractPageSetup(ws: XLSX.WorkSheet): PageSetup {
  const wsAny = ws as Record<string, unknown>;

  // orientation: SheetJS の !pageSetup.orientation ("portrait" | "landscape")
  const psRaw = wsAny["!pageSetup"] as Record<string, unknown> | undefined;
  let orientation: PageSetup["orientation"] = "portrait";
  if (psRaw?.orientation === "landscape") {
    orientation = "landscape";
  }

  // paperSize
  let paperSize: PageSetup["paperSize"] = "A4";
  if (psRaw?.paperSize != null) {
    const code = Number(psRaw.paperSize);
    paperSize = PAPER_SIZE_MAP[code] ?? "other";
  }

  // margins: SheetJS の !margins (単位: インチ)
  const marginsRaw = wsAny["!margins"] as Record<string, unknown> | undefined;
  let margins = { ...DEFAULT_MARGINS };
  if (marginsRaw) {
    const t = Number(marginsRaw.top);
    const b = Number(marginsRaw.bottom);
    const l = Number(marginsRaw.left);
    const r = Number(marginsRaw.right);
    margins = {
      top: isFinite(t) ? t * INCH_TO_MM : DEFAULT_MARGINS.top,
      bottom: isFinite(b) ? b * INCH_TO_MM : DEFAULT_MARGINS.bottom,
      left: isFinite(l) ? l * INCH_TO_MM : DEFAULT_MARGINS.left,
      right: isFinite(r) ? r * INCH_TO_MM : DEFAULT_MARGINS.right,
    };
  }

  return { orientation, paperSize, margins };
}

// --- ヘルパー ---

export function cumulativeSum(arr: number[]): number[] {
  const result = [0];
  for (let i = 0; i < arr.length; i++) {
    result.push(result[i] + arr[i]);
  }
  return result;
}

type MergeInfo = {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
};

export function buildMergeMap(
  merges: XLSX.Range[]
): Map<string, MergeInfo> {
  const map = new Map<string, MergeInfo>();
  for (const merge of merges) {
    const info: MergeInfo = {
      startRow: merge.s.r,
      startCol: merge.s.c,
      endRow: merge.e.r,
      endCol: merge.e.c,
    };
    for (let r = merge.s.r; r <= merge.e.r; r++) {
      for (let c = merge.s.c; c <= merge.e.c; c++) {
        map.set(`${r},${c}`, info);
      }
    }
  }
  return map;
}

/**
 * SheetJS のセルコメント配列（cell.c）から iReporter 用の raw テキストを結合する。
 * 複数ブロック（スレッド等）は \\n で連結する。
 * t が空のときは HTML（h）やリッチ文字列 XML（r）からプレーンを拾う。
 */
export function extractCellCommentRaw(
  cell: XLSX.CellObject | undefined
): string | undefined {
  const blocks = cell?.c;
  if (!blocks || !Array.isArray(blocks) || blocks.length === 0) return undefined;
  const parts: string[] = [];
  for (const block of blocks) {
    if (!block || typeof block !== "object") continue;
    const b = block as { t?: string; h?: string; r?: string };
    let text = "";
    if (typeof b.t === "string" && b.t.length > 0) {
      text = b.t;
    } else if (typeof b.h === "string" && b.h.length > 0) {
      text = stripCommentHtmlToPlain(b.h);
    } else if (typeof b.r === "string" && b.r.length > 0) {
      text = extractPlainFromCommentRichXml(b.r);
    }
    if (text.length > 0) parts.push(text);
  }
  if (parts.length === 0) return undefined;
  return parts.join("\n");
}

function stripCommentHtmlToPlain(html: string): string {
  return html
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
}

/** コメント内 <t>...</t> からプレーンを抽出（リッチラン） */
function extractPlainFromCommentRichXml(r: string): string {
  const chunks: string[] = [];
  const re = /<(?:\w+:)?t[^>]*>([^<]*)<\/(?:\w+:)?t>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(r)) !== null) {
    chunks.push(
      m[1]
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
    );
  }
  if (chunks.length > 0) return chunks.join("");
  return r.replace(/<[^>]+>/g, "");
}

export function getCellValue(cell: XLSX.CellObject): string {
  if (cell.w) return cell.w; // formatted text
  if (cell.v !== undefined && cell.v !== null) return String(cell.v);
  return "";
}

export function extractStyle(cell: XLSX.CellObject | undefined): CellStyle {
  if (!cell?.s) return {};
  const s = cell.s as Record<string, unknown>;
  const style: CellStyle = {};

  // Font
  const font = s.font as Record<string, unknown> | undefined;
  if (font) {
    if (font.bold) style.bold = true;
    if (font.sz) style.fontSize = Number(font.sz);
    if (font.color && typeof font.color === "object") {
      const c = font.color as Record<string, unknown>;
      if (c.rgb) style.fontColor = `#${String(c.rgb).slice(-6)}`;
    }
  }

  // Fill
  const fill = s.fill as Record<string, unknown> | undefined;
  if (fill?.fgColor && typeof fill.fgColor === "object") {
    const c = fill.fgColor as Record<string, unknown>;
    if (c.rgb) style.bgColor = `#${String(c.rgb).slice(-6)}`;
  }

  // Alignment
  const alignment = s.alignment as Record<string, unknown> | undefined;
  if (alignment?.horizontal) {
    const h = String(alignment.horizontal);
    if (h === "left" || h === "center" || h === "right") {
      style.horizontalAlignment = h;
    }
  }

  // Number format
  if (cell.z) {
    style.numberFormat = String(cell.z);
  }

  return style;
}

function extractDataValidation(
  ws: XLSX.WorkSheet,
  _address: string
): CellInfo["dataValidation"] {
  // SheetJS の data validation サポートは限定的
  // !dataValidations が存在する場合のみ処理
  const dvs = (ws as Record<string, unknown>)["!dataValidations"] as
    | Array<Record<string, unknown>>
    | undefined;
  if (!dvs) return undefined;

  // TODO: address に一致する validation を探して変換
  // MVP では data validation の抽出は後回し
  return undefined;
}
