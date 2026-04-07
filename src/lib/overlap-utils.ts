import type { ClusterDefinition } from "./form-structure";
import { createLogger } from "./logger";

const log = createLogger("overlap-utils");

/**
 * 同一シート内で重なるクラスターを検出し、重複を除去する。
 * 2つのクラスターが重なる場合、confidence が低い方を削除。
 * 同じ confidence なら後に検出された方を削除。
 */
export function removeOverlaps(clusters: ClusterDefinition[]): ClusterDefinition[] {
  const result: ClusterDefinition[] = [];
  let removedCount = 0;

  for (const cluster of clusters) {
    const overlapping = result.find(
      (existing) =>
        existing.sheetNo === cluster.sheetNo &&
        rectsOverlap(existing.region, cluster.region)
    );

    if (!overlapping) {
      result.push(cluster);
    } else {
      // 重なりがある場合、confidence が高い方を残す
      if (cluster.confidence > overlapping.confidence) {
        const idx = result.indexOf(overlapping);
        log.info("Overlap removed", {
          removed: { name: overlapping.name, confidence: overlapping.confidence },
          keptInstead: { name: cluster.name, confidence: cluster.confidence },
        });
        result[idx] = cluster;
      } else {
        log.info("Overlap removed", {
          removed: { name: cluster.name, confidence: cluster.confidence },
          keptInstead: { name: overlapping.name, confidence: overlapping.confidence },
        });
      }
      removedCount++;
    }
  }

  if (removedCount > 0) {
    log.info("Overlap removal summary", {
      inputClusters: clusters.length,
      outputClusters: result.length,
      removed: removedCount,
    });
  }

  return result;
}

export function rectsOverlap(
  a: { top: number; bottom: number; left: number; right: number },
  b: { top: number; bottom: number; left: number; right: number }
): boolean {
  // 重なり判定: 面積の50%以上が重なっていたら重複とみなす
  const overlapLeft = Math.max(a.left, b.left);
  const overlapRight = Math.min(a.right, b.right);
  const overlapTop = Math.max(a.top, b.top);
  const overlapBottom = Math.min(a.bottom, b.bottom);

  if (overlapLeft >= overlapRight || overlapTop >= overlapBottom) return false;

  const overlapArea = (overlapRight - overlapLeft) * (overlapBottom - overlapTop);
  const areaA = (a.right - a.left) * (a.bottom - a.top);
  const areaB = (b.right - b.left) * (b.bottom - b.top);
  const smallerArea = Math.min(areaA, areaB);

  return smallerArea > 0 && overlapArea / smallerArea > 0.5;
}
