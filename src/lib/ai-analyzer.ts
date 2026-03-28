import OpenAI from "openai";
import type {
  FormStructure,
  SheetStructure,
  ClusterDefinition,
  AnalysisResult,
} from "./form-structure";
import { applySmartDefaults } from "./smart-defaults";
import { removeOverlaps } from "./overlap-utils";

const openai = new OpenAI();
const MODEL = process.env.OPENAI_MODEL ?? "gpt-5.1";

const SYSTEM_PROMPT = `あなたは ConMas i-Reporter の帳票設計エキスパートです。

Excelファイルのセル構造情報 (JSON) を受け取り、各セルが帳票上のどのような入力項目（クラスター）に対応するかを推測してください。

## クラスター型の判断基準

### テキスト系
- KeyboardText (30): テキストを入力する空白セル。名前、住所、担当者名など。
- FixedText (20): 手書きノート形式。線の上に手書きする入力エリア。

### 数値・計算系
- InputNumeric (65): 数値を入力するセル（「温度」「数量」「金額」の隣、数値書式）。
- Numeric (60): 数値選択（ドラムロール）。上下限・ステップが明確な数値。
- Calculate (67): Excel数式があるセル（合計、小計、税額など）。数式の内容から計算式を推測。
- NumberHours (110): 時間数入力。「作業時間」「残業時間」など。
- TimeCalculate (55): 時刻計算。2つの時刻の差分（勤務時間＝退勤−出勤）。

### 日付・時刻系
- Date (40): 日付を入力するセル（「日付」「年月日」の隣、日付書式）。
- CalendarDate (111): カレンダーから日付を選ぶセル。Date と同等だがカレンダーUI。
- Time (50): 時刻を入力するセル。

### 選択・チェック系
- Select (70): 選択肢から1つ選ぶセル（入力規則リスト、税率区分など）。
- MultiSelect (80): 複数選択可能なセル。
- Check (90): チェックボックス的なセル（✓、○、×）。

### メディア系
- Image (100): 画像・写真を配置する大きな結合セル。
- Handwriting (119): 手書き署名・印鑑用の結合セル（「サイン」「署名」「印」の近く）。

### ワークフロー系
- Create (116): 作成者スタンプ欄（帳票発行者、「作成」「発行者」の近く）。
- Inspect (117): 査閲者スタンプ欄（「査閲」「確認者」の近く）。
- Approve (118): 承認者スタンプ欄（「承認」「承認者」の近く）。
- Registration (112): 帳票登録者（自動表示、「登録者」の近く）。
- RegistrationDate (113): 帳票登録年月日（自動表示、「登録日」の近く）。
- LatestUpdate (114): 帳票更新者（自動表示）。
- LatestUpdateDate (115): 帳票更新年月日（自動表示）。

### 読取系
- QRCode (121): バーコード・QRコード読取欄。
- CodeReader (122): コードリーダー入力欄。
- LoginUser (127): ログインユーザー名表示欄（「記入者」「担当者」で自動入力）。

## 判断のポイント

1. 空白セルで、近くにラベルがあれば入力クラスター（KeyboardText, InputNumeric, Date等）
2. 値が入っているだけのセル（ラベル・見出し・タイトル）はスキップする。クラスターにしない
3. 数式セルは Calculate (67) にする。数式の内容も formula に含める
4. セルの書式（numberFormat）がヒント: 日付書式 → Date、通貨/数値書式 → InputNumeric
5. 大きな結合セル + 空白 → 候補: Image, Handwriting, KeyboardText（備考欄）
6. 空白セルでも意味のある入力欄でなければスキップ（罫線だけのセルなど）
7. 「作成」「確認」「承認」ラベルの隣の空白 → Create/Inspect/Approve（ワークフロースタンプ）
8. 「登録者」「更新者」「登録日」「更新日」→ Registration/LatestUpdate 系（readOnly=true）
9. 「記入者」「担当者」で自動入力が期待される → LoginUser
10. 2つの時刻の差分計算が期待される → TimeCalculate
11. 「作業時間(h)」のように時間数の入力 → NumberHours

## confidence (自信度) の基準

- 0.95: 明らかに数式 (Calculate) または書式から確実に判定できる
- 0.85-0.95: 書式や隣接ラベルから高い確度で推測できる
- 0.70-0.85: 推測に基づくが妥当（空白セルの用途推測）
- 0.50-0.70: 不確実。ユーザー確認が必要

## inputParameters の生成規則

セミコロン区切りの key=value 形式。主要な型のテンプレート:
- KeyboardText: "Required=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"
- InputNumeric: "Required=0;Decimal=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"
  - 金額なら "Comma=1" を追加、小数があれば "Decimal=桁数" を設定
- Date / CalendarDate: "Required=0;DateFormat=yyyy/MM/dd;AutoInput=0;Align=Left;Font=MS Gothic;FontSize=11"
- Time: "Required=0;TimeFormat=HH:mm;AutoInput=0;Align=Left;Font=MS Gothic;FontSize=11"
- Calculate: "Decimal=0;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"
- Select: "Required=0;Display=Dropdown;Font=MS Gothic;FontSize=11"
- MultiSelect: "Display=Dropdown;Punctuation=,;Font=MS Gothic;FontSize=11"
- Check: "Required=0;Marker=Check"
- Create: "Required=1;SignType=0"
- Inspect / Approve: "Required=0;SignType=0"
- Registration / LatestUpdate: "DisplayUserName=1;Font=MS Gothic;FontSize=11"
- RegistrationDate / LatestUpdateDate: "DateFormat=yyyy/MM/dd;Font=MS Gothic;FontSize=11"
- LoginUser: "Required=0;AutoInput=0;DisplayUserName=1;Font=MS Gothic;FontSize=11"
- NumberHours: "Required=0;InputType=0;TimeFormat=HH:mm;Font=MS Gothic;FontSize=11"
- TimeCalculate: "TimeFormat=HH:mm;TimeCalculateType=0;Font=MS Gothic;FontSize=11"
- QRCode: "Required=0;IsNumeric=0;Lines=1;Font=MS Gothic;FontSize=11"
- FixedText: "Required=0;Lines=1;Width=3;Color=0,0,0"

## 重要: 漏れなく検出すること

この帳票がどんな種類（点検シート、温度管理表、請求書、作業日報、チェックリスト等）であっても、すべての意味のあるセルをクラスターとして出力してください。

1. **ラベル・見出しはスキップ**: テキストが入っているだけのラベルセルはクラスターにしない（PDF背景で表示される）
2. **入力欄**: 空白セルでも、隣にラベルがあれば入力クラスターとして検出。文脈から型を推測:
   - テキスト系 → KeyboardText / FixedText
   - 数値系 → InputNumeric / Numeric
   - 日付系 → Date / CalendarDate
   - 時刻系 → Time / NumberHours
   - 選択系 → Select / MultiSelect
   - チェック系 → Check
3. **数式セル** (Calculate): formula フィールドに元の数式を含める。時刻の差分は TimeCalculate
4. **テーブル構造**: ヘッダー行はスキップし、入力行の各セルを個別に検出
5. **大きな空白結合セル**: 文脈から推測 (備考→KeyboardText、写真→Image、署名→Handwriting)
6. **ワークフロー欄**: 「作成」「確認」「承認」「査閲」ラベルの隣 → Create/Inspect/Approve
7. **自動入力欄**: 「登録者」→Registration、「登録日」→RegistrationDate、「更新者」→LatestUpdate、「更新日」→LatestUpdateDate。これらは readOnly=true

セルに値がなくても「タブレットで入力されるべき欄」ならクラスターとして検出すること。
帳票の規模に応じて適切な数のクラスターを検出してください（小規模: 10-20件、中規模: 20-50件、大規模: 50件以上）。
装飾だけの空白セル（罫線のみで意味のない空白）はスキップしてOKです。`;

