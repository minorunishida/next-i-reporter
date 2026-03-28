/**
 * ConMas 全38クラスタ型の統一レジストリ
 *
 * 仕様書: cluster-types-external-reference.md
 * すべてのクラスタ型情報はここから導出する (Single Source of Truth)
 */

// --- カテゴリ定義 ---

export type ClusterCategory =
  | "text"
  | "numeric"
  | "date"
  | "selection"
  | "media"
  | "workflow"
  | "reader"
  | "action"
  | "other";

// --- 型エントリ ---

export type ClusterTypeEntry = {
  value: number;
  name: string;
  displayNameJa: string;
  displayNameEn: string;
  stDefaultsIndex: number;
  category: ClusterCategory;
};

// --- 全38型レジストリ ---
// satisfies で型チェックしつつ as const でリテラル型を保持

const _REGISTRY = [
  // [0] text 系
  { value: 30,  name: "KeyboardText",  displayNameJa: "キーボードテキスト", displayNameEn: "Keyboard",               stDefaultsIndex: 0,  category: "text" },
  { value: 119, name: "Handwriting",   displayNameJa: "手書きデジタル",     displayNameEn: "Text by handwriting",     stDefaultsIndex: 1,  category: "text" },
  { value: 20,  name: "FixedText",     displayNameJa: "手書きノート形式",   displayNameEn: "Handwriting note",        stDefaultsIndex: 2,  category: "text" },
  { value: 10,  name: "FreeText",      displayNameJa: "手書きフリーメモ",   displayNameEn: "Free whiteboard",         stDefaultsIndex: 3,  category: "text" },

  // [4] numeric 系
  { value: 60,  name: "Numeric",       displayNameJa: "数値選択",           displayNameEn: "Choice of Numerical number", stDefaultsIndex: 4,  category: "numeric" },
  { value: 65,  name: "InputNumeric",  displayNameJa: "数値",               displayNameEn: "Numerical number keyboard",  stDefaultsIndex: 5,  category: "numeric" },
  { value: 110, name: "NumberHours",   displayNameJa: "時間数",             displayNameEn: "Number of hours",         stDefaultsIndex: 6,  category: "numeric" },
  { value: 67,  name: "Calculate",     displayNameJa: "計算式",             displayNameEn: "Calculation formula",     stDefaultsIndex: 7,  category: "numeric" },

  // [8] date 系
  { value: 40,  name: "Date",          displayNameJa: "年月日",             displayNameEn: "Date",                    stDefaultsIndex: 8,  category: "date" },
  { value: 111, name: "CalendarDate",  displayNameJa: "カレンダー年月日",   displayNameEn: "Calendar",                stDefaultsIndex: 9,  category: "date" },
  { value: 50,  name: "Time",          displayNameJa: "時刻",               displayNameEn: "Time",                    stDefaultsIndex: 10, category: "date" },

  // [11] selection 系
  { value: 90,  name: "Check",                displayNameJa: "チェック",     displayNameEn: "Single check",            stDefaultsIndex: 11, category: "selection" },
  { value: 123, name: "MultipleChoiceNumber", displayNameJa: "トグル選択",   displayNameEn: "Toggle select",           stDefaultsIndex: 12, category: "selection" },
  { value: 124, name: "MCNCalculate",         displayNameJa: "トグル集計",   displayNameEn: "Toggle summary",          stDefaultsIndex: 13, category: "selection" },
  { value: 70,  name: "Select",               displayNameJa: "単一選択",     displayNameEn: "Single choice",           stDefaultsIndex: 14, category: "selection" },
  { value: 80,  name: "MultiSelect",          displayNameJa: "複数選択",     displayNameEn: "Multiple choice",         stDefaultsIndex: 15, category: "selection" },

  // [16] media 系
  { value: 100, name: "Image",         displayNameJa: "画像",               displayNameEn: "Image",                   stDefaultsIndex: 16, category: "media" },

  // [17] workflow 系
  { value: 116, name: "Create",              displayNameJa: "作成",           displayNameEn: "Issuer",                stDefaultsIndex: 17, category: "workflow" },
  { value: 117, name: "Inspect",             displayNameJa: "査閲",           displayNameEn: "Inspector",             stDefaultsIndex: 18, category: "workflow" },
  { value: 118, name: "Approve",             displayNameJa: "承認",           displayNameEn: "Approver",              stDefaultsIndex: 19, category: "workflow" },
  { value: 112, name: "Registration",        displayNameJa: "帳票登録者",     displayNameEn: "Issuer of document",    stDefaultsIndex: 20, category: "workflow" },
  { value: 113, name: "RegistrationDate",    displayNameJa: "帳票登録年月日", displayNameEn: "Date of issue",         stDefaultsIndex: 21, category: "workflow" },
  { value: 114, name: "LatestUpdate",        displayNameJa: "帳票更新者",     displayNameEn: "Last update person",    stDefaultsIndex: 22, category: "workflow" },
  { value: 115, name: "LatestUpdateDate",    displayNameJa: "帳票更新年月日", displayNameEn: "Last update date",      stDefaultsIndex: 23, category: "workflow" },

  // [24] reader 系
  { value: 121, name: "QRCode",        displayNameJa: "バーコード",         displayNameEn: "Bar code",                stDefaultsIndex: 24, category: "reader" },
  { value: 122, name: "CodeReader",    displayNameJa: "コードリーダー",     displayNameEn: "Barcode reader",          stDefaultsIndex: 25, category: "reader" },
  { value: 120, name: "Gps",           displayNameJa: "GPS位置情報",        displayNameEn: "GPS location",            stDefaultsIndex: 26, category: "reader" },

  // [27] media 系 (続き)
  { value: 15,  name: "FreeDraw",      displayNameJa: "フリードロー",       displayNameEn: "Free draw",               stDefaultsIndex: 27, category: "media" },

  // [28] date 系 (続き)
  { value: 55,  name: "TimeCalculate", displayNameJa: "時刻計算",           displayNameEn: "Time calculation",        stDefaultsIndex: 28, category: "date" },

  // [29] other / action / reader
  { value: 125, name: "SelectMaster",  displayNameJa: "マスター選択",       displayNameEn: "Select master",           stDefaultsIndex: 29, category: "selection" },
  { value: 126, name: "Action",        displayNameJa: "アクション",         displayNameEn: "Action",                  stDefaultsIndex: 30, category: "action" },
  { value: 127, name: "LoginUser",     displayNameJa: "ログインユーザー",   displayNameEn: "Log-in user",             stDefaultsIndex: 31, category: "other" },

  // [32] media 系 (ピン打ち)
  { value: 128, name: "DrawingImage",  displayNameJa: "ピン打ち",           displayNameEn: "Stick pins",              stDefaultsIndex: 32, category: "media" },
  { value: 129, name: "DrawingPinNo",  displayNameJa: "ピンNo.配置",        displayNameEn: "Pin No. locating",        stDefaultsIndex: 33, category: "media" },
  { value: 130, name: "PinItemTableNo", displayNameJa: "ピンNo.",           displayNameEn: "Pin No.",                 stDefaultsIndex: 34, category: "media" },

  // [35] media 系 (録音・スキャン)
  { value: 131, name: "AudioRecording", displayNameJa: "録音",              displayNameEn: "Audio recording",         stDefaultsIndex: 35, category: "media" },
  { value: 132, name: "Scandit",        displayNameJa: "SCANDIT",           displayNameEn: "SCANDIT",                 stDefaultsIndex: 36, category: "reader" },
  { value: 133, name: "EdgeOCR",        displayNameJa: "EdgeOCR",           displayNameEn: "EdgeOCR",                 stDefaultsIndex: 37, category: "reader" },
] as const satisfies readonly ClusterTypeEntry[];

