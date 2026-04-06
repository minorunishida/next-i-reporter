/**
 * ConMas XML パーサー — 既存帳票 XML をインポートして AnalysisResult に変換
 *
 * generateConmasXml の逆変換。座標は 0-1 比率 → px に戻す。
 * type 文字列名 → 数値コード (レジストリ経由)。
 */

import type {
  FormStructure,
  SheetStructure,
  ClusterDefinition,
  AnalysisResult,
} from "./form-structure";
import { REGISTRY_BY_NAME } from "./cluster-type-registry";

// ─── 簡易 XML パーサーヘルパー ──────────────────────────────────────────────

/** タグ内のテキストを取得 (最初のマッチ) */
function getTagText(xml: string, tag: string): string {
  // Handle xml:space="preserve" and other attributes
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "");
  const m = xml.match(re);
  return m ? unesc(m[1]) : "";
}

/** タグ内のテキストを取得 (数値) */
function getTagNum(xml: string, tag: string, fallback = 0): number {
  const text = getTagText(xml, tag);
  const n = parseFloat(text);
  return isNaN(n) ? fallback : n;
}

/** タグの全マッチを配列で返す */
function getAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, "g");
  const results: string[] = [];
  let m;
  while ((m = re.exec(xml)) !== null) {
    results.push(m[1]);
  }
  return results;
}

/** XML エスケープの復元 */
function unesc(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

// ─── メインパーサー ─────────────────────────────────────────────────────────

/**
 * ConMas XML 文字列をパースして AnalysisResult に変換する
 *
 * @param xml ConMas 帳票定義 XML 文字列
 * @param fileName 元のファイル名 (省略時は XML から取得)
 */
export function parseConmasXml(xml: string, fileName?: string): AnalysisResult {
  // top セクション
  const topMatch = xml.match(/<top>([\s\S]*)<\/top>/);
  const top = topMatch ? topMatch[1] : xml;

  const defTopName = getTagText(top, "defTopName") || "Imported";
  const pdfBase64 = getTagText(top, "backgroundImage") || undefined;

  // definitionFile: Excel バイナリ復元
  const defFileMatch = top.match(/<definitionFile>([\s\S]*?)<\/definitionFile>/);
  const defFileBlock = defFileMatch ? defFileMatch[1] : "";
  const excelBase64 = defFileBlock ? (getTagText(defFileBlock, "value") || undefined) : undefined;
  const excelFileName = defFileBlock ? (getTagText(defFileBlock, "name") || undefined) : undefined;

  // sheets パース
  const sheetsMatch = top.match(/<sheets>([\s\S]*)<\/sheets>/);
  const sheetsXml = sheetsMatch ? sheetsMatch[1] : "";
  const sheetXmls = getAllTags(sheetsXml, "sheet");

  const sheets: SheetStructure[] = [];
  const allClusters: ClusterDefinition[] = [];
  let clusterIdCounter = 0;

  for (const sheetXml of sheetXmls) {
    const sheetNo = getTagNum(sheetXml, "sheetNo", 1);
    const sheetIndex = sheetNo - 1; // XML は 1-based、内部は 0-based
    const sheetName = getTagText(sheetXml, "defSheetName") || `Sheet ${sheetNo}`;
    const width = getTagNum(sheetXml, "width", 800);
    const height = getTagNum(sheetXml, "height", 1200);

    const sheet: SheetStructure = {
      name: sheetName,
      index: sheetIndex,
      rowCount: 0,
      colCount: 0,
      rowHeights: [],
      colWidths: [],
      totalWidth: width,
      totalHeight: height,
      cells: [],
      pageSetup: {
        orientation: "portrait",
        paperSize: "A4",
        margins: { top: 0, bottom: 0, left: 0, right: 0 },
      },
    };
    sheets.push(sheet);

    // clusters パース
    const clustersMatch = sheetXml.match(/<clusters>([\s\S]*)<\/clusters>/);
    const clustersXml = clustersMatch ? clustersMatch[1] : "";
    const clusterXmls = getAllTags(clustersXml, "cluster");

    for (const clusterXml of clusterXmls) {
      const typeStr = getTagText(clusterXml, "type");
      const entry = REGISTRY_BY_NAME.get(typeStr);
      const typeNum = entry?.value ?? 30;
      const typeName = entry?.name ?? (typeStr || "KeyboardText");

      // 座標: 0-1 比率 → px (シートの width/height を掛ける)
      const topRatio = getTagNum(clusterXml, "top");
      const bottomRatio = getTagNum(clusterXml, "bottom");
      const leftRatio = getTagNum(clusterXml, "left");
      const rightRatio = getTagNum(clusterXml, "right");

      const cluster: ClusterDefinition = {
        id: `${sheetIndex}-${clusterIdCounter++}`,
        name: getTagText(clusterXml, "name"),
        type: typeNum,
        typeName: typeName as ClusterDefinition["typeName"],
        sheetNo: sheetIndex,
        cellAddress: getTagText(clusterXml, "cellAddress"),
        region: {
          top: topRatio * height,
          bottom: bottomRatio * height,
          left: leftRatio * width,
          right: rightRatio * width,
        },
        confidence: 1.0, // インポートは確定データ
        value: getTagText(clusterXml, "value") || undefined,
        displayValue: getTagText(clusterXml, "displayValue") || undefined,
        readOnly: getTagText(clusterXml, "readOnly") === "1",
        inputParameters: getTagText(clusterXml, "inputParameters"),
        excelOutputValue: getTagText(clusterXml, "excelOutputValue") || undefined,
        formula: getTagText(clusterXml, "function") || undefined,
      };

      allClusters.push(cluster);
    }
  }

  const formStructure: FormStructure = {
    fileName: fileName || excelFileName || `${defTopName}.xml`,
    sheets,
    pdfBase64,
    excelBase64,
    embeddedExcelFileName: excelFileName || undefined,
  };

  const highConfidence = allClusters.filter((c) => c.confidence >= 0.9).length;
  const mediumConfidence = allClusters.filter(
    (c) => c.confidence >= 0.7 && c.confidence < 0.9,
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
