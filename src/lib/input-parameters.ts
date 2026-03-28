/**
 * ConMas inputParameters パーサー・シリアライザー
 *
 * 仕様: input-parameters.md §2 (共通形式)
 * - トークン: key=value
 * - 連結: ;
 * - 値に ; を含める: ;; にエスケープ
 * - null 値: キーごと省略
 */

// ─── パーサー ───────────────────────────────────────────────────────────────

/**
 * inputParameters 文字列を key-value オブジェクトにパースする
 *
 * ConMas 仕様:
 * - "key1=value1;key2=value2" → { key1: "value1", key2: "value2" }
 * - ";;" は値中の ";" にアンエスケープされる
 * - 空文字列は空オブジェクトを返す
 */
export function parseInputParameters(raw: string): Record<string, string> {
  if (!raw || raw.trim() === "") return {};

  const result: Record<string, string> = {};

  // ";;" をプレースホルダーに置換してからトークン分割
  const PLACEHOLDER = "\x00SEMI\x00";
  const escaped = raw.replace(/;;/g, PLACEHOLDER);
  const tokens = escaped.split(";");

  for (const token of tokens) {
    const trimmed = token.trim();
    if (trimmed === "") continue;

    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) {
      // key のみ（値なし） — 空文字列として保存
      const key = trimmed.replace(new RegExp(PLACEHOLDER.replace(/\x00/g, "\\x00"), "g"), ";");
      result[key] = "";
      continue;
    }

    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1)
      .replace(new RegExp(PLACEHOLDER.replace(/\x00/g, "\\x00"), "g"), ";");

    if (key) {
      result[key] = value;
    }
  }

  return result;
}

// ─── シリアライザー ─────────────────────────────────────────────────────────

/**
 * key-value オブジェクトを inputParameters 文字列にシリアライズする
 *
 * - null / undefined の値はスキップ
 * - 値中の ";" は ";;" にエスケープ
 */
export function serializeInputParameters(params: Record<string, string | null | undefined>): string {
  const tokens: string[] = [];

  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined) continue;
    const escapedValue = value.replace(/;/g, ";;");
    tokens.push(`${key}=${escapedValue}`);
  }

  return tokens.join(";");
}

// ─── パラメータスキーマ ─────────────────────────────────────────────────────

export type ParamFieldType = "string" | "number" | "boolean" | "enum";

export type ParamFieldDef = {
  key: string;
  type: ParamFieldType;
  defaultValue: string;
  label: string;           // 日本語ラベル
  options?: string[];      // enum 型の選択肢
};

export type ParameterSchema = {
  typeName: string;
  fields: ParamFieldDef[];
};

/**
 * MVP 型のパラメータスキーマ定義
 * 仕様: input-parameters.md §4
 */