/**
 * FormStructure を AI に送り、クラスター定義を推測させる
 */
export async function analyzeForm(
  formStructure: FormStructure
): Promise<AnalysisResult> {
  // 各シートを並列で解析
  const sheetResults = await Promise.all(
    formStructure.sheets.map((sheet) => analyzeSheet(sheet))
  );
  const allClusters = removeOverlaps(applySmartDefaults(sheetResults.flat()));

  const highConfidence = allClusters.filter((c) => c.confidence >= 0.9).length;
  const mediumConfidence = allClusters.filter(
    (c) => c.confidence >= 0.7 && c.confidence < 0.9
  ).length;
  const lowConfidence = allClusters.filter((c) => c.confidence < 0.7).length;

  return {
    formStructure,
    clusters: allClusters,
    summary: {
      totalClusters: allClusters.length,
      highConfidence,
      mediumConfidence,
      lowConfidence,
    },
  };
}

async function analyzeSheet(
  sheet: SheetStructure
): Promise<ClusterDefinition[]> {
  // 意味のあるセルだけをフィルタ (トークン節約 + 精度向上)
  const meaningfulCells = sheet.cells.filter((c) => {
    // 値があるセル → 常に含める (ラベル、データ)
    if (c.value) return true;
    // 数式があるセル → 常に含める
    if (c.formula) return true;
    // 結合セル → 入力欄の候補 (備考、画像、署名)
    if (c.isMerged) return true;
    // データ入力規則があるセル → 選択肢
    if (c.dataValidation) return true;
    // 罫線で囲まれた空白セル → 入力欄の候補
    if (c.style.borderTop || c.style.borderBottom || c.style.borderLeft || c.style.borderRight) return true;
    // 背景色がある空白セル → 入力欄の候補
    if (c.style.bgColor) return true;
    return false;
  });

  // AI に渡すセル情報を簡略化
  const cellsSummary = meaningfulCells.map((c) => ({
    addr: c.address,
    r: c.row,
    c: c.col,
    val: c.value || undefined,
    formula: c.formula || undefined,
    merged: c.isMerged || undefined,
    mr: c.mergeRange
      ? `${c.mergeRange.startRow},${c.mergeRange.startCol}:${c.mergeRange.endRow},${c.mergeRange.endCol}`
      : undefined,
    rgn: c.region,
    fmt: c.style.numberFormat || undefined,
    bold: c.style.bold || undefined,
    bg: c.style.bgColor || undefined,
    align: c.style.horizontalAlignment || undefined,
    dv: c.dataValidation || undefined,
  }));

  const userMessage = JSON.stringify(
    {
      sheetName: sheet.name,
      sheetIndex: sheet.index,
      size: { rows: sheet.rowCount, cols: sheet.colCount },
      cells: cellsSummary,
    },
    null,
    0
  );

  const response = await openai.responses.create({
    model: MODEL,
    instructions: SYSTEM_PROMPT,
    input: userMessage,
    text: {
      format: {
        type: "json_schema",
        name: "cluster_analysis",
        strict: true,
        schema: {
          type: "object",
          properties: {
            clusters: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  name: { type: "string", description: "クラスター名 (日本語)" },
                  typeName: {
                    type: "string",
                    enum: [
                      "KeyboardText", "FixedText",
                      "InputNumeric", "Numeric", "Calculate", "NumberHours", "TimeCalculate",
                      "Date", "CalendarDate", "Time",
                      "Select", "MultiSelect", "Check",
                      "Image", "Handwriting",
                      "Create", "Inspect", "Approve",
                      "Registration", "RegistrationDate", "LatestUpdate", "LatestUpdateDate",
                      "QRCode", "CodeReader", "LoginUser",
                    ],
                  },
                  type: {
                    type: "number",
                    description:
                      "クラスター型の数値 (KeyboardText=30, FixedText=20, InputNumeric=65, Numeric=60, Calculate=67, NumberHours=110, TimeCalculate=55, Date=40, CalendarDate=111, Time=50, Select=70, MultiSelect=80, Check=90, Image=100, Handwriting=119, Create=116, Inspect=117, Approve=118, Registration=112, RegistrationDate=113, LatestUpdate=114, LatestUpdateDate=115, QRCode=121, CodeReader=122, LoginUser=127)",
                  },
                  cellAddress: { type: "string", description: "セルアドレス (例: C5)" },
                  confidence: {
                    type: "number",
                    description: "推測の自信度 (0-1)",
                  },
                  value: {
                    type: ["string", "null"],
                    description: "セルの値 (あれば)",
                  },
                  readOnly: { type: "boolean" },
                  inputParameters: {
                    type: "string",
                    description: "セミコロン区切りの key=value パラメータ",
                  },
                  formula: {
                    type: ["string", "null"],
                    description: "Excel数式 (あれば)",
                  },
                  region: {
                    type: "object",
                    properties: {
                      top: { type: "number" },
                      bottom: { type: "number" },
                      left: { type: "number" },
                      right: { type: "number" },
                    },
                    required: ["top", "bottom", "left", "right"],
                    additionalProperties: false,
                  },
                },
                required: [
                  "name",
                  "typeName",
                  "type",
                  "cellAddress",
                  "confidence",
                  "value",
                  "readOnly",
                  "inputParameters",
                  "formula",
                  "region",
                ],
                additionalProperties: false,
              },
            },
          },
          required: ["clusters"],
          additionalProperties: false,
        },
      },
    },
  });

  const text = response.output_text;

  let parsed: { clusters: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(text);
  } catch {
    console.error("[ai-analyzer] Failed to parse AI response:", text.slice(0, 200));
    return [];
  }

  if (!Array.isArray(parsed?.clusters)) {
    console.error("[ai-analyzer] Unexpected response shape:", Object.keys(parsed ?? {}));
    return [];
  }

  return parsed.clusters.map((c, i) => ({
    id: `${sheet.index}-${i}`,
    name: String(c.name ?? ""),
    type: Number(c.type ?? 30),
    typeName: String(c.typeName ?? "KeyboardText") as ClusterDefinition["typeName"],
    sheetNo: sheet.index,
    cellAddress: String(c.cellAddress ?? ""),
    region: c.region as ClusterDefinition["region"],
    confidence: Number(c.confidence ?? 0.5),
    value: c.value != null ? String(c.value) : undefined,
    displayValue: c.value != null ? String(c.value) : undefined,
    readOnly: Boolean(c.readOnly),
    inputParameters: String(c.inputParameters ?? ""),
    excelOutputValue: String(c.cellAddress ?? ""),
    formula: c.formula != null ? String(c.formula) : undefined,
  }));
}

