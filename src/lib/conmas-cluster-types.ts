/**
 * ConMas クラスタ型の数値↔文字列変換
 * cluster-type-registry.ts から導出
 */

import { TYPE_NUM_TO_STRING_MAP, CLUSTER_TYPE_REGISTRY } from "./cluster-type-registry";

export const TYPE_NUM_TO_STRING: Record<number, string> = TYPE_NUM_TO_STRING_MAP;

export const VALID_CLUSTER_TYPE_NAMES: Set<string> = new Set(
  CLUSTER_TYPE_REGISTRY.map((e) => e.name),
);
