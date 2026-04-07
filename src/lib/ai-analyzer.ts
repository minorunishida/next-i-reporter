import OpenAI from "openai";
import { performance } from "node:perf_hooks";
import type {
  FormStructure,
  SheetStructure,
  ClusterDefinition,
  AnalysisResult,
} from "./form-structure";
import { applySmartDefaults } from "./smart-defaults";
import { removeOverlaps } from "./overlap-utils";
import { loadAiConfig } from "./ai-config";
import { createLogger } from "./logger";

const log = createLogger("ai-analyzer");

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

  log.info("Cell filtering", {
    sheetName: sheet.name,
    totalCells: sheet.cells.length,
    meaningfulCells: meaningfulCells.length,
    excluded: sheet.cells.length - meaningfulCells.length,
    filterBreakdown: {
      hasValue: sheet.cells.filter((c) => c.value).length,
      hasFormula: sheet.cells.filter((c) => c.formula).length,
      isMerged: sheet.cells.filter((c) => c.isMerged).length,
      hasDataValidation: sheet.cells.filter((c) => c.dataValidation).length,
      hasBorders: sheet.cells.filter((c) => c.style.borderTop || c.style.borderBottom || c.style.borderLeft || c.style.borderRight).length,
      hasBgColor: sheet.cells.filter((c) => c.style.bgColor).length,
    },
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

  const payloadBytes = Buffer.byteLength(userMessage, "utf8");
  const config = loadAiConfig();
  log.info("AI request", {
    sheetName: sheet.name,
    model: config.model,
    payloadBytes,
    cellCount: cellsSummary.length,
  });

  const openai = new OpenAI(config.baseURL ? { baseURL: config.baseURL } : {});
  const aiStartTime = performance.now();

  const response = await openai.responses.create({
    model: config.model,
    instructions: config.systemPrompt,
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
                      "KeyboardText", "FixedText", "FreeText",
                      "InputNumeric", "Numeric", "Calculate", "NumberHours", "TimeCalculate", "MCNCalculate",
                      "Date", "CalendarDate", "Time",
                      "Select", "MultiSelect", "Check", "MultipleChoiceNumber", "SelectMaster",
                      "Image", "Handwriting", "FreeDraw", "DrawingImage",
                      "Create", "Inspect", "Approve",
                      "Registration", "RegistrationDate", "LatestUpdate", "LatestUpdateDate",
                      "QRCode", "CodeReader", "LoginUser", "Gps", "Scandit", "EdgeOCR",
                    ],
                  },
                  type: {
                    type: "number",
                    description:
                      "クラスター型の数値コード",
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

  const aiElapsedMs = Math.round(performance.now() - aiStartTime);
  const text = response.output_text;

  log.info("AI response received", {
    sheetName: sheet.name,
    elapsedMs: aiElapsedMs,
    model: config.model,
    usage: (response as any).usage ?? null,
    responseLength: text.length,
  });

  let parsed: { clusters: Array<Record<string, unknown>> };
  try {
    parsed = JSON.parse(text);
  } catch {
    log.error("Failed to parse AI response", { text: text.slice(0, 500) });
    return [];
  }

  if (!Array.isArray(parsed?.clusters)) {
    log.error("Unexpected response shape", { keys: Object.keys(parsed ?? {}) });
    return [];
  }

  // クラスター別ログ
  for (const c of parsed.clusters) {
    log.debug("Cluster detected", {
      name: c.name,
      typeName: c.typeName,
      confidence: c.confidence,
      cellAddress: c.cellAddress,
      region: c.region,
    });
  }

  // 信頼度分布
  const high = parsed.clusters.filter((c) => Number(c.confidence) >= 0.9).length;
  const medium = parsed.clusters.filter((c) => Number(c.confidence) >= 0.7 && Number(c.confidence) < 0.9).length;
  const low = parsed.clusters.filter((c) => Number(c.confidence) < 0.7).length;
  log.info("Confidence distribution", {
    sheetName: sheet.name,
    total: parsed.clusters.length,
    high,
    medium,
    low,
  });

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

  const config = loadAiConfig();
  const openai = new OpenAI(config.baseURL ? { baseURL: config.baseURL } : {});

  const response = await openai.responses.create({
    model: config.model,
    instructions: config.regionSystemPrompt,
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

