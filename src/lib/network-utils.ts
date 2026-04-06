/**
 * ネットワーク機能ユーティリティ
 *
 * - selectValues のエスケープ/アンエスケープ
 * - ClusterDefinition.id ↔ XML の sheetNo/clusterId の相互変換
 * - valueLinks バリデーション
 */

import type { ClusterDefinition, NetworkDefinition, ValueLink } from "./form-structure";
import { parseInputParameters } from "./input-parameters";

// ─── selectValues エスケープ ─────────────────────────────────────────────────

/**
 * "A,,B,C" → ["A,B", "C"]
 * 区切り文字は , だが、,, は値内のカンマ1個を表す。
 */
export function parseSelectValues(raw: string): string[] {
  if (!raw) return [];
  // ,, を一時プレースホルダーに置換してからカンマ分割
  const PLACEHOLDER = "\x00";
  const replaced = raw.replace(/,,/g, PLACEHOLDER);
  return replaced.split(",").map((v) => v.replace(new RegExp(PLACEHOLDER, "g"), ","));
}

/**
 * ["A,B", "C"] → "A,,B,C"
 * 各値内の , を ,, にエスケープしてからカンマで連結する。
 */
export function serializeSelectValues(values: string[]): string {
  return values.map((v) => v.replace(/,/g, ",,")).join(",");
}

// ─── clusterId 解決 ──────────────────────────────────────────────────────────

/**
 * ClusterDefinition.id ("0-2") → XML用 { sheetNo, clusterId }
 *
 * - sheetNo: 1-based
 * - clusterId: シート内で type !== 20 のクラスターを並べた 0-based インデックス
 *              (xml-generator の genSheet() と同じ挙動)
 *
 * @returns 解決できない場合 null
 */
export function resolveClusterXmlIds(
  internalId: string,
  allClusters: ClusterDefinition[],
): { sheetNo: number; clusterId: number } | null {
  const dashIdx = internalId.indexOf("-");
  if (dashIdx === -1) return null;
  const sheetIndex = parseInt(internalId.slice(0, dashIdx), 10);
  if (isNaN(sheetIndex)) return null;

  // シート内のクラスター列 (type !== 20 のみ、allClusters 順)
  const sheetClusters = allClusters.filter(
    (c) => c.sheetNo === sheetIndex && c.type !== 20,
  );

  const idx = sheetClusters.findIndex((c) => c.id === internalId);
  if (idx === -1) return null;

  return { sheetNo: sheetIndex + 1, clusterId: idx };
}

/**
 * XML の { sheetNo, clusterId } → ClusterDefinition.id
 * xml-parser での networks パース時に使用。
 *
 * @param sheetNo   1-based
 * @param clusterId シート内 0-based インデックス (type !== 20)
 * @returns 対応する ClusterDefinition.id。見つからない場合 null
 */
export function resolveInternalId(
  sheetNo: number,
  clusterId: number,
  allClusters: ClusterDefinition[],
): string | null {
  const sheetIndex = sheetNo - 1;
  const sheetClusters = allClusters.filter(
    (c) => c.sheetNo === sheetIndex && c.type !== 20,
  );
  const cluster = sheetClusters[clusterId];
  return cluster ? cluster.id : null;
}

// ─── inputParameters から Items 取得 ─────────────────────────────────────────

/**
 * inputParameters 文字列 ("Items=A,B,C;Labels=...") から Items の値配列を返す。
 * Items が存在しない場合は空配列。
 */
export function getItemsFromCluster(cluster: ClusterDefinition): string[] {
  const parsed = parseInputParameters(cluster.inputParameters);
  const items = parsed["Items"];
  return items ? items.split(",") : [];
}

// ─── バリデーション ──────────────────────────────────────────────────────────

export type ValueLinkValidationResult = {
  valid: boolean;
  errors: string[];
};

/**
 * valueLinks の整合性チェック。
 * - parentValue が親クラスターの Items に存在するか
 * - selectValues の各値が子クラスターの Items に存在するか
 * Items が空のクラスターはチェックをスキップ（自由入力扱い）。
 */
export function validateValueLinks(
  valueLinks: ValueLink[],
  parentCluster: ClusterDefinition,
  childCluster: ClusterDefinition,
): ValueLinkValidationResult {
  const parentItems = getItemsFromCluster(parentCluster);
  const childItems = getItemsFromCluster(childCluster);
  const errors: string[] = [];

  for (const vl of valueLinks) {
    if (parentItems.length > 0 && !parentItems.includes(vl.parentValue)) {
      errors.push(`親の値 "${vl.parentValue}" は親クラスターの Items に存在しません`);
    }
    if (childItems.length > 0) {
      const selected = parseSelectValues(vl.selectValues);
      for (const sv of selected) {
        if (!childItems.includes(sv)) {
          errors.push(`子の値 "${sv}" は子クラスターの Items に存在しません`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

export type NetworkValidationResult = {
  networkId: string;
  errors: string[];
};

/**
 * ネットワーク一覧全体のバリデーション。
 * - 参照先クラスターが存在するか
 * - 自己ループ (prevClusterId === nextClusterId)
 * - 重複エッジ (同一 prev-next ペアが複数)
 */
export function validateNetworks(
  networks: NetworkDefinition[],
  allClusters: ClusterDefinition[],
): NetworkValidationResult[] {
  const results: NetworkValidationResult[] = [];
  const seenEdges = new Set<string>();

  for (const net of networks) {
    const errors: string[] = [];

    const prevResolved = resolveClusterXmlIds(net.prevClusterId, allClusters);
    const nextResolved = resolveClusterXmlIds(net.nextClusterId, allClusters);

    if (!prevResolved) errors.push("親クラスターが見つかりません");
    if (!nextResolved) errors.push("子クラスターが見つかりません");

    if (net.prevClusterId === net.nextClusterId) {
      errors.push("親と子が同じクラスターです（自己ループ）");
    }

    const edgeKey = `${net.prevClusterId}→${net.nextClusterId}`;
    if (seenEdges.has(edgeKey)) {
      errors.push("同じ親→子の接続が重複しています");
    } else {
      seenEdges.add(edgeKey);
    }

    results.push({ networkId: net.id, errors });
  }

  return results;
}

// ─── ファクトリー ────────────────────────────────────────────────────────────

let _netSeq = 0;

/** デフォルト値でネットワーク定義を生成する */
export function createNetwork(prevClusterId: string, nextClusterId: string): NetworkDefinition {
  return {
    id: `net-${Date.now()}-${_netSeq++}`,
    prevClusterId,
    nextClusterId,
    nextAutoInputStart: 1,
    relation: "",
    skip: 0,
    requiredValue: "",
    customMasterSearchField: "",
    checkGroupIdMode: "",
    noNeedToFillOut: 0,
    terminalType: 0,
    nextAutoInput: 0,
    nextAutoInputEdit: 0,
    valueLinks: [],
  };
}
