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

- KeyboardText (30): テキストを入力する空白セル。名前、住所、担当者名など。
- Date (40): 日付を入力するセル（「日付」「年月日」の隣、日付書式）。
- Time (50): 時刻を入力するセル。
- InputNumeric (65): 数値を入力するセル（「温度」「数量」「金額」の隣、数値書式）。
- Calculate (67): Excel数式があるセル（合計、小計、税額など）。数式の内容から計算式を推測。
- Select (70): 選択肢から選ぶセル（入力規則リスト、税率区分など）。
- Check (90): チェックボックス的なセル。
- Image (100): 画像・写真を配置する大きな結合セル。
- Handwriting (119): 手書き署名・印鑑用の結合セル（「サイン」「署名」「印」の近く）。

## 判断のポイント

1. 空白セルで、近くにラベルがあれば入力クラスター（KeyboardText, InputNumeric, Date等）
2. 値が入っているだけのセル（ラベル・見出し・タイトル）はスキップする。クラスターにしない
3. 数式セルは Calculate (67) にする。数式の内容も formula に含める
4. セルの書式（numberFormat）がヒント: 日付書式 → Date、通貨/数値書式 → InputNumeric
5. 大きな結合セル + 空白 → 候補: Image, Handwriting, KeyboardText（備考欄）
6. 空白セルでも意味のある入力欄でなければスキップ（罫線だけのセルなど）

## confidence (自信度) の基準

- 0.95: 明らかに数式 (Calculate) または書式から確実に判定できる
- 0.85-0.95: 書式や隣接ラベルから高い確度で推測できる
- 0.70-0.85: 推測に基づくが妥当（空白セルの用途推測）
- 0.50-0.70: 不確実。ユーザー確認が必要

## inputParameters の生成規則

セミコロン区切りの key=value 形式:
- KeyboardText: "Required=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"
- InputNumeric: "Required=0;Decimal=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"
  - 金額なら "Comma=1" を追加
  - 小数があれば "Decimal=桁数" を設定
- Date: "Required=0;DateFormat=yyyy/MM/dd;Align=Left;Font=MS Gothic;FontSize=11"
- Calculate: "Decimal=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0"

## 重要: 漏れなく検出すること

この帳票がどんな種類（点検シート、温度管理表、請求書、作業日報、チェックリスト等）であっても、すべての意味のあるセルをクラスターとして出力してください。

1. **ラベル・見出しはスキップ**: テキストが入っているだけのラベルセルはクラスターにしない（PDF背景で表示される）
2. **入力欄**: 空白セルでも、隣にラベルがあれば入力クラスターとして検出。文脈から型を推測:
   - テキスト系 → KeyboardText
   - 数値系 → InputNumeric
   - 日付系 → Date
   - 時刻系 → Time
   - 選択系 → Select
3. **数式セル** (Calculate): formula フィールドに元の数式を含める
4. **テーブル構造**: ヘッダー行はスキップし、入力行の各セルを個別に検出
5. **大きな空白結合セル**: 文脈から推測 (備考→KeyboardText、写真→Image、署名→Handwriting)

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
                      "KeyboardText",
                      "Date",
                      "Time",
                      "InputNumeric",
                      "Calculate",
                      "Select",
                      "Check",
                      "Image",
                      "Handwriting",
                    ],
                  },
                  type: {
                    type: "number",
                    description:
                      "クラスター型の数値 (KeyboardText=30, Date=40, Time=50, InputNumeric=65, Calculate=67, Select=70, Check=90, Image=100, Handwriting=119)",
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
- KeyboardText (30): テキスト入力。名前、住所、担当者名、備考欄など。
- Date (40): 日付入力。
- Time (50): 時刻入力。
- InputNumeric (65): 数値入力（温度、数量、金額など）。
- Calculate (67): Excel数式がある計算セル。
- Select (70): 選択肢リスト。
- Check (90): チェックボックス。
- Image (100): 画像・写真エリア。
- Handwriting (119): 手書き署名・印鑑エリア。

## 判断のポイント
1. 領域内のセルの値、書式、結合状態、周辺ラベルから総合的に判断
2. 空白セル + 近くにラベル → 入力クラスター
3. 数式セル → Calculate
4. 大きな結合セル → Image, Handwriting, または備考
5. 周辺コンテキスト (contextCells) を参考にラベルを確認

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
              enum: ["KeyboardText", "Date", "Time", "InputNumeric", "Calculate", "Select", "Check", "Image", "Handwriting"],
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

