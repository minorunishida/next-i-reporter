/**
 * inputParameters のバリデーション
 *
 * XML エクスポート前にクラスタのパラメータをスキーマに照らして検証する。
 */

import { parseInputParameters, PARAMETER_SCHEMAS } from "./input-parameters";
import type { ClusterDefinition } from "./form-structure";

export type ParamWarning = {
  clusterId: string;
  clusterName: string;
  key: string;
  message: string;
  severity: "error" | "warning";
};

/**
 * 単一クラスタの inputParameters をバリデーション
 */
export function validateClusterParams(cluster: ClusterDefinition): ParamWarning[] {
  const warnings: ParamWarning[] = [];
  const schema = PARAMETER_SCHEMAS[cluster.typeName];
  if (!schema) return warnings; // スキーマなしは検証スキップ

  const parsed = parseInputParameters(cluster.inputParameters);

  for (const field of schema.fields) {
    const value = parsed[field.key];

    // number 型: 値があれば数値チェック
    if (field.type === "number" && value !== undefined && value !== "") {
      if (isNaN(Number(value))) {
        warnings.push({
          clusterId: cluster.id,
          clusterName: cluster.name,
          key: field.key,
          message: `${field.label} の値 "${value}" は数値ではありません`,
          severity: "error",
        });
      }
    }

    // enum 型: 値があれば選択肢チェック
    if (field.type === "enum" && field.options && value !== undefined && value !== "") {
      if (!field.options.includes(value)) {
        warnings.push({
          clusterId: cluster.id,
          clusterName: cluster.name,
          key: field.key,
          message: `${field.label} の値 "${value}" は不正です (選択肢: ${field.options.join(", ")})`,
          severity: "error",
        });
      }
    }

    // boolean 型: 0 or 1
    if (field.type === "boolean" && value !== undefined && value !== "") {
      if (value !== "0" && value !== "1" && value !== "true" && value !== "false") {
        warnings.push({
          clusterId: cluster.id,
          clusterName: cluster.name,
          key: field.key,
          message: `${field.label} の値 "${value}" は真偽値 (0/1) ではありません`,
          severity: "warning",
        });
      }
    }
  }

  // Numeric 系の Min/Max 整合性チェック
  if (parsed["Minimum"] && parsed["Maximum"]) {
    const min = Number(parsed["Minimum"]);
    const max = Number(parsed["Maximum"]);
    if (!isNaN(min) && !isNaN(max) && min > max) {
      warnings.push({
        clusterId: cluster.id,
        clusterName: cluster.name,
        key: "Minimum/Maximum",
        message: `最小値 (${min}) が最大値 (${max}) より大きいです`,
        severity: "error",
      });
    }
  }

  return warnings;
}

/**
 * 全クラスタのバリデーション
 */
export function validateAllParams(clusters: ClusterDefinition[]): ParamWarning[] {
  return clusters.flatMap(validateClusterParams);
}
