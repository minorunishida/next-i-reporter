import test from "node:test";
import assert from "node:assert/strict";
import { validateClusterParams, validateAllParams } from "./input-parameters-validator.ts";
import type { ClusterDefinition } from "./form-structure.ts";

function makeCluster(overrides: Partial<ClusterDefinition>): ClusterDefinition {
  return {
    id: "0-0",
    name: "テスト",
    type: 30,
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

test("正常なパラメータでは警告なし", () => {
  const cluster = makeCluster({
    inputParameters: "Required=0;Align=Left;Font=MS Gothic;FontSize=11;Weight=Normal;Color=0,0,0",
  });
  const warnings = validateClusterParams(cluster);
  assert.equal(warnings.length, 0);
});

test("number フィールドに非数値で error", () => {
  const cluster = makeCluster({
    inputParameters: "FontSize=abc",
  });
  const warnings = validateClusterParams(cluster);
  assert.ok(warnings.some((w) => w.key === "FontSize" && w.severity === "error"));
});

test("enum フィールドに不正値で error", () => {
  const cluster = makeCluster({
    inputParameters: "Align=Middle",
  });
  const warnings = validateClusterParams(cluster);
  assert.ok(warnings.some((w) => w.key === "Align" && w.severity === "error"));
});

test("boolean フィールドに不正値で warning", () => {
  const cluster = makeCluster({
    inputParameters: "Required=yes",
  });
  const warnings = validateClusterParams(cluster);
  assert.ok(warnings.some((w) => w.key === "Required" && w.severity === "warning"));
});

test("Minimum > Maximum で error", () => {
  const cluster = makeCluster({
    typeName: "InputNumeric",
    type: 65,
    inputParameters: "Minimum=100;Maximum=10",
  });
  const warnings = validateClusterParams(cluster);
  assert.ok(warnings.some((w) => w.key === "Minimum/Maximum" && w.severity === "error"));
});

test("スキーマなしの型では空の警告", () => {
  const cluster = makeCluster({
    typeName: "Action" as ClusterDefinition["typeName"],
    type: 126,
    inputParameters: "ActionType=1;URLToOpen=http://example.com",
  });
  const warnings = validateClusterParams(cluster);
  assert.equal(warnings.length, 0);
});

test("validateAllParams で複数クラスタを一括検証", () => {
  const clusters = [
    makeCluster({ id: "0-0", inputParameters: "FontSize=abc" }),
    makeCluster({ id: "0-1", inputParameters: "Required=0;Align=Left" }),
  ];
  const warnings = validateAllParams(clusters);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].clusterId, "0-0");
});
