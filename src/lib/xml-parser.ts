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
  CarbonCopyTarget,
  NetworkDefinition,
  ValueLink,
  AnalysisResult,
} from "./form-structure";
import { REGISTRY_BY_NAME } from "./cluster-type-registry";
import { resolveInternalId } from "./network-utils";

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
  const rawCarbonCopies = new Map<string, Array<{ sheetNo: number; clusterId: number; edit: 0 | 1 }>>();

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

      const ccMatch = clusterXml.match(/<carbonCopy>([\s\S]*?)<\/carbonCopy>/);
      if (ccMatch && ccMatch[1].trim()) {
        const targetXmls = getAllTags(ccMatch[1], "targetCluster");
        if (targetXmls.length > 0) {
          rawCarbonCopies.set(cluster.id, targetXmls.map((tx) => ({
            sheetNo: getTagNum(tx, "sheetNo", 1),
            clusterId: getTagNum(tx, "clusterId", 0),
            edit: (getTagNum(tx, "edit", 0)) as 0 | 1,
          })));
        }
      }

      allClusters.push(cluster);
    }
  }

  // carbonCopy 解決 (クラスターを全部パースした後に実施)
  for (const [srcId, targets] of rawCarbonCopies) {
    const srcCluster = allClusters.find((c) => c.id === srcId);
    if (!srcCluster) continue;
    const resolved: CarbonCopyTarget[] = targets.flatMap((t) => {
      const internalId = resolveInternalId(t.sheetNo, t.clusterId, allClusters);
      if (!internalId) return [];
      return [{ targetClusterId: internalId, edit: t.edit }];
    });
    if (resolved.length > 0) srcCluster.carbonCopy = resolved;
  }

  // networks パース (クラスターを全部パースした後に実施)
  const useNetworkAutoInputStart = (getTagNum(top, "useNetworkAutoInputStart", 0) as 0 | 1);
  const networkAnswerbackMode = (getTagNum(top, "networkAnswerbackMode", 0) as 0 | 1);

  const networksMatch = top.match(/<networks>([\s\S]*?)<\/networks>/);
  const networksXml = networksMatch ? networksMatch[1] : "";
  const networkXmls = getAllTags(networksXml, "network");

  let netCounter = 0;
  const networks: NetworkDefinition[] = networkXmls.flatMap((nx) => {
    const prevSheetNo = getTagNum(nx, "prevSheetNo", 1);
    const prevClusterIdNum = getTagNum(nx, "prevClusterId", 0);
    const nextSheetNo = getTagNum(nx, "nextSheetNo", 1);
    const nextClusterIdNum = getTagNum(nx, "nextClusterId", 0);

    const prevInternalId = resolveInternalId(prevSheetNo, prevClusterIdNum, allClusters);
    const nextInternalId = resolveInternalId(nextSheetNo, nextClusterIdNum, allClusters);
    if (!prevInternalId || !nextInternalId) return [];

    const valueLinksXml = getAllTags(nx, "valueLink");
    const valueLinks: ValueLink[] = valueLinksXml.map((vl) => ({
      parentValue: getTagText(vl, "parentValue"),
      selectValues: getTagText(vl, "selectValues"),
    }));

    const terminalTypeStr = getTagText(nx, "terminalType");
    const terminalType: 0 | 1 | "" =
      terminalTypeStr === "0" ? 0 : terminalTypeStr === "1" ? 1 : "";

    return [{
      id: `net-${netCounter++}`,
      prevClusterId: prevInternalId,
      nextClusterId: nextInternalId,
      nextAutoInputStart: (parseInt(getTagText(nx, "nextAutoInputStart") || "1", 10) || 0) as 0 | 1,
      relation: getTagText(nx, "relation") as NetworkDefinition["relation"],
      skip: (getTagNum(nx, "skip", 0)) as 0 | 1 | 2,
      requiredValue: getTagText(nx, "requiredValue"),
      customMasterSearchField: getTagText(nx, "customMasterSearchField"),
      checkGroupIdMode: getTagText(nx, "checkGroupIdMode"),
      noNeedToFillOut: (getTagNum(nx, "noNeedToFillOut", 0)) as 0 | 1 | 2,
      terminalType,
      nextAutoInput: (getTagNum(nx, "nextAutoInput", 0)) as 0 | 1,
      nextAutoInputEdit: (getTagNum(nx, "nextAutoInputEdit", 0)) as 0 | 1,
      valueLinks,
    }];
  });

  const formStructure: FormStructure = {
    fileName: fileName || excelFileName || `${defTopName}.xml`,
    sheets,
    pdfBase64,
    excelBase64,
    embeddedExcelFileName: excelFileName || undefined,
    networks: networks.length > 0 ? networks : undefined,
    useNetworkAutoInputStart,
    networkAnswerbackMode,
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