export const CLUSTER_TYPE_REGISTRY = _REGISTRY;

/** 全クラスタ型名のリテラル union */
export type ClusterTypeName = (typeof _REGISTRY)[number]["name"];

// --- 派生ルックアップ ---

/** name → エントリ */
export const REGISTRY_BY_NAME: Map<string, ClusterTypeEntry> = new Map(
  CLUSTER_TYPE_REGISTRY.map((e) => [e.name, e as ClusterTypeEntry]),
);

/** value (数値) → エントリ */
export const REGISTRY_BY_VALUE: Map<number, ClusterTypeEntry> = new Map(
  CLUSTER_TYPE_REGISTRY.map((e) => [e.value, e as ClusterTypeEntry]),
);

/** 全型名の union 型を導出するための配列 */
export const ALL_CLUSTER_TYPE_NAMES = CLUSTER_TYPE_REGISTRY.map((e) => e.name);

/** 数値 → 文字列名マップ (conmas-cluster-types.ts 互換) */
export const TYPE_NUM_TO_STRING_MAP: Record<number, string> = Object.fromEntries(
  CLUSTER_TYPE_REGISTRY.map((e) => [e.value, e.name]),
);

/** 文字列名 → 日本語ラベル (コンポーネント用) */
export const TYPE_LABELS_JA: Record<string, string> = Object.fromEntries(
  CLUSTER_TYPE_REGISTRY.map((e) => [e.name, e.displayNameJa]),
);

/** MVP で AI 推論対象とする型名リスト (Phase 2 で拡張) */
export const MVP_TYPE_NAMES = [
  "KeyboardText",
  "FixedText",
  "Date",
  "Time",
  "InputNumeric",
  "Calculate",
  "Select",
  "Check",
  "Image",
  "Handwriting",
] as const;

// --- カテゴリ情報 ---

export const CATEGORY_LABELS_JA: Record<ClusterCategory, string> = {
  text: "テキスト",
  numeric: "数値・計算",
  date: "日付・時刻",
  selection: "選択・チェック",
  media: "メディア・描画",
  workflow: "ワークフロー",
  reader: "読取・スキャン",
  action: "アクション",
  other: "その他",
};

export const CATEGORY_COLORS: Record<ClusterCategory, string> = {
  text: "#3b82f6",       // blue
  numeric: "#f59e0b",    // amber
  date: "#10b981",       // emerald
  selection: "#8b5cf6",  // violet
  media: "#f97316",      // orange
  workflow: "#ec4899",   // pink
  reader: "#06b6d4",     // cyan
  action: "#ef4444",     // red
  other: "#6b7280",      // gray
};
