/**
 * 中間表現: Excel/写真 → この形 → AI推論 → ConMas XML
 * すべてのルート (Excel, 写真, 会話) がこの型に収束する
 */

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
};

// --- シート構造 ---

export type PageSetup = {
  orientation: "portrait" | "landscape";
  paperSize: "A4" | "A3" | "B4" | "other";
  margins: { top: number; bottom: number; left: number; right: number }; // in mm
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
};

// --- 帳票構造 (中間表現のルート) ---

export type FormStructure = {
  fileName: string;
  sheets: SheetStructure[];
  pdfBase64?: string; // Graph API で変換した背景PDF (Base64)
};

// --- クラスタ定義 (AI 推論結果) ---

export const CLUSTER_TYPES = {
  FixedText: 20,
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

export type ClusterTypeName = keyof typeof CLUSTER_TYPES;

export type ClusterDefinition = {
  id: string;
  name: string;
  type: number;
  typeName: ClusterTypeName;
  sheetNo: number;
  cellAddress: string;
  region: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  confidence: number; // 0-1
  value?: string;
  displayValue?: string;
  readOnly: boolean;
  inputParameters: string; // "key1=value1;key2=value2" 形式
  excelOutputValue?: string;
  formula?: string;
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
