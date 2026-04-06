/**
 * 中間表現: Excel/写真 → この形 → AI推論 → ConMas XML
 * すべてのルート (Excel, 写真, 会話) がこの型に収束する
 */

import type { ParseIReporterCommentResult } from "./cell-comment-parse";

// --- セル構造 ---

export type CellStyle = {
  bold?: boolean;
  fontSize?: number;
  fontColor?: string;
  bgColor?: string;
  borderTop?: boolean;
  borderBottom?: boolean;
  borderLeft?: boolean;
  borderRight?: boolean;
  numberFormat?: string;
  horizontalAlignment?: "left" | "center" | "right";
};

export type CellInfo = {
  address: string; // "C5"
  row: number;
  col: number;
  value: string;
  formula?: string;
  isMerged: boolean;
  mergeRange?: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
  };
  region: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  style: CellStyle;
  dataValidation?: {
    type: "list" | "whole" | "decimal" | "date" | "time" | "textLength";
    values?: string[]; // list の場合の選択肢
    min?: string;
    max?: string;
  };
  /** iReporter Add-in 形式のセルコメント生テキスト（存在しない場合は undefined） */
  commentRaw?: string;
};

/** シート名・アドレスと parse 結果をセットにした連携用カタログの1行 */
export type CellCommentCatalogEntry = {
  sheetName: string;
  sheetIndex: number;
  cell: string;
  row: number;
  col: number;
  commentRaw: string;
  parsed: ParseIReporterCommentResult;
};

/** Excel を正としたセルコメントカタログ（自動生成・B案の一部） */
export type CellCommentCatalog = {
  lastGeneratedAt: string;
  entries: CellCommentCatalogEntry[];
};

// --- シート構造 ---

export type PageSetup = {
  orientation: "portrait" | "landscape";
  paperSize: "A4" | "A3" | "B4" | "other";
  margins: { top: number; bottom: number; left: number; right: number }; // in mm
};

/** eprint CLI (COM Interop) から取得する印刷メタ情報 */
export type PrintMeta = {
  name: string;
  printArea?: {
    address: string;
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    top: number;    // pt (シート原点からの絶対位置)
    left: number;
    width: number;
    height: number;
  };
  usedRange: {
    startRow: number;
    startCol: number;
    endRow: number;
    endCol: number;
    top: number;
    left: number;
    width: number;
    height: number;
  };
  zoom?: number;             // 手動拡大率 (10-400)
  fitToPagesWide?: number;   // ページ幅に合わせる
  fitToPagesTall?: number;   // ページ高さに合わせる
  margins: {
    top: number;
    bottom: number;
    left: number;
    right: number;
    header: number;
    footer: number;
  }; // pt
  paperSize: number;
  orientation: number;       // 1=Portrait, 2=Landscape
  pdfPageWidthPt: number;
  pdfPageHeightPt: number;
  rows: Array<{ row: number; height: number; top: number; hidden?: boolean }>; // pt
  columns: Array<{ col: number; width: number; left: number; hidden?: boolean }>; // pt
  merges?: Array<{ originRow: number; originCol: number; originAddress: string }>;
};

export type SheetStructure = {
  name: string;
  index: number;
  rowCount: number;
  colCount: number;
  rowHeights: number[]; // px
  colWidths: number[]; // px
  totalWidth: number; // px
  totalHeight: number; // px
  cells: CellInfo[];
  pageSetup: PageSetup;
  printMeta?: PrintMeta;
};

// --- 帳票構造 (中間表現のルート) ---

export type FormStructure = {
  fileName: string;
  sheets: SheetStructure[];
  pdfBase64?: string;     // 背景PDF (Base64) — プレビュー・座標表示用
  excelBase64?: string;   // Excel定義ファイル (Base64) — 計算式・出力マッピング用
  /**
   * 定義バイナリの論理ファイル名（例: book.xlsx）。
   * ConMas XML の definitionFile の name、または Excel アップロード時の元名。
   * fileName が .xml のままのときも、実体が xlsx ならここで拡張子を補う。
   */
  embeddedExcelFileName?: string;
  /** コメント付きセルのみ集約した連携用カタログ（parse-excel 等で付与） */
  cellCommentCatalog?: CellCommentCatalog;
};

// --- クラスター定義 (AI 推論結果) ---
// 型レジストリから導出 — 後方互換のため旧 CLUSTER_TYPES も維持

import { CLUSTER_TYPE_REGISTRY, type ClusterTypeName } from "./cluster-type-registry";
export type { ClusterTypeName } from "./cluster-type-registry";

/** 全38型の name→value マップ */
export const CLUSTER_TYPES_FULL = Object.fromEntries(
  CLUSTER_TYPE_REGISTRY.map((e) => [e.name, e.value]),
) as Record<string, number>;

/** 後方互換: MVP 9型のみ (既存コードが参照) */
export const CLUSTER_TYPES = {
  KeyboardText: 30,
  Date: 40,
  Time: 50,
  InputNumeric: 65,
  Calculate: 67,
  Select: 70,
  Check: 90,
  Image: 100,
  Handwriting: 119,
} as const;

/** AI が推測したクラスター（帳票上の入力項目）の定義 */
export type ClusterDefinition = {
  id: string;
  name: string;
  type: number;                 // CLUSTER_TYPES の数値コード
  typeName: ClusterTypeName;
  sheetNo: number;              // 0-based シートインデックス
  cellAddress: string;          // "C5" 形式
  region: {                     // px 座標（excel-parser で計算）
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  confidence: number;           // 0-1 の推測自信度
  value?: string;
  displayValue?: string;
  readOnly: boolean;
  inputParameters: string;      // "key1=value1;key2=value2" 形式
  excelOutputValue?: string;
  formula?: string;             // Excel 数式（Calculate 型の場合）
};

export type AnalysisResult = {
  formStructure: FormStructure;
  clusters: ClusterDefinition[];
  summary: {
    totalClusters: number;
    highConfidence: number;
    mediumConfidence: number;
    lowConfidence: number;
  };
};