export const PARAMETER_SCHEMAS: Record<string, ParameterSchema> = {
  KeyboardText: {
    typeName: "KeyboardText",
    fields: [
      { key: "Required",        type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "MaxLength",       type: "number",  defaultValue: "0",         label: "最大文字数" },
      { key: "InputRestriction", type: "enum",   defaultValue: "",          label: "入力制限", options: ["", "Number", "Email", "Url"] },
      { key: "Lines",           type: "number",  defaultValue: "1",         label: "行数" },
      { key: "Align",           type: "enum",    defaultValue: "Left",      label: "配置", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment", type: "enum",  defaultValue: "Top",       label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",        type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "DefaultFontSize", type: "number",  defaultValue: "11",        label: "デフォルト文字サイズ" },
      { key: "Weight",          type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",           type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "FontPriority",    type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "EnableAutoFontSize", type: "boolean", defaultValue: "0",      label: "自動フォントサイズ" },
      { key: "DefaultText",     type: "string",  defaultValue: "",          label: "デフォルトテキスト" },
      { key: "Locked",          type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  InputNumeric: {
    typeName: "InputNumeric",
    fields: [
      { key: "Required",    type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "Minimum",     type: "string",  defaultValue: "",          label: "最小値" },
      { key: "Maximum",     type: "string",  defaultValue: "",          label: "最大値" },
      { key: "Decimal",     type: "number",  defaultValue: "0",         label: "小数桁数" },
      { key: "Comma",       type: "boolean", defaultValue: "0",         label: "桁区切り" },
      { key: "Prefix",      type: "string",  defaultValue: "",          label: "接頭辞" },
      { key: "Suffix",      type: "string",  defaultValue: "",          label: "接尾辞" },
      { key: "Align",       type: "enum",    defaultValue: "Right",     label: "配置", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment", type: "enum", defaultValue: "Center", label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "Font",        type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",    type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize", type: "boolean", defaultValue: "0",  label: "自動フォントサイズ" },
      { key: "Locked",      type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  Date: {
    typeName: "Date",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "0",            label: "必須" },
      { key: "AutoInput",     type: "boolean", defaultValue: "0",            label: "自動入力" },
      { key: "DateFormat",    type: "enum",    defaultValue: "yyyy/MM/dd",   label: "日付書式", options: ["yyyy/MM/dd", "yyyy-MM-dd", "MM/dd", "yyyy年MM月dd日"] },
      { key: "FirstOnly",     type: "boolean", defaultValue: "0",            label: "初回のみ" },
      { key: "Editable",      type: "boolean", defaultValue: "1",            label: "編集可" },
      { key: "ConfirmDialog",  type: "boolean", defaultValue: "0",           label: "確認ダイアログ" },
      { key: "UseTime",       type: "boolean", defaultValue: "0",            label: "時刻併用" },
      { key: "TimeFormat",    type: "enum",    defaultValue: "HH:mm",        label: "時刻書式", options: ["HH:mm", "HH:mm:ss"] },
      { key: "Font",          type: "string",  defaultValue: "MS Gothic",    label: "フォント" },
      { key: "FontSize",      type: "number",  defaultValue: "11",           label: "文字サイズ" },
      { key: "Weight",        type: "enum",    defaultValue: "Normal",       label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",         type: "string",  defaultValue: "0,0,0",        label: "文字色 (R,G,B)" },
      { key: "Align",         type: "enum",    defaultValue: "Left",         label: "配置", options: ["Left", "Center", "Right"] },
      { key: "Locked",        type: "boolean", defaultValue: "0",            label: "ロック" },
    ],
  },

  Time: {
    typeName: "Time",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "AutoInput",     type: "boolean", defaultValue: "0",         label: "自動入力" },
      { key: "TimeFormat",    type: "enum",    defaultValue: "HH:mm",     label: "時刻書式", options: ["HH:mm", "HH:mm:ss", "H:mm"] },
      { key: "FirstOnly",     type: "boolean", defaultValue: "0",         label: "初回のみ" },
      { key: "Editable",      type: "boolean", defaultValue: "1",         label: "編集可" },
      { key: "Font",          type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",      type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",        type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",         type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Align",         type: "enum",    defaultValue: "Left",      label: "配置", options: ["Left", "Center", "Right"] },
      { key: "Locked",        type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  Calculate: {
    typeName: "Calculate",
    fields: [
      { key: "Function",       type: "string",  defaultValue: "",          label: "計算式" },
      { key: "FunctionVersion", type: "number", defaultValue: "1",         label: "計算式バージョン" },
      { key: "Decimal",        type: "number",  defaultValue: "0",         label: "小数桁数" },
      { key: "Comma",          type: "boolean", defaultValue: "0",         label: "桁区切り" },
      { key: "Minimum",        type: "string",  defaultValue: "",          label: "最小値" },
      { key: "Maximum",        type: "string",  defaultValue: "",          label: "最大値" },
      { key: "DataType",       type: "enum",    defaultValue: "Numeric",   label: "データ型", options: ["Numeric", "DateTime", "String"] },
      { key: "Visible",        type: "boolean", defaultValue: "1",         label: "表示" },
      { key: "Align",          type: "enum",    defaultValue: "Right",     label: "配置", options: ["Left", "Center", "Right"] },
      { key: "Font",           type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",       type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",         type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",          type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",         type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  Select: {
    typeName: "Select",
    fields: [
      { key: "Required",    type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "Items",       type: "string",  defaultValue: "",          label: "選択肢ID (カンマ区切り)" },
      { key: "Labels",      type: "string",  defaultValue: "",          label: "選択肢ラベル (カンマ区切り)" },
      { key: "Default",     type: "string",  defaultValue: "",          label: "初期値" },
      { key: "Display",     type: "enum",    defaultValue: "Dropdown",  label: "表示形式", options: ["Dropdown", "Radio", "Button"] },
      { key: "ToggleInput", type: "boolean", defaultValue: "0",         label: "トグル入力" },
      { key: "Font",        type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",    type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Align",       type: "enum",    defaultValue: "Left",      label: "配置", options: ["Left", "Center", "Right"] },
    ],
  },

  Check: {
    typeName: "Check",
    fields: [
      { key: "Required",    type: "boolean", defaultValue: "0",           label: "必須" },
      { key: "Marker",      type: "enum",    defaultValue: "Check",       label: "マーカー", options: ["Check", "Circle", "Cross", "Fill"] },
      { key: "LineColor",   type: "string",  defaultValue: "0,0,0",       label: "線色 (R,G,B)" },
      { key: "LineWidth",   type: "number",  defaultValue: "2",           label: "線幅" },
      { key: "BrushColor",  type: "string",  defaultValue: "255,0,0",     label: "塗り色 (R,G,B)" },
      { key: "Group",       type: "string",  defaultValue: "",            label: "グループ" },
    ],
  },

  Image: {
    typeName: "Image",
    fields: [
      { key: "Required",    type: "boolean", defaultValue: "0",    label: "必須" },
      { key: "IsOriginal",  type: "boolean", defaultValue: "0",    label: "原寸表示" },
      { key: "ImageSize",   type: "number",  defaultValue: "0",    label: "画像サイズ" },
      { key: "EnableShortcut", type: "boolean", defaultValue: "0", label: "ショートカット有効" },
      { key: "PhotoDate",   type: "boolean", defaultValue: "0",    label: "撮影日時記録" },
    ],
  },

  Handwriting: {
    typeName: "Handwriting",
    fields: [
      { key: "Required",        type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "Lines",           type: "number",  defaultValue: "1",         label: "行数" },
      { key: "FontPriority",    type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Align",           type: "enum",    defaultValue: "Left",      label: "配置", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment", type: "enum",  defaultValue: "Top",       label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",        type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",          type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",           type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize", type: "boolean", defaultValue: "0",      label: "自動フォントサイズ" },
      { key: "Locked",          type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  FixedText: {
    typeName: "FixedText",
    fields: [
      { key: "Required",  type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "Lines",     type: "number",  defaultValue: "1",         label: "行数" },
      { key: "Width",     type: "number",  defaultValue: "3",         label: "線幅" },
      { key: "Color",     type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
    ],
  },

  // ─── Tier 1: 高優先度 ─────────────────────────────────────────────────────

  MultiSelect: {
    typeName: "MultiSelect",
    fields: [
      { key: "Items",        type: "string",  defaultValue: "",          label: "選択肢ID (カンマ区切り)" },
      { key: "Labels",       type: "string",  defaultValue: "",          label: "選択肢ラベル (カンマ区切り)" },
      { key: "Selected",     type: "string",  defaultValue: "",          label: "選択済み" },
      { key: "Punctuation",  type: "string",  defaultValue: ",",         label: "区切り文字" },
      { key: "Default",      type: "string",  defaultValue: "",          label: "初期値" },
      { key: "Display",      type: "enum",    defaultValue: "Dropdown",  label: "表示形式", options: ["Dropdown", "Radio", "Button"] },
      { key: "Font",         type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",     type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",       type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",        type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Align",        type: "enum",    defaultValue: "Left",      label: "配置", options: ["Left", "Center", "Right"] },
    ],
  },

  CalendarDate: {
    typeName: "CalendarDate",
    fields: [
      { key: "Required",       type: "boolean", defaultValue: "0",           label: "必須" },
      { key: "AutoInput",      type: "boolean", defaultValue: "0",           label: "自動入力" },
      { key: "DateFormat",     type: "enum",    defaultValue: "yyyy/MM/dd",  label: "日付書式", options: ["yyyy/MM/dd", "yyyy-MM-dd", "MM/dd", "yyyy年MM月dd日"] },
      { key: "FirstOnly",      type: "boolean", defaultValue: "0",           label: "初回のみ" },
      { key: "Editable",       type: "boolean", defaultValue: "1",           label: "編集可" },
      { key: "ConfirmDialog",  type: "boolean", defaultValue: "0",           label: "確認ダイアログ" },
      { key: "Day",            type: "string",  defaultValue: "",            label: "基準日オフセット" },
      { key: "UseTime",        type: "boolean", defaultValue: "0",           label: "時刻併用" },
      { key: "TimeFormat",     type: "enum",    defaultValue: "HH:mm",       label: "時刻書式", options: ["HH:mm", "HH:mm:ss"] },
      { key: "Font",           type: "string",  defaultValue: "MS Gothic",   label: "フォント" },
      { key: "FontSize",       type: "number",  defaultValue: "11",          label: "文字サイズ" },
      { key: "Weight",         type: "enum",    defaultValue: "Normal",      label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",          type: "string",  defaultValue: "0,0,0",       label: "文字色 (R,G,B)" },
      { key: "Align",          type: "enum",    defaultValue: "Left",        label: "配置", options: ["Left", "Center", "Right"] },
      { key: "Locked",         type: "boolean", defaultValue: "0",           label: "ロック" },
    ],
  },

  Create: {
    typeName: "Create",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "1",     label: "必須" },
      { key: "SignType",       type: "enum",    defaultValue: "0",     label: "署名タイプ", options: ["0", "1", "2"] },
      { key: "SignShortcut",   type: "boolean", defaultValue: "0",     label: "署名ショートカット" },
    ],
  },

  Inspect: {
    typeName: "Inspect",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "0",     label: "必須" },
      { key: "SignType",       type: "enum",    defaultValue: "0",     label: "署名タイプ", options: ["0", "1", "2"] },
      { key: "SignShortcut",   type: "boolean", defaultValue: "0",     label: "署名ショートカット" },
    ],
  },

  Approve: {
    typeName: "Approve",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "0",     label: "必須" },
      { key: "SignType",       type: "enum",    defaultValue: "0",     label: "署名タイプ", options: ["0", "1", "2"] },
      { key: "QuickSave",     type: "boolean", defaultValue: "0",     label: "クイック保存" },
      { key: "RequiredCheck",  type: "boolean", defaultValue: "0",     label: "必須チェック" },
    ],
  },

  // ─── Tier 2: 中優先度 ─────────────────────────────────────────────────────

  Numeric: {
    typeName: "Numeric",
    fields: [
      { key: "Required",    type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "Minimum",     type: "string",  defaultValue: "",          label: "最小値" },
      { key: "Maximum",     type: "string",  defaultValue: "",          label: "最大値" },
      { key: "Stepping",    type: "number",  defaultValue: "1",         label: "ステップ" },
      { key: "Decimal",     type: "number",  defaultValue: "0",         label: "小数桁数" },
      { key: "Default",     type: "string",  defaultValue: "",          label: "初期値" },
      { key: "Comma",       type: "boolean", defaultValue: "0",         label: "桁区切り" },
      { key: "Prefix",      type: "string",  defaultValue: "",          label: "接頭辞" },
      { key: "Suffix",      type: "string",  defaultValue: "",          label: "接尾辞" },
      { key: "Align",       type: "enum",    defaultValue: "Right",     label: "配置", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment", type: "enum", defaultValue: "Center", label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "Font",        type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",    type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",      type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  NumberHours: {
    typeName: "NumberHours",
    fields: [
      { key: "Required",    type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "InputType",   type: "enum",    defaultValue: "0",         label: "入力タイプ", options: ["0", "1"] },
      { key: "Maximum",     type: "string",  defaultValue: "",          label: "最大値" },
      { key: "Decimal",     type: "number",  defaultValue: "0",         label: "小数桁数" },
      { key: "TimeFormat",  type: "string",  defaultValue: "HH:mm",     label: "時間書式" },
      { key: "TimeUnit",    type: "string",  defaultValue: "",          label: "時間単位" },
      { key: "Suffix",      type: "string",  defaultValue: "",          label: "接尾辞" },
      { key: "Font",        type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",    type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",      type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  TimeCalculate: {
    typeName: "TimeCalculate",
    fields: [
      { key: "Function",          type: "string", defaultValue: "",          label: "計算式" },
      { key: "InputType",         type: "enum",   defaultValue: "0",         label: "入力タイプ", options: ["0", "1"] },
      { key: "TimeCalculateType", type: "enum",   defaultValue: "0",         label: "時刻計算タイプ", options: ["0", "1", "2"] },
      { key: "TimeFormat",        type: "string", defaultValue: "HH:mm",     label: "時刻書式" },
      { key: "DateFormat",        type: "string", defaultValue: "",          label: "日付書式" },
      { key: "TimeUnit",          type: "string", defaultValue: "",          label: "時間単位" },
      { key: "IntermissionStart", type: "string", defaultValue: "",          label: "休憩開始" },
      { key: "IntermissionEnd",   type: "string", defaultValue: "",          label: "休憩終了" },
      { key: "Font",              type: "string", defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",          type: "number", defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",            type: "enum",   defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",             type: "string", defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",            type: "boolean", defaultValue: "0",        label: "ロック" },
    ],
  },

  Registration: {
    typeName: "Registration",
    fields: [
      { key: "DisplayUserName", type: "boolean", defaultValue: "1",         label: "ユーザー名表示" },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",        type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",          type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",           type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
    ],
  },

  RegistrationDate: {
    typeName: "RegistrationDate",
    fields: [
      { key: "DateFormat",  type: "string",  defaultValue: "yyyy/MM/dd", label: "日付書式" },
      { key: "Day",         type: "string",  defaultValue: "",           label: "基準日オフセット" },
      { key: "Font",        type: "string",  defaultValue: "MS Gothic",  label: "フォント" },
      { key: "FontSize",    type: "number",  defaultValue: "11",         label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",     label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",      label: "文字色 (R,G,B)" },
    ],
  },

  LatestUpdate: {
    typeName: "LatestUpdate",
    fields: [
      { key: "DisplayUserName", type: "boolean", defaultValue: "1",         label: "ユーザー名表示" },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",        type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",          type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",           type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
    ],
  },

  LatestUpdateDate: {
    typeName: "LatestUpdateDate",
    fields: [
      { key: "DateFormat",  type: "string",  defaultValue: "yyyy/MM/dd", label: "日付書式" },
      { key: "Day",         type: "string",  defaultValue: "",           label: "基準日オフセット" },
      { key: "Font",        type: "string",  defaultValue: "MS Gothic",  label: "フォント" },
      { key: "FontSize",    type: "number",  defaultValue: "11",         label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",     label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",      label: "文字色 (R,G,B)" },
    ],
  },

  QRCode: {
    typeName: "QRCode",
    fields: [
      { key: "Required",          type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "IsNumeric",         type: "boolean", defaultValue: "0",         label: "数値のみ" },
      { key: "UseExternalDevice", type: "boolean", defaultValue: "0",         label: "外部デバイス使用" },
      { key: "Lines",             type: "number",  defaultValue: "1",         label: "行数" },
      { key: "DefaultCamera",     type: "enum",    defaultValue: "0",         label: "デフォルトカメラ", options: ["0", "1"] },
      { key: "Font",              type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",          type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",            type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",             type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",            type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  CodeReader: {
    typeName: "CodeReader",
    fields: [
      { key: "Required",  type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "Lines",     type: "number",  defaultValue: "1",         label: "行数" },
      { key: "Font",      type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",  type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",    type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",     type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",    type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  LoginUser: {
    typeName: "LoginUser",
    fields: [
      { key: "Required",        type: "boolean", defaultValue: "0",         label: "必須" },
      { key: "AutoInput",       type: "boolean", defaultValue: "0",         label: "自動入力" },
      { key: "FirstOnly",       type: "boolean", defaultValue: "0",         label: "初回のみ" },
      { key: "ConfirmDialog",   type: "boolean", defaultValue: "0",         label: "確認ダイアログ" },
      { key: "Day",             type: "string",  defaultValue: "",          label: "基準日オフセット" },
      { key: "DisplayUserName", type: "boolean", defaultValue: "1",         label: "ユーザー名表示" },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "フォント" },
      { key: "FontSize",        type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",          type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",           type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",          type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },
};

// ─── ユーティリティ ─────────────────────────────────────────────────────────

/**
 * 型名とパラメータ文字列からスキーマに基づく typed params を取得する
 * 存在しないキーはデフォルト値で補完される
 */
export function getTypedParams(
  typeName: string,
  raw: string,
): Record<string, string> {
  const parsed = parseInputParameters(raw);
  const schema = PARAMETER_SCHEMAS[typeName];
  if (!schema) return parsed;

  const result: Record<string, string> = {};
  for (const field of schema.fields) {
    result[field.key] = parsed[field.key] ?? field.defaultValue;
  }
  // スキーマ外のキーも保持
  for (const [key, value] of Object.entries(parsed)) {
    if (!(key in result)) {
      result[key] = value;
    }
  }
  return result;
}
