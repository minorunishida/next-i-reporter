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
      // 制約
      { key: "Required",            type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "AutoNumber",          type: "boolean", defaultValue: "0",         label: "自動採番" },
      // キーパッド
      { key: "CanUseCustomKeypad",  type: "boolean", defaultValue: "0",         label: "カスタムキーパッドを利用する" },
      { key: "CanUseCustomNumpad",  type: "boolean", defaultValue: "0",         label: "カスタム数字パッドを利用する" },
      // 入力制限
      { key: "InputRestriction",    type: "enum",    defaultValue: "",          label: "入力制限", options: ["", "Number", "Email", "Url"] },
      { key: "ProhibitedCharacters", type: "string", defaultValue: "",          label: "禁止文字" },
      { key: "MaxLength",           type: "number",  defaultValue: "0",         label: "最大文字数" },
      { key: "PaddingDirection",    type: "enum",    defaultValue: "",          label: "パディング方向", options: ["", "Left", "Right"] },
      { key: "PaddingCharacter",    type: "string",  defaultValue: "",          label: "パディング文字" },
      // 表示
      { key: "Lines",               type: "number",  defaultValue: "1",         label: "行数" },
      { key: "Align",               type: "enum",    defaultValue: "Left",      label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment",   type: "enum",    defaultValue: "Top",       label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      // 書体
      { key: "FontPriority",        type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Font",                type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",            type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "DefaultFontSize",     type: "number",  defaultValue: "11",        label: "デフォルト文字サイズ" },
      { key: "Weight",              type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",               type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize",  type: "boolean", defaultValue: "0",         label: "文字サイズ自動調整" },
      // その他
      { key: "DefaultText",         type: "string",  defaultValue: "",          label: "デフォルトテキスト" },
      { key: "Locked",              type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  InputNumeric: {
    typeName: "InputNumeric",
    fields: [
      // 制約
      { key: "Required",           type: "boolean", defaultValue: "0",         label: "必須入力" },
      // キーパッド
      { key: "CanUseCustomKeypad", type: "boolean", defaultValue: "0",         label: "カスタムキーパッドを利用する" },
      { key: "CanUseCustomNumpad", type: "boolean", defaultValue: "0",         label: "カスタム数字パッドを利用する" },
      { key: "KeypadMode",        type: "enum",    defaultValue: "0",         label: "テンキーモード", options: ["0", "1"] },
      // 数値入力
      { key: "Minimum",           type: "string",  defaultValue: "",          label: "最小値" },
      { key: "Maximum",           type: "string",  defaultValue: "",          label: "最大値" },
      { key: "Decimal",           type: "number",  defaultValue: "0",         label: "小数点以下ケタ数" },
      { key: "Comma",             type: "boolean", defaultValue: "0",         label: "桁区切り" },
      { key: "Prefix",            type: "string",  defaultValue: "",          label: "接頭文字" },
      { key: "Suffix",            type: "string",  defaultValue: "",          label: "接尾文字" },
      // 入力確定
      { key: "TerminationCode",   type: "string",  defaultValue: "",          label: "入力確定コード" },
      { key: "TerminationMode",   type: "enum",    defaultValue: "0",         label: "入力確定モード", options: ["0", "1"] },
      // 表示
      { key: "Align",             type: "enum",    defaultValue: "Right",     label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment", type: "enum",    defaultValue: "Center",    label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      // 書体
      { key: "FontPriority",      type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Font",              type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",          type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "DefaultFontSize",   type: "number",  defaultValue: "11",        label: "デフォルト文字サイズ" },
      { key: "Weight",            type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",             type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize", type: "boolean", defaultValue: "0",        label: "文字サイズ自動調整" },
      // その他
      { key: "Locked",            type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  Date: {
    typeName: "Date",
    fields: [
      // 制約
      { key: "Required",           type: "boolean", defaultValue: "0",            label: "必須入力" },
      { key: "AutoInput",          type: "boolean", defaultValue: "0",            label: "自動入力" },
      { key: "FirstOnly",          type: "boolean", defaultValue: "0",            label: "初回のみ" },
      { key: "Editable",           type: "boolean", defaultValue: "1",            label: "編集可" },
      { key: "ConfirmDialog",      type: "boolean", defaultValue: "0",            label: "確認ダイアログ" },
      // 書式
      { key: "DateFormat",         type: "enum",    defaultValue: "yyyy/MM/dd",   label: "日付書式", options: ["yyyy/MM/dd", "yyyy-MM-dd", "MM/dd", "yyyy年MM月dd日", "ggyy年MM月dd日"] },
      { key: "Day",                type: "string",  defaultValue: "",             label: "基準日" },
      { key: "UseTime",            type: "boolean", defaultValue: "0",            label: "時刻併用" },
      { key: "TimeFormat",         type: "enum",    defaultValue: "HH:mm",        label: "時刻書式", options: ["HH:mm", "HH:mm:ss"] },
      // 表示
      { key: "Align",              type: "enum",    defaultValue: "Left",         label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment",  type: "enum",    defaultValue: "Top",          label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      // 書体
      { key: "FontPriority",       type: "boolean", defaultValue: "0",            label: "フォント優先" },
      { key: "Font",               type: "string",  defaultValue: "MS Gothic",    label: "書体指定" },
      { key: "FontSize",           type: "number",  defaultValue: "11",           label: "文字サイズ" },
      { key: "DefaultFontSize",    type: "number",  defaultValue: "11",           label: "デフォルト文字サイズ" },
      { key: "Weight",             type: "enum",    defaultValue: "Normal",       label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",              type: "string",  defaultValue: "0,0,0",        label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize", type: "boolean", defaultValue: "0",            label: "文字サイズ自動調整" },
      // その他
      { key: "Locked",             type: "boolean", defaultValue: "0",            label: "ロック" },
    ],
  },

  Time: {
    typeName: "Time",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "AutoInput",     type: "boolean", defaultValue: "0",         label: "自動入力" },
      { key: "TimeFormat",    type: "enum",    defaultValue: "HH:mm",     label: "時刻書式", options: ["HH:mm", "HH:mm:ss", "H:mm"] },
      { key: "FirstOnly",     type: "boolean", defaultValue: "0",         label: "初回のみ" },
      { key: "Editable",      type: "boolean", defaultValue: "1",         label: "編集可" },
      { key: "Font",          type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",      type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",        type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",         type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Align",         type: "enum",    defaultValue: "Left",      label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "Locked",        type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  Calculate: {
    typeName: "Calculate",
    fields: [
      { key: "Function",       type: "string",  defaultValue: "",          label: "計算式" },
      { key: "FunctionVersion", type: "number", defaultValue: "1",         label: "計算式バージョン" },
      { key: "Decimal",        type: "number",  defaultValue: "0",         label: "小数点以下ケタ数" },
      { key: "Comma",          type: "boolean", defaultValue: "0",         label: "桁区切り" },
      { key: "Minimum",        type: "string",  defaultValue: "",          label: "最小値" },
      { key: "Maximum",        type: "string",  defaultValue: "",          label: "最大値" },
      { key: "DataType",       type: "enum",    defaultValue: "Numeric",   label: "データ型", options: ["Numeric", "DateTime", "String"] },
      { key: "Visible",        type: "boolean", defaultValue: "1",         label: "表示" },
      { key: "Align",          type: "enum",    defaultValue: "Right",     label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "Font",           type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",       type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",         type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",          type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",         type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  Select: {
    typeName: "Select",
    fields: [
      // 制約
      { key: "Required",             type: "boolean", defaultValue: "0",         label: "必須入力" },
      // 選択肢
      { key: "Items",                type: "string",  defaultValue: "",          label: "選択肢ID (カンマ区切り)" },
      { key: "Labels",               type: "string",  defaultValue: "",          label: "選択肢ラベル (カンマ区切り)" },
      { key: "PinColors",            type: "string",  defaultValue: "",          label: "ピン色 (カンマ区切り)" },
      { key: "Selected",             type: "string",  defaultValue: "",          label: "選択済み" },
      { key: "Default",              type: "string",  defaultValue: "",          label: "初期値" },
      // 表示
      { key: "Display",              type: "enum",    defaultValue: "Dropdown",  label: "表示形式", options: ["Dropdown", "Radio", "Button"] },
      { key: "ToggleInput",          type: "boolean", defaultValue: "0",         label: "トグル入力" },
      { key: "ColorManageCluster",   type: "string",  defaultValue: "",          label: "色管理クラスタ" },
      { key: "UseSelectGateway",     type: "boolean", defaultValue: "0",         label: "セレクトゲートウェイ使用" },
      { key: "LineSelectItemMode",   type: "enum",    defaultValue: "0",         label: "行選択モード", options: ["0", "1"] },
      { key: "Align",                type: "enum",    defaultValue: "Left",      label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment",    type: "enum",    defaultValue: "Top",       label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      // キーボード補助
      { key: "UseKeyboard",          type: "boolean", defaultValue: "0",         label: "キーボード入力" },
      { key: "InputRestriction",     type: "enum",    defaultValue: "",          label: "入力制限", options: ["", "Number", "Email", "Url"] },
      // 書体
      { key: "FontPriority",         type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Font",                 type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",             type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "DefaultFontSize",      type: "number",  defaultValue: "11",        label: "デフォルト文字サイズ" },
      { key: "Weight",               type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",                type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize",   type: "boolean", defaultValue: "0",         label: "文字サイズ自動調整" },
    ],
  },

  Check: {
    typeName: "Check",
    fields: [
      // 制約
      { key: "Required",         type: "boolean", defaultValue: "0",           label: "必須入力" },
      // マーカー
      { key: "Marker",           type: "enum",    defaultValue: "Check",       label: "マーカー", options: ["Check", "Circle", "Cross", "Fill"] },
      { key: "LineColor",        type: "string",  defaultValue: "0,0,0",       label: "線色 (R,G,B)" },
      { key: "LineWidth",        type: "number",  defaultValue: "2",           label: "線幅" },
      { key: "BrushColor",       type: "string",  defaultValue: "255,0,0",     label: "塗り色 (R,G,B)" },
      // グループ
      { key: "Group",            type: "string",  defaultValue: "",            label: "グループ" },
      // キーボード補助
      { key: "UseKeyboard",      type: "boolean", defaultValue: "0",           label: "キーボード入力" },
      { key: "InputRestriction", type: "enum",    defaultValue: "",            label: "入力制限", options: ["", "Number", "Email", "Url"] },
    ],
  },

  Image: {
    typeName: "Image",
    fields: [
      // 制約
      { key: "Required",        type: "boolean", defaultValue: "0",  label: "必須入力" },
      // タブレットのカメラ起動
      { key: "EnableShortcut",  type: "boolean", defaultValue: "0",  label: "カメラの選択をせずにカメラを起動する" },
      // 撮影日時表示
      { key: "PhotoDate",       type: "enum",    defaultValue: "0",  label: "撮影日時表示", options: ["0", "1", "2"] },
      // 画像の解像度
      { key: "IsOriginal",     type: "enum",     defaultValue: "0",  label: "画像の解像度", options: ["0", "1", "2"] },
      { key: "ImageSize",      type: "number",   defaultValue: "0",  label: "ピクセル指定サイズ" },
    ],
  },

  Handwriting: {
    typeName: "Handwriting",
    fields: [
      { key: "Required",        type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "Lines",           type: "number",  defaultValue: "1",         label: "行数" },
      { key: "FontPriority",    type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Align",           type: "enum",    defaultValue: "Left",      label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment", type: "enum",  defaultValue: "Top",       label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
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
      { key: "Required",  type: "boolean", defaultValue: "0",         label: "必須入力" },
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
      { key: "Font",         type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",     type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",       type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",        type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Align",        type: "enum",    defaultValue: "Left",      label: "配置指定", options: ["Left", "Center", "Right"] },
    ],
  },

  CalendarDate: {
    typeName: "CalendarDate",
    fields: [
      { key: "Required",       type: "boolean", defaultValue: "0",           label: "必須入力" },
      { key: "AutoInput",      type: "boolean", defaultValue: "0",           label: "自動入力" },
      { key: "DateFormat",     type: "enum",    defaultValue: "yyyy/MM/dd",  label: "日付書式", options: ["yyyy/MM/dd", "yyyy-MM-dd", "MM/dd", "yyyy年MM月dd日"] },
      { key: "FirstOnly",      type: "boolean", defaultValue: "0",           label: "初回のみ" },
      { key: "Editable",       type: "boolean", defaultValue: "1",           label: "編集可" },
      { key: "ConfirmDialog",  type: "boolean", defaultValue: "0",           label: "確認ダイアログ" },
      { key: "Day",            type: "string",  defaultValue: "",            label: "基準日オフセット" },
      { key: "UseTime",        type: "boolean", defaultValue: "0",           label: "時刻併用" },
      { key: "TimeFormat",     type: "enum",    defaultValue: "HH:mm",       label: "時刻書式", options: ["HH:mm", "HH:mm:ss"] },
      { key: "Font",           type: "string",  defaultValue: "MS Gothic",   label: "書体指定" },
      { key: "FontSize",       type: "number",  defaultValue: "11",          label: "文字サイズ" },
      { key: "Weight",         type: "enum",    defaultValue: "Normal",      label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",          type: "string",  defaultValue: "0,0,0",       label: "文字色 (R,G,B)" },
      { key: "Align",          type: "enum",    defaultValue: "Left",        label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "Locked",         type: "boolean", defaultValue: "0",           label: "ロック" },
    ],
  },

  Create: {
    typeName: "Create",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "1",     label: "必須入力" },
      { key: "SignType",       type: "enum",    defaultValue: "0",     label: "署名タイプ", options: ["0", "1", "2"] },
      { key: "SignShortcut",   type: "boolean", defaultValue: "0",     label: "署名ショートカット" },
    ],
  },

  Inspect: {
    typeName: "Inspect",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "0",     label: "必須入力" },
      { key: "SignType",       type: "enum",    defaultValue: "0",     label: "署名タイプ", options: ["0", "1", "2"] },
      { key: "SignShortcut",   type: "boolean", defaultValue: "0",     label: "署名ショートカット" },
    ],
  },

  Approve: {
    typeName: "Approve",
    fields: [
      { key: "Required",      type: "boolean", defaultValue: "0",     label: "必須入力" },
      { key: "SignType",       type: "enum",    defaultValue: "0",     label: "署名タイプ", options: ["0", "1", "2"] },
      { key: "QuickSave",     type: "boolean", defaultValue: "0",     label: "クイック保存" },
      { key: "RequiredCheck",  type: "boolean", defaultValue: "0",     label: "必須チェック" },
    ],
  },

  // ─── Tier 2: 中優先度 ─────────────────────────────────────────────────────

  Numeric: {
    typeName: "Numeric",
    fields: [
      // 制約
      { key: "Required",          type: "boolean", defaultValue: "0",         label: "必須入力" },
      // 数値範囲
      { key: "Minimum",           type: "string",  defaultValue: "",          label: "最小値" },
      { key: "MinCluster",        type: "string",  defaultValue: "",          label: "最小値クラスタ" },
      { key: "Maximum",           type: "string",  defaultValue: "",          label: "最大値" },
      { key: "MaxCluster",        type: "string",  defaultValue: "",          label: "最大値クラスタ" },
      { key: "Stepping",          type: "number",  defaultValue: "1",         label: "ステップ" },
      { key: "Decimal",           type: "number",  defaultValue: "0",         label: "小数点以下ケタ数" },
      { key: "TruncateZeroMode",  type: "enum",    defaultValue: "0",         label: "ゼロ省略", options: ["0", "1"] },
      { key: "ShowPercent",       type: "boolean", defaultValue: "0",         label: "パーセント表示" },
      { key: "Default",           type: "string",  defaultValue: "",          label: "初期値" },
      { key: "Selected",          type: "string",  defaultValue: "",          label: "選択値" },
      // 表示
      { key: "Comma",             type: "boolean", defaultValue: "0",         label: "桁区切り" },
      { key: "Prefix",            type: "string",  defaultValue: "",          label: "接頭文字" },
      { key: "Suffix",            type: "string",  defaultValue: "",          label: "接尾文字" },
      { key: "Align",             type: "enum",    defaultValue: "Right",     label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment", type: "enum",    defaultValue: "Center",    label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      // カウンター
      { key: "CounterMode",       type: "boolean", defaultValue: "0",         label: "カウンターモード" },
      // 書体
      { key: "FontPriority",      type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Font",              type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",          type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "DefaultFontSize",   type: "number",  defaultValue: "11",        label: "デフォルト文字サイズ" },
      { key: "Weight",            type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",             type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize", type: "boolean", defaultValue: "0",        label: "文字サイズ自動調整" },
      // その他
      { key: "Locked",            type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  NumberHours: {
    typeName: "NumberHours",
    fields: [
      { key: "Required",    type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "InputType",   type: "enum",    defaultValue: "0",         label: "入力タイプ", options: ["0", "1"] },
      { key: "Maximum",     type: "string",  defaultValue: "",          label: "最大値" },
      { key: "Decimal",     type: "number",  defaultValue: "0",         label: "小数点以下ケタ数" },
      { key: "TimeFormat",  type: "string",  defaultValue: "HH:mm",     label: "時間書式" },
      { key: "TimeUnit",    type: "string",  defaultValue: "",          label: "時間単位" },
      { key: "Suffix",      type: "string",  defaultValue: "",          label: "接尾文字" },
      { key: "Font",        type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
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
      { key: "Font",              type: "string", defaultValue: "MS Gothic", label: "書体指定" },
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
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
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
      { key: "Font",        type: "string",  defaultValue: "MS Gothic",  label: "書体指定" },
      { key: "FontSize",    type: "number",  defaultValue: "11",         label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",     label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",      label: "文字色 (R,G,B)" },
    ],
  },

  LatestUpdate: {
    typeName: "LatestUpdate",
    fields: [
      { key: "DisplayUserName", type: "boolean", defaultValue: "1",         label: "ユーザー名表示" },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
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
      { key: "Font",        type: "string",  defaultValue: "MS Gothic",  label: "書体指定" },
      { key: "FontSize",    type: "number",  defaultValue: "11",         label: "文字サイズ" },
      { key: "Weight",      type: "enum",    defaultValue: "Normal",     label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",       type: "string",  defaultValue: "0,0,0",      label: "文字色 (R,G,B)" },
    ],
  },

  QRCode: {
    typeName: "QRCode",
    fields: [
      { key: "Required",          type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "IsNumeric",         type: "boolean", defaultValue: "0",         label: "数値のみ" },
      { key: "UseExternalDevice", type: "boolean", defaultValue: "0",         label: "外部デバイス使用" },
      { key: "Lines",             type: "number",  defaultValue: "1",         label: "行数" },
      { key: "DefaultCamera",     type: "enum",    defaultValue: "0",         label: "デフォルトカメラ", options: ["0", "1"] },
      { key: "Font",              type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",          type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",            type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",             type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",            type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  CodeReader: {
    typeName: "CodeReader",
    fields: [
      { key: "Required",  type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "Lines",     type: "number",  defaultValue: "1",         label: "行数" },
      { key: "Font",      type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",  type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",    type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",     type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",    type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  LoginUser: {
    typeName: "LoginUser",
    fields: [
      { key: "Required",        type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "AutoInput",       type: "boolean", defaultValue: "0",         label: "自動入力" },
      { key: "FirstOnly",       type: "boolean", defaultValue: "0",         label: "初回のみ" },
      { key: "ConfirmDialog",   type: "boolean", defaultValue: "0",         label: "確認ダイアログ" },
      { key: "Day",             type: "string",  defaultValue: "",          label: "基準日オフセット" },
      { key: "DisplayUserName", type: "boolean", defaultValue: "1",         label: "ユーザー名表示" },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",        type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",          type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",           type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",          type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  // ─── Tier 3: 特殊型 (Action/AudioRecording はキー一覧待ち) ────────────────

  FreeText: {
    typeName: "FreeText",
    fields: [
      { key: "Width",          type: "number",  defaultValue: "3",   label: "線幅" },
      { key: "Color",          type: "string",  defaultValue: "0,0,0", label: "色 (R,G,B)" },
      { key: "EnableShortcut", type: "boolean", defaultValue: "0",   label: "ショートカット有効" },
      { key: "PhotoDate",      type: "boolean", defaultValue: "0",   label: "撮影日時記録" },
    ],
  },

  FreeDraw: {
    typeName: "FreeDraw",
    fields: [
      { key: "Width",              type: "number",  defaultValue: "3",     label: "線幅" },
      { key: "Color",              type: "string",  defaultValue: "0,0,0", label: "色 (R,G,B)" },
      { key: "IsOriginal",         type: "boolean", defaultValue: "0",     label: "原寸表示" },
      { key: "ImageSize",          type: "number",  defaultValue: "0",     label: "画像サイズ" },
      { key: "EnableShortcut",     type: "boolean", defaultValue: "0",     label: "ショートカット有効" },
      { key: "PhotoDate",          type: "boolean", defaultValue: "0",     label: "撮影日時記録" },
      { key: "AutoStartCamera",    type: "boolean", defaultValue: "0",     label: "カメラ自動起動" },
      { key: "IsOriginalWhole",    type: "boolean", defaultValue: "0",     label: "全体原寸" },
      { key: "WholeImageSize",     type: "number",  defaultValue: "0",     label: "全体画像サイズ" },
      { key: "InternalImageFormat", type: "enum",   defaultValue: "0",     label: "内部画像フォーマット", options: ["0", "1"] },
    ],
  },

  MultipleChoiceNumber: {
    typeName: "MultipleChoiceNumber",
    fields: [
      { key: "Items",        type: "string",  defaultValue: "",          label: "選択肢ID (カンマ区切り)" },
      { key: "Labels",       type: "string",  defaultValue: "",          label: "選択肢ラベル (カンマ区切り)" },
      { key: "Colors",       type: "string",  defaultValue: "",          label: "色 (カンマ区切り)" },
      { key: "Markers",      type: "string",  defaultValue: "",          label: "マーカー (カンマ区切り)" },
      { key: "BrushColors",  type: "string",  defaultValue: "",          label: "塗り色 (カンマ区切り)" },
      { key: "ClearOption",  type: "boolean", defaultValue: "0",         label: "クリア選択肢" },
      { key: "Group",        type: "string",  defaultValue: "",          label: "グループ" },
    ],
  },

  MCNCalculate: {
    typeName: "MCNCalculate",
    fields: [
      { key: "Group",            type: "string",  defaultValue: "",          label: "グループ" },
      { key: "TotalLabels",      type: "string",  defaultValue: "",          label: "集計ラベル" },
      { key: "DenominatorLabel", type: "string",  defaultValue: "",          label: "分母ラベル" },
      { key: "OutsideLabels",    type: "string",  defaultValue: "",          label: "除外ラベル" },
      { key: "Decimal",          type: "number",  defaultValue: "0",         label: "小数点以下ケタ数" },
      { key: "Comma",            type: "boolean", defaultValue: "0",         label: "桁区切り" },
      { key: "Font",             type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",         type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",           type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",            type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
    ],
  },

  Gps: {
    typeName: "Gps",
    fields: [
      { key: "Font",     type: "string", defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize", type: "number", defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",   type: "enum",   defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",    type: "string", defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
    ],
  },

  SelectMaster: {
    typeName: "SelectMaster",
    fields: [
      { key: "MasterTableId",   type: "string",  defaultValue: "",          label: "マスターテーブルID" },
      { key: "MasterTableName", type: "string",  defaultValue: "",          label: "マスターテーブル名" },
      { key: "MasterFieldNo",   type: "number",  defaultValue: "0",         label: "マスターフィールド番号" },
      { key: "MasterFieldName", type: "string",  defaultValue: "",          label: "マスターフィールド名" },
      { key: "Group",           type: "string",  defaultValue: "",          label: "グループ" },
      { key: "GroupIndex",      type: "number",  defaultValue: "0",         label: "グループインデックス" },
      { key: "GatewayMode",     type: "enum",    defaultValue: "0",         label: "ゲートウェイモード", options: ["0", "1", "2"] },
      { key: "Font",            type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",        type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",          type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",           type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
    ],
  },

  DrawingImage: {
    typeName: "DrawingImage",
    fields: [
      { key: "PinDefaultColor",                    type: "string",  defaultValue: "", label: "ピンデフォルト色" },
      { key: "PinDetailViewHorizontalPosition",     type: "string",  defaultValue: "", label: "ピン詳細 水平位置" },
      { key: "PinDetailViewVerticalPosition",       type: "string",  defaultValue: "", label: "ピン詳細 垂直位置" },
      { key: "EnableShortcut",                      type: "boolean", defaultValue: "0", label: "ショートカット有効" },
      { key: "Locked",                              type: "boolean", defaultValue: "0", label: "ロック" },
    ],
  },

  DrawingPinNo: {
    typeName: "DrawingPinNo",
    fields: [
      { key: "PinNoType", type: "enum",    defaultValue: "0",         label: "ピンNo.タイプ", options: ["0", "1"] },
      { key: "Font",      type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",  type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",    type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",     type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",    type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  PinItemTableNo: {
    typeName: "PinItemTableNo",
    fields: [
      { key: "Font",     type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize", type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",   type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",    type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",   type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  Scandit: {
    typeName: "Scandit",
    fields: [
      { key: "ScanditMode",      type: "enum",    defaultValue: "0",         label: "スキャンモード", options: ["0", "1"] },
      { key: "DisplayString",    type: "string",  defaultValue: "",          label: "表示文字列" },
      { key: "BackgroundColor",  type: "string",  defaultValue: "",          label: "背景色" },
      { key: "FontPriority",     type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "IsNumeric",        type: "boolean", defaultValue: "0",         label: "数値のみ" },
      { key: "DefaultCamera",    type: "enum",    defaultValue: "0",         label: "デフォルトカメラ", options: ["0", "1"] },
      { key: "Font",             type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",         type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",           type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",            type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",           type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  EdgeOCR: {
    typeName: "EdgeOCR",
    fields: [
      { key: "DisplayString",    type: "string",  defaultValue: "",          label: "表示文字列" },
      { key: "BackgroundColor",  type: "string",  defaultValue: "",          label: "背景色" },
      { key: "FontPriority",     type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "IsNumeric",        type: "boolean", defaultValue: "0",         label: "数値のみ" },
      { key: "DefaultCamera",    type: "enum",    defaultValue: "0",         label: "デフォルトカメラ", options: ["0", "1"] },
      { key: "Font",             type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",         type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "Weight",           type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",            type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "Locked",           type: "boolean", defaultValue: "0",         label: "ロック" },
    ],
  },

  // ─── Action (56 キー: input-parameters-ui-labels.md §4 完全準拠) ──────────

  Action: {
    typeName: "Action",
    fields: [
      { key: "Required",              type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "ButtonFontPriority",    type: "boolean", defaultValue: "0",         label: "ボタンフォント優先" },
      { key: "ButtonLines",           type: "number",  defaultValue: "1",         label: "ボタン行数" },
      { key: "ButtonFontAlign",       type: "enum",    defaultValue: "Center",    label: "ボタン配置指定", options: ["Left", "Center", "Right"] },
      { key: "ButtonFontVerticalAlignment", type: "enum", defaultValue: "Center", label: "ボタン垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "ButtonFont",            type: "string",  defaultValue: "MS Gothic", label: "ボタン書体" },
      { key: "ButtonFontSize",        type: "number",  defaultValue: "11",        label: "ボタン文字サイズ" },
      { key: "DefaultButtonFontSize", type: "number",  defaultValue: "11",        label: "ボタンデフォルト文字サイズ" },
      { key: "ButtonFontColor",       type: "string",  defaultValue: "0,0,0",     label: "ボタン文字色" },
      { key: "ButtonWeight",          type: "enum",    defaultValue: "Normal",    label: "ボタン太さ", options: ["Normal", "Bold"] },
      { key: "EnableAutoFontSize",    type: "boolean", defaultValue: "0",         label: "自動フォントサイズ" },
      { key: "OutputVisible",         type: "boolean", defaultValue: "1",         label: "出力表示" },
      { key: "ButtonMode",            type: "enum",    defaultValue: "0",         label: "ボタンモード", options: ["0", "1"] },
      { key: "LineVisible",           type: "boolean", defaultValue: "1",         label: "罫線表示" },
      { key: "DisplayString",         type: "string",  defaultValue: "",          label: "表示文字列" },
      { key: "ButtonAlign",           type: "enum",    defaultValue: "Center",    label: "ボタン配置指定", options: ["Left", "Center", "Right"] },
      { key: "BackgroundColor",       type: "string",  defaultValue: "",          label: "背景色" },
      { key: "ActionType",            type: "enum",    defaultValue: "0",         label: "アクションタイプ", options: ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10"] },
      { key: "DocumentId",            type: "string",  defaultValue: "",          label: "文書ID" },
      { key: "FinishMessage",         type: "string",  defaultValue: "",          label: "完了メッセージ" },
      { key: "JumpSheetNo",           type: "number",  defaultValue: "0",         label: "ジャンプ先シート" },
      { key: "Menu",                  type: "string",  defaultValue: "",          label: "メニュー" },
      { key: "NoNeedToFillOutCluster", type: "string", defaultValue: "",          label: "記入不要クラスタ" },
      { key: "URLToOpen",             type: "string",  defaultValue: "",          label: "URL" },
      { key: "TokenText",             type: "string",  defaultValue: "",          label: "トークン文字列" },
      { key: "ScheduledTime",         type: "string",  defaultValue: "",          label: "予定時刻" },
      { key: "GatewayMethod",         type: "enum",    defaultValue: "0",         label: "ゲートウェイ方式", options: ["0", "1"] },
      { key: "CopyCount",             type: "number",  defaultValue: "0",         label: "コピー数" },
      { key: "CopyValue",             type: "string",  defaultValue: "",          label: "コピー値" },
      { key: "UseReportCopySetting",  type: "boolean", defaultValue: "0",         label: "帳票コピー設定使用" },
      { key: "Command",               type: "string",  defaultValue: "",          label: "コマンド" },
      { key: "ReturnValue",           type: "string",  defaultValue: "",          label: "戻り値" },
      { key: "ReturnErrorMessage",    type: "string",  defaultValue: "",          label: "エラーメッセージ" },
      { key: "OutputFileName",        type: "string",  defaultValue: "",          label: "出力ファイル名" },
      { key: "OutputTextMode",        type: "enum",    defaultValue: "0",         label: "出力テキストモード", options: ["0", "1"] },
      { key: "FilePath",              type: "string",  defaultValue: "",          label: "ファイルパス" },
      { key: "Editable",              type: "boolean", defaultValue: "0",         label: "編集可" },
      { key: "DeleteFile",            type: "boolean", defaultValue: "0",         label: "ファイル削除" },
      { key: "MultipleExecution",     type: "boolean", defaultValue: "0",         label: "複数実行" },
      { key: "QRCodeFrom",            type: "string",  defaultValue: "",          label: "QRコード元" },
      { key: "QRCodeTo",              type: "string",  defaultValue: "",          label: "QRコード先" },
      { key: "QRCodeMessage",         type: "string",  defaultValue: "",          label: "QRコードメッセージ" },
      { key: "ConfirmDialog",         type: "boolean", defaultValue: "0",         label: "確認ダイアログ" },
      { key: "ClearConfirmMode",      type: "enum",    defaultValue: "0",         label: "クリア確認モード", options: ["0", "1"] },
      { key: "FontPriority",          type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Lines",                 type: "number",  defaultValue: "1",         label: "行数" },
      { key: "Align",                 type: "enum",    defaultValue: "Left",      label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment",     type: "enum",    defaultValue: "Top",       label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "Font",                  type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",              type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "DefaultFontSize",       type: "number",  defaultValue: "11",        label: "デフォルト文字サイズ" },
      { key: "FontColor",             type: "string",  defaultValue: "0,0,0",     label: "文字色" },
      { key: "Weight",                type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "BmSetLoginUserId",      type: "boolean", defaultValue: "0",         label: "BM ログインユーザーID" },
      { key: "BmSuccessMessage",      type: "string",  defaultValue: "",          label: "BM 成功メッセージ" },
      { key: "WindowsMode",           type: "boolean", defaultValue: "0",         label: "Windows モード" },
    ],
  },

  // ─── AudioRecording (input-parameters-ui-labels.md §3 準拠) ───────────────

  AudioRecording: {
    typeName: "AudioRecording",
    fields: [
      { key: "Required",                  type: "boolean", defaultValue: "0",         label: "必須入力" },
      { key: "RecordingTime",             type: "number",  defaultValue: "60",        label: "最大録音時間" },
      { key: "DisplayMode",              type: "enum",    defaultValue: "0",         label: "クラスターの表示", options: ["0", "1"] },
      { key: "Message",                   type: "string",  defaultValue: "",          label: "録音前メッセージ" },
      { key: "BackgroundColor",           type: "string",  defaultValue: "",          label: "録音前背景色" },
      { key: "FontPriority",              type: "boolean", defaultValue: "0",         label: "フォント優先" },
      { key: "Lines",                     type: "number",  defaultValue: "1",         label: "行数" },
      { key: "Align",                     type: "enum",    defaultValue: "Left",      label: "配置指定", options: ["Left", "Center", "Right"] },
      { key: "VerticalAlignment",         type: "enum",    defaultValue: "Top",       label: "垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "Font",                      type: "string",  defaultValue: "MS Gothic", label: "書体指定" },
      { key: "FontSize",                  type: "number",  defaultValue: "11",        label: "文字サイズ" },
      { key: "DefaultFontSize",           type: "number",  defaultValue: "11",        label: "デフォルト文字サイズ" },
      { key: "Weight",                    type: "enum",    defaultValue: "Normal",    label: "太さ", options: ["Normal", "Bold"] },
      { key: "Color",                     type: "string",  defaultValue: "0,0,0",     label: "文字色 (R,G,B)" },
      { key: "EnableAutoFontSize",        type: "boolean", defaultValue: "0",         label: "自動フォントサイズ" },
      { key: "RecordedMessage",           type: "string",  defaultValue: "",          label: "録音後メッセージ" },
      { key: "RecordedBackgroundColor",   type: "string",  defaultValue: "",          label: "録音後背景色" },
      { key: "RecordedFontPriority",      type: "boolean", defaultValue: "0",         label: "録音後フォント優先" },
      { key: "RecordedLines",             type: "number",  defaultValue: "1",         label: "録音後行数" },
      { key: "RecordedAlign",             type: "enum",    defaultValue: "Left",      label: "録音後配置指定", options: ["Left", "Center", "Right"] },
      { key: "RecordedVerticalAlignment", type: "enum",    defaultValue: "Top",       label: "録音後垂直配置", options: ["Top", "Center", "Bottom"] },
      { key: "RecordedFont",              type: "string",  defaultValue: "MS Gothic", label: "録音後書体指定" },
      { key: "RecordedFontSize",          type: "number",  defaultValue: "11",        label: "録音後文字サイズ" },
      { key: "DefaultRecordedFontSize",   type: "number",  defaultValue: "11",        label: "録音後デフォルト文字サイズ" },
      { key: "RecordedWeight",            type: "enum",    defaultValue: "Normal",    label: "録音後太さ", options: ["Normal", "Bold"] },
      { key: "RecordedColor",             type: "string",  defaultValue: "0,0,0",     label: "録音後文字色 (R,G,B)" },
      { key: "Locked",                    type: "boolean", defaultValue: "0",         label: "ロック" },
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
