/**
 * Smart Defaults: クラスタ名と型に基づいてインテリジェントな inputParameters を生成する
 *
 * AI 解析後に適用し、パラメータが空または不十分な場合にデフォルト値で補完する。
 * AI が既に詳細なパラメータを提供している場合はそのまま維持する。
 */

import type { ClusterDefinition } from "./form-structure";
import { CLUSTER_TYPES } from "./form-structure";

// --- パラメータ定義テーブル ---

type NameRule = {
  keywords: string[];
  params: string;
};

type TypeDefaults = {
  typeCode: number;
  rules: NameRule[];
  fallback: string;
};

const TYPE_DEFAULTS: TypeDefaults[] = [
  // KeyboardText (30)
  {
    typeCode: CLUSTER_TYPES.KeyboardText,
    rules: [
      {
        keywords: ["名", "担当", "氏名"],
        params:
          "Required=1;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Lines=1;FontPriority=0",
      },
      {
        keywords: ["住所", "アドレス"],
        params:
          "Required=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Lines=2;FontPriority=1",
      },
      {
        keywords: ["備考", "メモ", "注記"],
        params:
          "Required=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Lines=5;FontPriority=1",
      },
    ],
    fallback:
      "Required=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Lines=1;FontPriority=0",
  },
  // InputNumeric (65)
  {
    typeCode: CLUSTER_TYPES.InputNumeric,
    rules: [
      {
        keywords: ["温度"],
        params:
          "Required=0;Minimum=0;Maximum=200;Decimal=1;Suffix=℃;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
      {
        keywords: ["金額", "価格", "単価", "合計"],
        params:
          "Required=0;Decimal=0;Comma=1;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
      {
        keywords: ["数量", "個数"],
        params:
          "Required=0;Minimum=0;Decimal=0;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
      {
        keywords: ["割合", "%", "率"],
        params:
          "Required=0;Minimum=0;Maximum=100;Decimal=1;Suffix=%;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
    ],
    fallback:
      "Required=0;Decimal=0;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // Date (40)
  {
    typeCode: CLUSTER_TYPES.Date,
    rules: [
      {
        keywords: ["生年月日", "誕生"],
        params:
          "Required=0;DateFormat=yyyy/MM/dd;AutoInput=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
    ],
    fallback:
      "Required=0;DateFormat=yyyy/MM/dd;AutoInput=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // Time (50)
  {
    typeCode: CLUSTER_TYPES.Time,
    rules: [],
    fallback:
      "Required=0;TimeFormat=HH:mm;AutoInput=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // Calculate (67)
  {
    typeCode: CLUSTER_TYPES.Calculate,
    rules: [
      {
        keywords: ["金額", "合計", "小計"],
        params:
          "Decimal=0;Comma=1;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
    ],
    fallback:
      "Decimal=0;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // FixedText (20)
  {
    typeCode: CLUSTER_TYPES.FixedText,
    rules: [],
    fallback: "Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Align=Left",
  },
  // Select (70)
  {
    typeCode: CLUSTER_TYPES.Select,
    rules: [],
    fallback:
      "Required=0;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // Check (90)
  {
    typeCode: CLUSTER_TYPES.Check,
    rules: [],
    fallback: "Required=0",
  },
  // Image (100)
  {
    typeCode: CLUSTER_TYPES.Image,
    rules: [],
    fallback: "Required=0",
  },
  // Handwriting (119)
  {
    typeCode: CLUSTER_TYPES.Handwriting,
    rules: [],
    fallback: "Required=0",
  },
];

// typeCode → TypeDefaults のルックアップマップ
const defaultsByType = new Map<number, TypeDefaults>(
  TYPE_DEFAULTS.map((td) => [td.typeCode, td])
);

/**
 * パラメータが「詳細に設定済み」かどうかを判定する。
 * セミコロン区切りのキーが3つ以上あれば「十分」とみなす。
 */
function hasDetailedParameters(params: string): boolean {
  if (!params || params.trim() === "") return false;
  const keys = params.split(";").filter((p) => p.includes("="));
  return keys.length >= 3;
}

/**
 * クラスタ名とタイプに基づいてスマートデフォルトのパラメータ文字列を返す
 */
function getSmartDefault(name: string, typeCode: number): string | null {
  const typeDef = defaultsByType.get(typeCode);
  if (!typeDef) return null;

  // 名前ベースのルールを先にチェック (最初にマッチしたものを使用)
  for (const rule of typeDef.rules) {
    if (rule.keywords.some((kw) => name.includes(kw))) {
      return rule.params;
    }
  }

  return typeDef.fallback;
}

/**
 * クラスタ配列にスマートデフォルトを適用する。
 *
 * - inputParameters が空または不十分なクラスタにはデフォルトを設定
 * - AI が既に詳細なパラメータを提供している場合はそのまま維持
 */
export function applySmartDefaults(
  clusters: ClusterDefinition[]
): ClusterDefinition[] {
  return clusters.map((cluster) => {
    // AI が既に十分なパラメータを設定していれば変更しない
    if (hasDetailedParameters(cluster.inputParameters)) {
      return cluster;
    }

    const smartDefault = getSmartDefault(cluster.name, cluster.type);
    if (smartDefault === null) {
      return cluster;
    }

    return {
      ...cluster,
      inputParameters: smartDefault,
    };
  });
}
