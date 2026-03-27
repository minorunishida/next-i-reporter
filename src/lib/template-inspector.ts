export type InspectedCluster = {
  clusterId: number | null;
  name: string;
  type: string;
  cellAddress: string;
  sheetNo: number | null;
  region: {
    top: number | null;
    bottom: number | null;
    left: number | null;
    right: number | null;
  };
};

export type InspectedSheet = {
  defSheetName: string;
  sheetNo: number | null;
  width: number | null;
  height: number | null;
  clusterCount: number;
  clusterTypeCounts: Record<string, number>;
  clusters: InspectedCluster[];
};

export type TemplateInspection = {
  defTopName: string;
  declaredSheetCount: number | null;
  actualSheetCount: number;
  clusterCount: number;
  clusterTypeCounts: Record<string, number>;
  hasBackgroundImage: boolean;
  sheets: InspectedSheet[];
  warnings: string[];
};

export function inspectConmasTemplate(xml: string): TemplateInspection {
  const normalizedXml = stripBom(xml);
  const topSection = getFirstBlock(normalizedXml, "top");
  const sheetsSection = topSection ? getFirstBlock(topSection, "sheets") : null;
  const sheetBlocks = sheetsSection ? getBlocks(sheetsSection, "sheet") : [];

  const sheets = sheetBlocks.map((sheetBlock) => inspectSheet(sheetBlock));
  const clusterTypeCounts = countBy(
    sheets.flatMap((sheet) => sheet.clusters.map((cluster) => cluster.type || "(empty)"))
  );
  const clusterCount = sheets.reduce((sum, sheet) => sum + sheet.clusterCount, 0);
  const declaredSheetCount = parseOptionalNumber(getTagText(topSection, "sheetCount"));
  const warnings: string[] = [];

  if (!topSection) {
    warnings.push("<top> セクションが見つかりません");
  }

  if (declaredSheetCount !== null && declaredSheetCount !== sheets.length) {
    warnings.push(
      `<sheetCount> は ${declaredSheetCount} ですが、実際の <sheet> は ${sheets.length} 件です`
    );
  }

  if (sheets.length === 0) {
    warnings.push("帳票シートが 0 件です");
  }

  return {
    defTopName: getTagText(topSection, "defTopName"),
    declaredSheetCount,
    actualSheetCount: sheets.length,
    clusterCount,
    clusterTypeCounts,
    hasBackgroundImage: getTagText(topSection, "backgroundImage").length > 0,
    sheets,
    warnings,
  };
}

function inspectSheet(sheetXml: string): InspectedSheet {
  const clustersSection = getFirstBlock(sheetXml, "clusters");
  const clusterBlocks = clustersSection ? getBlocks(clustersSection, "cluster") : [];
  const clusters = clusterBlocks.map((clusterBlock) => inspectCluster(clusterBlock));

  return {
    defSheetName: getTagText(sheetXml, "defSheetName"),
    sheetNo: parseOptionalNumber(getTagText(sheetXml, "sheetNo")),
    width: parseOptionalNumber(getTagText(sheetXml, "width")),
    height: parseOptionalNumber(getTagText(sheetXml, "height")),
    clusterCount: clusters.length,
    clusterTypeCounts: countBy(clusters.map((cluster) => cluster.type || "(empty)")),
    clusters,
  };
}

function inspectCluster(clusterXml: string): InspectedCluster {
  return {
    clusterId: parseOptionalNumber(getTagText(clusterXml, "clusterId")),
    name: getTagText(clusterXml, "name"),
    type: getTagText(clusterXml, "type"),
    cellAddress: getTagText(clusterXml, "cellAddress"),
    sheetNo: parseOptionalNumber(getTagText(clusterXml, "sheetNo")),
    region: {
      top: parseOptionalNumber(getTagText(clusterXml, "top")),
      bottom: parseOptionalNumber(getTagText(clusterXml, "bottom")),
      left: parseOptionalNumber(getTagText(clusterXml, "left")),
      right: parseOptionalNumber(getTagText(clusterXml, "right")),
    },
  };
}

function countBy(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, value) => {
    acc[value] = (acc[value] ?? 0) + 1;
    return acc;
  }, {});
}

function stripBom(xml: string): string {
  return xml.replace(/^\uFEFF/, "");
}

function getBlocks(xml: string | null, tagName: string): string[] {
  if (!xml) {
    return [];
  }

  const blocks: string[] = [];
  let searchStart = 0;

  while (searchStart < xml.length) {
    const opening = findOpeningTag(xml, tagName, searchStart);
    if (!opening) {
      break;
    }

    const closingIndex = findMatchingClosingTag(xml, tagName, opening.contentStart);
    if (closingIndex === -1) {
      break;
    }

    blocks.push(xml.slice(opening.contentStart, closingIndex));
    searchStart = closingIndex + tagName.length + 3;
  }

  return blocks;
}

function getFirstBlock(xml: string | null, tagName: string): string | null {
  return getBlocks(xml, tagName)[0] ?? null;
}

function getTagText(xml: string | null, tagName: string): string {
  const block = getFirstBlock(xml, tagName);
  if (block === null) {
    return "";
  }
  return decodeXml(block).trim();
}

function parseOptionalNumber(value: string): number | null {
  if (value.length === 0) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function findOpeningTag(
  xml: string,
  tagName: string,
  startIndex: number
): { contentStart: number; tagStart: number } | null {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>`, "g");
  pattern.lastIndex = startIndex;
  const match = pattern.exec(xml);

  if (!match) {
    return null;
  }

  return {
    tagStart: match.index,
    contentStart: pattern.lastIndex,
  };
}

function findMatchingClosingTag(xml: string, tagName: string, startIndex: number): number {
  const pattern = new RegExp(`<${tagName}(?:\\s[^>]*)?>|</${tagName}>`, "g");
  pattern.lastIndex = startIndex;
  let depth = 1;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(xml)) !== null) {
    if (match[0].startsWith(`</${tagName}`)) {
      depth -= 1;
      if (depth === 0) {
        return match.index;
      }
    } else {
      depth += 1;
    }
  }

  return -1;
}
