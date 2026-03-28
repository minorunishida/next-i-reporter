import test from "node:test";
import assert from "node:assert/strict";
import { applySmartDefaults, hasDetailedParameters, getSmartDefault } from "./smart-defaults.ts";
import type { ClusterDefinition } from "./form-structure.ts";
import { CLUSTER_TYPES, CLUSTER_TYPES_FULL } from "./form-structure.ts";

function makeCluster(overrides: Partial<ClusterDefinition>): ClusterDefinition {
  return {
    id: "0-0",
    name: "",
    type: CLUSTER_TYPES.KeyboardText,
    typeName: "KeyboardText",
    sheetNo: 0,
    cellAddress: "A1",
    region: { top: 0, bottom: 10, left: 0, right: 10 },
    confidence: 0.9,
    readOnly: false,
    inputParameters: "",
    ...overrides,
  };
}

// --- hasDetailedParameters ---

test("hasDetailedParameters: empty string returns false", () => {
  assert.equal(hasDetailedParameters(""), false);
});

test("hasDetailedParameters: 2 key=value pairs returns false", () => {
  assert.equal(hasDetailedParameters("Required=0;Align=Left"), false);
});

test("hasDetailedParameters: 3 key=value pairs returns true", () => {
  assert.equal(hasDetailedParameters("Required=0;Align=Left;Font=MS Gothic"), true);
});

// --- getSmartDefault ---

test("getSmartDefault: KeyboardText with '名' keyword returns Required=1 variant", () => {
  const result = getSmartDefault("担当者名", CLUSTER_TYPES.KeyboardText);
  assert.ok(result);
  assert.ok(result.includes("Required=1"));
});

test("getSmartDefault: KeyboardText with '備考' keyword returns Lines=5", () => {
  const result = getSmartDefault("備考欄", CLUSTER_TYPES.KeyboardText);
  assert.ok(result);
  assert.ok(result.includes("Lines=5"));
});

test("getSmartDefault: KeyboardText with no keyword match returns fallback", () => {
  const result = getSmartDefault("テスト項目", CLUSTER_TYPES.KeyboardText);
  assert.ok(result);
  assert.ok(result.includes("Lines=1"));
});

test("getSmartDefault: InputNumeric with '温度' returns Suffix=℃", () => {
  const result = getSmartDefault("温度", CLUSTER_TYPES.InputNumeric);
  assert.ok(result);
  assert.ok(result.includes("Suffix=℃"));
});

test("getSmartDefault: InputNumeric with '金額' returns Comma=1", () => {
  const result = getSmartDefault("金額", CLUSTER_TYPES.InputNumeric);
  assert.ok(result);
  assert.ok(result.includes("Comma=1"));
});

test("getSmartDefault: InputNumeric with '割合' returns Suffix=%", () => {
  const result = getSmartDefault("割合", CLUSTER_TYPES.InputNumeric);
  assert.ok(result);
  assert.ok(result.includes("Suffix=%"));
});

test("getSmartDefault: Date type returns DateFormat", () => {
  const result = getSmartDefault("日付", CLUSTER_TYPES.Date);
  assert.ok(result);
  assert.ok(result.includes("DateFormat=yyyy/MM/dd"));
});

test("getSmartDefault: unknown type code returns null", () => {
  const result = getSmartDefault("test", 999);
  assert.equal(result, null);
});

// --- applySmartDefaults ---

test("applySmartDefaults: cluster with empty params gets default applied", () => {
  const clusters = [makeCluster({ name: "テスト", inputParameters: "" })];
  const result = applySmartDefaults(clusters);
  assert.ok(result[0].inputParameters.length > 0);
});

test("applySmartDefaults: cluster with detailed params is preserved", () => {
  const detailed = "Required=1;Align=Left;Font=MS Gothic;FontSize=12;Weight=Bold";
  const clusters = [makeCluster({ name: "テスト", inputParameters: detailed })];
  const result = applySmartDefaults(clusters);
  assert.equal(result[0].inputParameters, detailed);
});

