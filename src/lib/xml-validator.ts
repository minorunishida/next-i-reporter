import { VALID_CLUSTER_TYPE_NAMES } from "./conmas-cluster-types";
import { inspectConmasTemplate, type TemplateInspection } from "./template-inspector";

export type ValidationMessage = {
  path: string;
  message: string;
};

export type TemplateValidationResult = {
  ok: boolean;
  errors: ValidationMessage[];
  warnings: ValidationMessage[];
  inspection: TemplateInspection;
};

export function validateConmasTemplate(xml: string): TemplateValidationResult {
  const inspection = inspectConmasTemplate(xml);
  const errors: ValidationMessage[] = [];
  const warnings: ValidationMessage[] = inspection.warnings.map((message) => ({
    path: "top",
    message,
  }));

  if (!includesTag(xml, "conmas")) {
    errors.push({ path: "conmas", message: "ルート <conmas> が見つかりません" });
  }

  if (!includesTag(xml, "top")) {
    errors.push({ path: "top", message: "<top> セクションが見つかりません" });
  }

  if (inspection.declaredSheetCount === null) {
    errors.push({ path: "top.sheetCount", message: "<sheetCount> が空です" });
  }

  if (inspection.actualSheetCount === 0) {
    errors.push({ path: "top.sheets", message: "実体のある <sheet> が 0 件です" });
  }

  const seenSheetNumbers = new Set<number>();

  inspection.sheets.forEach((sheet, sheetIndex) => {
    const sheetPath = `sheet[${sheetIndex + 1}]`;

    if (sheet.sheetNo === null || !Number.isInteger(sheet.sheetNo) || sheet.sheetNo <= 0) {
      errors.push({ path: `${sheetPath}.sheetNo`, message: "<sheetNo> は 1 以上の整数である必要があります" });
    } else if (seenSheetNumbers.has(sheet.sheetNo)) {
      errors.push({ path: `${sheetPath}.sheetNo`, message: `<sheetNo> ${sheet.sheetNo} が重複しています` });
    } else {
      seenSheetNumbers.add(sheet.sheetNo);
    }

    if (sheet.width === null || sheet.width <= 0) {
      errors.push({ path: `${sheetPath}.width`, message: "<width> は正の数である必要があります" });
    }

    if (sheet.height === null || sheet.height <= 0) {
      errors.push({ path: `${sheetPath}.height`, message: "<height> は正の数である必要があります" });
    }

    const seenClusterIds = new Set<number>();

    sheet.clusters.forEach((cluster, clusterIndex) => {
      const clusterPath = `${sheetPath}.cluster[${clusterIndex + 1}]`;

      if (cluster.clusterId === null || !Number.isInteger(cluster.clusterId) || cluster.clusterId < 0) {
        errors.push({ path: `${clusterPath}.clusterId`, message: "<clusterId> は 0 以上の整数である必要があります" });
      } else if (seenClusterIds.has(cluster.clusterId)) {
        errors.push({ path: `${clusterPath}.clusterId`, message: `<clusterId> ${cluster.clusterId} がシート内で重複しています` });
      } else {
        seenClusterIds.add(cluster.clusterId);
      }

      if (cluster.type.length === 0) {
        errors.push({ path: `${clusterPath}.type`, message: "<type> が空です" });
      } else if (!VALID_CLUSTER_TYPE_NAMES.has(cluster.type)) {
        errors.push({ path: `${clusterPath}.type`, message: `未知の cluster type です: ${cluster.type}` });
      }

      if (cluster.sheetNo === null || !Number.isInteger(cluster.sheetNo) || cluster.sheetNo <= 0) {
        errors.push({ path: `${clusterPath}.sheetNo`, message: "<sheetNo> は 1 以上の整数である必要があります" });
      } else if (sheet.sheetNo !== null && cluster.sheetNo !== sheet.sheetNo) {
        errors.push({
          path: `${clusterPath}.sheetNo`,
          message: `cluster の <sheetNo> ${cluster.sheetNo} がシートの <sheetNo> ${sheet.sheetNo} と一致しません`,
        });
      }

      validateRegion(clusterPath, "top", cluster.region.top, errors);
      validateRegion(clusterPath, "bottom", cluster.region.bottom, errors);
      validateRegion(clusterPath, "left", cluster.region.left, errors);
      validateRegion(clusterPath, "right", cluster.region.right, errors);

      if (
        cluster.region.top !== null &&
        cluster.region.bottom !== null &&
        cluster.region.top > cluster.region.bottom
      ) {
        errors.push({ path: clusterPath, message: "<top> は <bottom> 以下である必要があります" });
      }

      if (
        cluster.region.left !== null &&
        cluster.region.right !== null &&
        cluster.region.left > cluster.region.right
      ) {
        errors.push({ path: clusterPath, message: "<left> は <right> 以下である必要があります" });
      }

      if (cluster.name.length === 0) {
        warnings.push({ path: `${clusterPath}.name`, message: "<name> が空です" });
      }

      if (cluster.cellAddress.length === 0) {
        warnings.push({ path: `${clusterPath}.cellAddress`, message: "<cellAddress> が空です" });
      }
    });
  });

  if (inspection.defTopName.length === 0) {
    warnings.push({ path: "top.defTopName", message: "<defTopName> が空です" });
  }

  if (!inspection.hasBackgroundImage) {
    warnings.push({ path: "top.backgroundImage", message: "<backgroundImage> が空です" });
  }

  if (inspection.clusterCount === 0) {
    warnings.push({ path: "top.sheets", message: "cluster が 0 件です" });
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    inspection,
  };
}

function includesTag(xml: string, tagName: string): boolean {
  return new RegExp(`<${tagName}(?:\\s[^>]*)?>`).test(xml);
}

function validateRegion(
  clusterPath: string,
  key: "top" | "bottom" | "left" | "right",
  value: number | null,
  errors: ValidationMessage[]
): void {
  if (value === null) {
    errors.push({ path: `${clusterPath}.${key}`, message: `<${key}> が空か数値ではありません` });
    return;
  }

  if (value < 0 || value > 1) {
    errors.push({ path: `${clusterPath}.${key}`, message: `<${key}> は 0-1 の範囲である必要があります` });
  }
}
