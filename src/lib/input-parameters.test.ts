import test from "node:test";
import assert from "node:assert/strict";
import {
  parseInputParameters,
  serializeInputParameters,
  getTypedParams,
  PARAMETER_SCHEMAS,
} from "./input-parameters.ts";

// ─── parseInputParameters ───────────────────────────────────────────────────

test("基本的な key=value パース", () => {
  const result = parseInputParameters("Required=1;Align=Left;FontSize=11");
  assert.deepEqual(result, { Required: "1", Align: "Left", FontSize: "11" });
});

test("空文字列は空オブジェクト", () => {
  assert.deepEqual(parseInputParameters(""), {});
  assert.deepEqual(parseInputParameters("  "), {});
});

test(";; エスケープが ; にアンエスケープされる", () => {
  const result = parseInputParameters("Items=A;;B;;C;Required=1");
  assert.equal(result["Items"], "A;B;C");
  assert.equal(result["Required"], "1");
});

test("値なしキーは空文字列", () => {
  const result = parseInputParameters("Required=1;EmptyKey;Font=MS Gothic");
  assert.equal(result["EmptyKey"], "");
  assert.equal(result["Required"], "1");
  assert.equal(result["Font"], "MS Gothic");
});

test("値に = を含む場合", () => {
  const result = parseInputParameters("Function=IF(A>B,1,0)=result;Required=0");
  assert.equal(result["Function"], "IF(A>B,1,0)=result");
  assert.equal(result["Required"], "0");
});

test("末尾のセミコロンを無視", () => {
  const result = parseInputParameters("Required=1;Font=MS Gothic;");
  assert.deepEqual(result, { Required: "1", Font: "MS Gothic" });
});

test("null/undefined 入力", () => {
  assert.deepEqual(parseInputParameters(null as unknown as string), {});
  assert.deepEqual(parseInputParameters(undefined as unknown as string), {});
});

// ─── serializeInputParameters ───────────────────────────────────────────────

test("基本的なシリアライズ", () => {
  const result = serializeInputParameters({ Required: "1", Align: "Left", FontSize: "11" });
  assert.equal(result, "Required=1;Align=Left;FontSize=11");
});

test("null/undefined 値はスキップ", () => {
  const result = serializeInputParameters({ Required: "1", Align: null, Font: undefined, FontSize: "11" });
  assert.equal(result, "Required=1;FontSize=11");
});

test("値中の ; が ;; にエスケープ", () => {
  const result = serializeInputParameters({ Items: "A;B;C", Required: "1" });
  assert.equal(result, "Items=A;;B;;C;Required=1");
});

test("空オブジェクトは空文字列", () => {
  assert.equal(serializeInputParameters({}), "");
});

// ─── ラウンドトリップ ───────────────────────────────────────────────────────

test("parse → serialize ラウンドトリップ (基本)", () => {
  const original = "Required=1;Align=Left;Font=MS Gothic;FontSize=11";
  const parsed = parseInputParameters(original);
  const serialized = serializeInputParameters(parsed);
  assert.equal(serialized, original);
});

test("parse → serialize ラウンドトリップ (;; エスケープ)", () => {
  const original = "Items=A;;B;;C;Required=1";
  const parsed = parseInputParameters(original);
  const serialized = serializeInputParameters(parsed);
  assert.equal(serialized, original);
});

// ─── PARAMETER_SCHEMAS ──────────────────────────────────────────────────────

test("MVP + Tier 1/2 全型のスキーマが定義されている", () => {
  const expected = [
    // MVP
    "KeyboardText", "InputNumeric", "Date", "Time",
    "Calculate", "Select", "Check", "Image", "Handwriting", "FixedText",
    // Tier 1
    "MultiSelect", "CalendarDate", "Create", "Inspect", "Approve",
    // Tier 2
    "Numeric", "NumberHours", "TimeCalculate",
    "Registration", "RegistrationDate", "LatestUpdate", "LatestUpdateDate",
    "QRCode", "CodeReader", "LoginUser",
  ];
  for (const name of expected) {
    assert.ok(PARAMETER_SCHEMAS[name], `${name} のスキーマがない`);
    assert.ok(PARAMETER_SCHEMAS[name].fields.length > 0, `${name} のフィールドが空`);
  }
  assert.equal(Object.keys(PARAMETER_SCHEMAS).length, expected.length, "スキーマ数が合わない");
});

test("各スキーマのフィールドに key, type, defaultValue, label がある", () => {
  for (const [typeName, schema] of Object.entries(PARAMETER_SCHEMAS)) {
    for (const field of schema.fields) {
      assert.ok(field.key, `${typeName}: key が空`);
      assert.ok(field.type, `${typeName}.${field.key}: type が空`);
      assert.ok(field.label, `${typeName}.${field.key}: label が空`);
      assert.ok(field.defaultValue !== undefined, `${typeName}.${field.key}: defaultValue が undefined`);
    }
  }
});

// ─── getTypedParams ─────────────────────────────────────────────────────────

test("getTypedParams はスキーマのデフォルト値で補完する", () => {
  const result = getTypedParams("KeyboardText", "Required=1;Lines=3");
  assert.equal(result["Required"], "1");      // 元値を維持
  assert.equal(result["Lines"], "3");          // 元値を維持
  assert.equal(result["Align"], "Left");       // デフォルトで補完
  assert.equal(result["Font"], "MS Gothic");   // デフォルトで補完
});

test("getTypedParams はスキーマ外のキーも保持する", () => {
  const result = getTypedParams("KeyboardText", "Required=1;CustomKey=CustomValue");
  assert.equal(result["Required"], "1");
  assert.equal(result["CustomKey"], "CustomValue");
});

test("getTypedParams は未知の型名でも動作する", () => {
  const result = getTypedParams("UnknownType", "Foo=Bar");
  assert.deepEqual(result, { Foo: "Bar" });
});