// ─── Single-region analysis ──────────────────────────────────────────────────

const REGION_SYSTEM_PROMPT = `あなたは ConMas i-Reporter の帳票設計エキスパートです。

ユーザーが帳票上で矩形を描いた領域のセル情報を受け取ります。
この領域が帳票上のどのような入力項目（クラスター）に対応するかを**1つだけ**推測してください。

## クラスター型
### テキスト系
- KeyboardText (30): テキスト入力。名前、住所、担当者名、備考欄など。
- FixedText (20): 手書きノート形式。線の上に手書き。
### 数値・計算系
- InputNumeric (65): 数値入力（温度、数量、金額など）。
- Numeric (60): 数値選択（ドラムロール）。
- Calculate (67): Excel数式がある計算セル。
- NumberHours (110): 時間数入力。
- TimeCalculate (55): 時刻計算（2時刻の差分）。
### 日付・時刻系
- Date (40): 日付入力。
- CalendarDate (111): カレンダー日付選択。
- Time (50): 時刻入力。
### 選択・チェック系
- Select (70): 単一選択。
- MultiSelect (80): 複数選択。
- Check (90): チェックボックス。
### メディア系
- Image (100): 画像・写真エリア。
- Handwriting (119): 手書き署名・印鑑エリア。
### ワークフロー系
- Create (116): 作成者スタンプ。
- Inspect (117): 査閲者スタンプ。
- Approve (118): 承認者スタンプ。
- Registration (112): 帳票登録者（自動、readOnly）。
- RegistrationDate (113): 帳票登録日（自動、readOnly）。
- LatestUpdate (114): 帳票更新者（自動、readOnly）。
- LatestUpdateDate (115): 帳票更新日（自動、readOnly）。
### 読取系
- QRCode (121): バーコード・QR読取。
- CodeReader (122): コードリーダー。
- LoginUser (127): ログインユーザー名（自動入力）。

## 判断のポイント
1. 領域内のセルの値、書式、結合状態、周辺ラベルから総合的に判断
2. 空白セル + 近くにラベル → 入力クラスター
3. 数式セル → Calculate（時刻差分なら TimeCalculate）
4. 大きな結合セル → Image, Handwriting, または備考
5. 周辺コンテキスト (contextCells) を参考にラベルを確認
6. 「作成」「承認」「確認」ラベル → Create/Inspect/Approve

## inputParameters
セミコロン区切りの key=value 形式で適切なパラメータを設定してください。

推測結果を1つだけ返してください。`;

