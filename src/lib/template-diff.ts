import { inspectConmasTemplate, type InspectedCluster, type InspectedSheet, type TemplateInspection } from "./template-inspector";

export type TemplateDiff = {
  identical: boolean;
  summary: {
    leftTemplateName: string;
    rightTemplateName: string;
    leftSheetCount: number;
    rightSheetCount: number;
    leftClusterCount: number;
    rightClusterCount: number;
  };
  differences: string[];
};

export function diffConmasTemplates(leftXml: string, rightXml: string): TemplateDiff {
  const left = inspectConmasTemplate(leftXml);
  const right = inspectConmasTemplate(rightXml);
  const differences: string[] = [];

  compareTopLevel(left, right, differences);
  compareSheets(left, right, differences);

  return {
    identical: differences.length === 0,
    summary: {
      leftTemplateName: left.defTopName,
      rightTemplateName: right.defTopName,
      leftSheetCount: left.actualSheetCount,
      rightSheetCount: right.actualSheetCount,
      leftClusterCount: left.clusterCount,
      rightClusterCount: right.clusterCount,
    },
    differences,
  };
}

function compareTopLevel(left: TemplateInspection, right: TemplateInspection, differences: string[]): void {
  if (left.defTopName !== right.defTopName) {
    differences.push(`top.defTopName differs: "${left.defTopName}" vs "${right.defTopName}"`);
  }

  if (left.declaredSheetCount !== right.declaredSheetCount) {
    differences.push(`top.sheetCount differs: ${formatValue(left.declaredSheetCount)} vs ${formatValue(right.declaredSheetCount)}`);
  }

  if (left.hasBackgroundImage !== right.hasBackgroundImage) {
    differences.push(
      `top.backgroundImage differs: ${left.hasBackgroundImage ? "present" : "missing"} vs ${right.hasBackgroundImage ? "present" : "missing"}`
    );
  }

  compareCountMap("top.clusterTypes", left.clusterTypeCounts, right.clusterTypeCounts, differences);
}

function compareSheets(left: TemplateInspection, right: TemplateInspection, differences: string[]): void {
  const leftSheets = createKeyedMap(left.sheets, getSheetKey);
  const rightSheets = createKeyedMap(right.sheets, getSheetKey);
  const allKeys = new Set([...leftSheets.keys(), ...rightSheets.keys()]);

  for (const key of sortedKeys(allKeys)) {
    const leftSheet = leftSheets.get(key);
    const rightSheet = rightSheets.get(key);

    if (!leftSheet) {
      differences.push(`sheet missing on left: ${describeSheet(rightSheet!)}`);
      continue;
    }

    if (!rightSheet) {
      differences.push(`sheet missing on right: ${describeSheet(leftSheet)}`);
      continue;
    }

    compareSheet(leftSheet, rightSheet, differences);
  }
}

function compareSheet(left: InspectedSheet, right: InspectedSheet, differences: string[]): void {
  const sheetPath = `sheet[${getSheetKey(left)}]`;

  if (left.defSheetName !== right.defSheetName) {
    differences.push(`${sheetPath}.defSheetName differs: "${left.defSheetName}" vs "${right.defSheetName}"`);
  }

  if (!sameNumber(left.width, right.width)) {
    differences.push(`${sheetPath}.width differs: ${formatValue(left.width)} vs ${formatValue(right.width)}`);
  }

  if (!sameNumber(left.height, right.height)) {
    differences.push(`${sheetPath}.height differs: ${formatValue(left.height)} vs ${formatValue(right.height)}`);
  }

  if (left.clusterCount !== right.clusterCount) {
    differences.push(`${sheetPath}.clusterCount differs: ${left.clusterCount} vs ${right.clusterCount}`);
  }

  compareCountMap(`${sheetPath}.clusterTypes`, left.clusterTypeCounts, right.clusterTypeCounts, differences);
  compareClusters(sheetPath, left.clusters, right.clusters, differences);
}

