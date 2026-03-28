/**
 * Smart Defaults: クラスター名と型に基づいてインテリジェントな inputParameters を生成する
 *
 * AI 解析後に適用し、パラメータが空または不十分な場合にデフォルト値で補完する。
 * AI が既に詳細なパラメータを提供している場合はそのまま維持する。
 */

import type { ClusterDefinition } from "./form-structure";
import { CLUSTER_TYPES, CLUSTER_TYPES_FULL } from "./form-structure";

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

  // ─── Tier 1 ───────────────────────────────────────────────────────────────

  // FixedText (20)
  {
    typeCode: CLUSTER_TYPES_FULL["FixedText"],
    rules: [],
    fallback: "Required=0;Lines=1;Width=3;Color=0,0,0",
  },
  // MultiSelect (80)
  {
    typeCode: CLUSTER_TYPES_FULL["MultiSelect"],
    rules: [],
    fallback:
      "Display=Dropdown;Punctuation=,;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Align=Left",
  },
  // CalendarDate (111)
  {
    typeCode: CLUSTER_TYPES_FULL["CalendarDate"],
    rules: [
      {
        keywords: ["生年月日", "誕生"],
        params:
          "Required=0;DateFormat=yyyy/MM/dd;AutoInput=0;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Align=Left",
      },
    ],
    fallback:
      "Required=0;DateFormat=yyyy/MM/dd;AutoInput=0;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0;Align=Left",
  },
  // Create (116)
  {
    typeCode: CLUSTER_TYPES_FULL["Create"],
    rules: [],
    fallback: "Required=1;SignType=0;SignShortcut=0",
  },
  // Inspect (117)
  {
    typeCode: CLUSTER_TYPES_FULL["Inspect"],
    rules: [],
    fallback: "Required=0;SignType=0;SignShortcut=0",
  },
  // Approve (118)
  {
    typeCode: CLUSTER_TYPES_FULL["Approve"],
    rules: [],
    fallback: "Required=0;SignType=0;QuickSave=0;RequiredCheck=0",
  },

  // ─── Tier 2 ───────────────────────────────────────────────────────────────

  // Numeric (60)
  {
    typeCode: CLUSTER_TYPES_FULL["Numeric"],
    rules: [
      {
        keywords: ["温度"],
        params:
          "Required=0;Minimum=0;Maximum=200;Decimal=1;Suffix=℃;Stepping=1;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
      {
        keywords: ["金額", "価格", "単価", "合計"],
        params:
          "Required=0;Decimal=0;Comma=1;Stepping=1;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
      },
    ],
    fallback:
      "Required=0;Decimal=0;Stepping=1;Comma=0;Align=Right;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // NumberHours (110)
  {
    typeCode: CLUSTER_TYPES_FULL["NumberHours"],
    rules: [],
    fallback:
      "Required=0;InputType=0;Decimal=0;TimeFormat=HH:mm;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // TimeCalculate (55)
  {
    typeCode: CLUSTER_TYPES_FULL["TimeCalculate"],
    rules: [],
    fallback:
      "TimeFormat=HH:mm;TimeCalculateType=0;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // Registration (112)
  {
    typeCode: CLUSTER_TYPES_FULL["Registration"],
    rules: [],
    fallback: "DisplayUserName=1;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // RegistrationDate (113)
  {
    typeCode: CLUSTER_TYPES_FULL["RegistrationDate"],
    rules: [],
    fallback: "DateFormat=yyyy/MM/dd;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // LatestUpdate (114)
  {
    typeCode: CLUSTER_TYPES_FULL["LatestUpdate"],
    rules: [],
    fallback: "DisplayUserName=1;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // LatestUpdateDate (115)
  {
    typeCode: CLUSTER_TYPES_FULL["LatestUpdateDate"],
    rules: [],
    fallback: "DateFormat=yyyy/MM/dd;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // QRCode (121)
  {
    typeCode: CLUSTER_TYPES_FULL["QRCode"],
    rules: [],
    fallback:
      "Required=0;IsNumeric=0;UseExternalDevice=0;Lines=1;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // CodeReader (122)
  {
    typeCode: CLUSTER_TYPES_FULL["CodeReader"],
    rules: [],
    fallback:
      "Required=0;Lines=1;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  },
  // LoginUser (127)
  {
    typeCode: CLUSTER_TYPES_FULL["LoginUser"],
    rules: [],
    fallback:
      "Required=0;AutoInput=0;FirstOnly=0;DisplayUserName=1;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
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
export function hasDetailedParameters(params: string): boolean {
  if (!params || params.trim() === "") return false;
  const keys = params.split(";").filter((p) => p.includes("="));
  return keys.length >= 3;
}

/**
 * クラスター名とタイプに基づいてスマートデフォルトのパラメータ文字列を返す
 */
export function getSmartDefault(name: string, typeCode: number): string | null {
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
 * クラスター配列にスマートデフォルトを適用する。
 *
 * - inputParameters が空または不十分なクラスターにはデフォルトを設定
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