test("applySmartDefaults: mixed clusters each get appropriate defaults", () => {
  const clusters = [
    makeCluster({ name: "担当者名", type: CLUSTER_TYPES.KeyboardText, typeName: "KeyboardText", inputParameters: "" }),
    makeCluster({ name: "金額", type: CLUSTER_TYPES.InputNumeric, typeName: "InputNumeric", inputParameters: "" }),
    makeCluster({ name: "確認", type: CLUSTER_TYPES.Check, typeName: "Check", inputParameters: "" }),
  ];
  const result = applySmartDefaults(clusters);
  assert.ok(result[0].inputParameters.includes("Required=1"));
  assert.ok(result[1].inputParameters.includes("Comma=1"));
  assert.ok(result[2].inputParameters.includes("Required=0"));
});

// --- Tier 1 新型 ---

test("getSmartDefault: FixedText returns fallback with Lines", () => {
  const result = getSmartDefault("メモ欄", CLUSTER_TYPES_FULL["FixedText"]);
  assert.ok(result);
  assert.ok(result.includes("Lines=1"));
  assert.ok(result.includes("Width=3"));
});

test("getSmartDefault: MultiSelect returns Display=Dropdown", () => {
  const result = getSmartDefault("該当項目", CLUSTER_TYPES_FULL["MultiSelect"]);
  assert.ok(result);
  assert.ok(result.includes("Display=Dropdown"));
});

test("getSmartDefault: CalendarDate returns DateFormat", () => {
  const result = getSmartDefault("実施日", CLUSTER_TYPES_FULL["CalendarDate"]);
  assert.ok(result);
  assert.ok(result.includes("DateFormat=yyyy/MM/dd"));
});

test("getSmartDefault: Create returns Required=1", () => {
  const result = getSmartDefault("作成", CLUSTER_TYPES_FULL["Create"]);
  assert.ok(result);
  assert.ok(result.includes("Required=1"));
});

test("getSmartDefault: Inspect returns SignType", () => {
  const result = getSmartDefault("査閲", CLUSTER_TYPES_FULL["Inspect"]);
  assert.ok(result);
  assert.ok(result.includes("SignType=0"));
});

test("getSmartDefault: Approve returns QuickSave", () => {
  const result = getSmartDefault("承認", CLUSTER_TYPES_FULL["Approve"]);
  assert.ok(result);
  assert.ok(result.includes("QuickSave=0"));
});

// --- Tier 2 新型 ---

test("getSmartDefault: Numeric returns Stepping", () => {
  const result = getSmartDefault("数量", CLUSTER_TYPES_FULL["Numeric"]);
  assert.ok(result);
  assert.ok(result.includes("Stepping=1"));
});

test("getSmartDefault: NumberHours returns InputType", () => {
  const result = getSmartDefault("作業時間", CLUSTER_TYPES_FULL["NumberHours"]);
  assert.ok(result);
  assert.ok(result.includes("InputType=0"));
});

test("getSmartDefault: Registration returns DisplayUserName", () => {
  const result = getSmartDefault("登録者", CLUSTER_TYPES_FULL["Registration"]);
  assert.ok(result);
  assert.ok(result.includes("DisplayUserName=1"));
});

test("getSmartDefault: RegistrationDate returns DateFormat", () => {
  const result = getSmartDefault("登録日", CLUSTER_TYPES_FULL["RegistrationDate"]);
  assert.ok(result);
  assert.ok(result.includes("DateFormat=yyyy/MM/dd"));
});

test("getSmartDefault: QRCode returns IsNumeric", () => {
  const result = getSmartDefault("バーコード", CLUSTER_TYPES_FULL["QRCode"]);
  assert.ok(result);
  assert.ok(result.includes("IsNumeric=0"));
});

test("getSmartDefault: LoginUser returns AutoInput", () => {
  const result = getSmartDefault("記入者", CLUSTER_TYPES_FULL["LoginUser"]);
  assert.ok(result);
  assert.ok(result.includes("AutoInput=0"));
});