function compareClusters(
  sheetPath: string,
  leftClusters: InspectedCluster[],
  rightClusters: InspectedCluster[],
  differences: string[]
): void {
  const leftMap = createKeyedMap(leftClusters, getClusterKey);
  const rightMap = createKeyedMap(rightClusters, getClusterKey);
  const allKeys = new Set([...leftMap.keys(), ...rightMap.keys()]);

  for (const key of sortedKeys(allKeys)) {
    const leftCluster = leftMap.get(key);
    const rightCluster = rightMap.get(key);

    if (!leftCluster) {
      differences.push(`${sheetPath}.cluster missing on left: ${describeCluster(rightCluster!)}`);
      continue;
    }

    if (!rightCluster) {
      differences.push(`${sheetPath}.cluster missing on right: ${describeCluster(leftCluster)}`);
      continue;
    }

    const clusterPath = `${sheetPath}.cluster[${key}]`;

    if (leftCluster.name !== rightCluster.name) {
      differences.push(`${clusterPath}.name differs: "${leftCluster.name}" vs "${rightCluster.name}"`);
    }

    if (leftCluster.type !== rightCluster.type) {
      differences.push(`${clusterPath}.type differs: "${leftCluster.type}" vs "${rightCluster.type}"`);
    }

    if (leftCluster.cellAddress !== rightCluster.cellAddress) {
      differences.push(`${clusterPath}.cellAddress differs: "${leftCluster.cellAddress}" vs "${rightCluster.cellAddress}"`);
    }

    compareRegion(clusterPath, "top", leftCluster.region.top, rightCluster.region.top, differences);
    compareRegion(clusterPath, "bottom", leftCluster.region.bottom, rightCluster.region.bottom, differences);
    compareRegion(clusterPath, "left", leftCluster.region.left, rightCluster.region.left, differences);
    compareRegion(clusterPath, "right", leftCluster.region.right, rightCluster.region.right, differences);
  }
}

function compareRegion(
  clusterPath: string,
  key: "top" | "bottom" | "left" | "right",
  left: number | null,
  right: number | null,
  differences: string[]
): void {
  if (!sameNumber(left, right, 0.000001)) {
    differences.push(`${clusterPath}.${key} differs: ${formatValue(left)} vs ${formatValue(right)}`);
  }
}

function compareCountMap(
  label: string,
  left: Record<string, number>,
  right: Record<string, number>,
  differences: string[]
): void {
  const allKeys = new Set([...Object.keys(left), ...Object.keys(right)]);

  for (const key of sortedKeys(allKeys)) {
    const leftValue = left[key] ?? 0;
    const rightValue = right[key] ?? 0;

    if (leftValue !== rightValue) {
      differences.push(`${label}.${key} differs: ${leftValue} vs ${rightValue}`);
    }
  }
}

function createKeyedMap<T>(items: T[], getKey: (item: T) => string): Map<string, T> {
  return new Map(items.map((item) => [getKey(item), item]));
}

function getSheetKey(sheet: InspectedSheet): string {
  if (sheet.sheetNo !== null) {
    return String(sheet.sheetNo);
  }
  return `name:${sheet.defSheetName}`;
}

function getClusterKey(cluster: InspectedCluster): string {
  if (cluster.clusterId !== null) {
    return String(cluster.clusterId);
  }
  if (cluster.cellAddress.length > 0) {
    return `cell:${cluster.cellAddress}`;
  }
  return `name:${cluster.name}`;
}

function describeSheet(sheet: InspectedSheet): string {
  return `#${sheet.sheetNo ?? "?"} ${sheet.defSheetName || "(unnamed)"}`;
}

function describeCluster(cluster: InspectedCluster): string {
  return `id=${cluster.clusterId ?? "?"} name="${cluster.name}" type="${cluster.type}" cell="${cluster.cellAddress}"`;
}

function sameNumber(left: number | null, right: number | null, epsilon = 0): boolean {
  if (left === null || right === null) {
    return left === right;
  }
  return Math.abs(left - right) <= epsilon;
}

function formatValue(value: number | null): string {
  return value === null ? "(empty)" : String(value);
}

function sortedKeys(values: Set<string>): string[] {
  return Array.from(values).sort((left, right) => left.localeCompare(right, "ja"));
}