export type RegionAnalysisResult = {
  name: string;
  typeName: string;
  type: number;
  confidence: number;
  inputParameters: string;
  readOnly: boolean;
  cellAddress: string;
  formula?: string | null;
};

/**
 * Analyze a single rectangular region drawn by the user.
 * Returns a single cluster suggestion.
 */
export async function analyzeRegion(
  sheet: SheetStructure,
  regionCells: { address: string; row: number; col: number; value: string; formula?: string; isMerged: boolean; region: { top: number; bottom: number; left: number; right: number }; style: Record<string, unknown>; dataValidation?: unknown }[],
  contextCells: { address: string; row: number; col: number; value: string; region: { top: number; bottom: number; left: number; right: number } }[],
  drawnRegion: { top: number; bottom: number; left: number; right: number }
): Promise<RegionAnalysisResult> {
  const cellsSummary = regionCells.map((c) => ({
    addr: c.address,
    r: c.row,
    c: c.col,
    val: c.value || undefined,
    formula: c.formula || undefined,
    merged: c.isMerged || undefined,
    rgn: c.region,
    fmt: (c.style as Record<string, unknown>).numberFormat || undefined,
    bold: (c.style as Record<string, unknown>).bold || undefined,
    bg: (c.style as Record<string, unknown>).bgColor || undefined,
    dv: c.dataValidation || undefined,
  }));

  const contextSummary = contextCells.map((c) => ({
    addr: c.address,
    r: c.row,
    c: c.col,
    val: c.value,
  }));

  const userMessage = JSON.stringify({
    sheetName: sheet.name,
    drawnRegion,
    cells: cellsSummary,
    contextCells: contextSummary,
  }, null, 0);

  const response = await openai.responses.create({
    model: MODEL,
    instructions: REGION_SYSTEM_PROMPT,
    input: userMessage,
    text: {
      format: {
        type: "json_schema",
        name: "single_cluster",
        strict: true,
        schema: {
          type: "object",
          properties: {
            name: { type: "string", description: "クラスター名 (日本語)" },
            typeName: {
              type: "string",
              enum: [
                "KeyboardText", "FixedText",
                "InputNumeric", "Numeric", "Calculate", "NumberHours", "TimeCalculate",
                "Date", "CalendarDate", "Time",
                "Select", "MultiSelect", "Check",
                "Image", "Handwriting",
                "Create", "Inspect", "Approve",
                "Registration", "RegistrationDate", "LatestUpdate", "LatestUpdateDate",
                "QRCode", "CodeReader", "LoginUser",
              ],
            },
            type: { type: "number" },
            cellAddress: { type: "string" },
            confidence: { type: "number" },
            readOnly: { type: "boolean" },
            inputParameters: { type: "string" },
            formula: { type: ["string", "null"] },
          },
          required: ["name", "typeName", "type", "cellAddress", "confidence", "readOnly", "inputParameters", "formula"],
          additionalProperties: false,
        },
      },
    },
  });

  const parsed = JSON.parse(response.output_text);
  return {
    name: String(parsed.name ?? "新規クラスター"),
    typeName: String(parsed.typeName ?? "KeyboardText"),
    type: Number(parsed.type ?? 30),
    confidence: Number(parsed.confidence ?? 0.7),
    inputParameters: String(parsed.inputParameters ?? ""),
    readOnly: Boolean(parsed.readOnly),
    cellAddress: String(parsed.cellAddress ?? ""),
    formula: parsed.formula != null ? String(parsed.formula) : undefined,
  };
}

