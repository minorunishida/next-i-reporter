import test from "node:test";
import assert from "node:assert/strict";
import {
  CLUSTER_TYPE_REGISTRY,
  REGISTRY_BY_NAME,
  REGISTRY_BY_VALUE,
  TYPE_NUM_TO_STRING_MAP,
  TYPE_LABELS_JA,
  MVP_TYPE_NAMES,
} from "./cluster-type-registry.ts";

test("レジストリは38型を含む", () => {
  assert.equal(CLUSTER_TYPE_REGISTRY.length, 38);
});

test("value の重複がない", () => {
  const values = CLUSTER_TYPE_REGISTRY.map((e) => e.value);
  assert.equal(new Set(values).size, values.length, "value に重複あり");
});

test("name の重複がない", () => {
  const names = CLUSTER_TYPE_REGISTRY.map((e) => e.name);
  assert.equal(new Set(names).size, names.length, "name に重複あり");
});

test("stDefaultsIndex は 0-37 の連番", () => {
  const indices = CLUSTER_TYPE_REGISTRY.map((e) => e.stDefaultsIndex).sort((a, b) => a - b);
  for (let i = 0; i < 38; i++) {
    assert.equal(indices[i], i, `stDefaultsIndex ${i} が欠落`);
  }
});

test("旧 MVP 9型が正しい値で存在する", () => {
  const expected: Record<string, number> = {
    KeyboardText: 30,
    Date: 40,
    Time: 50,
    InputNumeric: 65,
    Calculate: 67,
    Select: 70,
    Check: 90,
    Image: 100,
    Handwriting: 119,
  };
  for (const [name, value] of Object.entries(expected)) {
    const entry = REGISTRY_BY_NAME.get(name);
    assert.ok(entry, `${name} がレジストリにない`);
    assert.equal(entry.value, value, `${name} の値が異なる: ${entry.value} !== ${value}`);
  }
});

test("FixedText は値 20 (旧バグ 5 ではない)", () => {
  const entry = REGISTRY_BY_NAME.get("FixedText");
  assert.ok(entry);
  assert.equal(entry.value, 20);
});

test("REGISTRY_BY_VALUE で逆引きできる", () => {
  const entry = REGISTRY_BY_VALUE.get(30);
  assert.ok(entry);
  assert.equal(entry.name, "KeyboardText");
});

test("TYPE_NUM_TO_STRING_MAP が全38型を含む", () => {
  assert.equal(Object.keys(TYPE_NUM_TO_STRING_MAP).length, 38);
  assert.equal(TYPE_NUM_TO_STRING_MAP[30], "KeyboardText");
  assert.equal(TYPE_NUM_TO_STRING_MAP[20], "FixedText");
});

test("TYPE_LABELS_JA が全38型の日本語ラベルを含む", () => {
  assert.equal(Object.keys(TYPE_LABELS_JA).length, 38);
  assert.equal(TYPE_LABELS_JA["KeyboardText"], "キーボードテキスト");
  assert.equal(TYPE_LABELS_JA["Image"], "画像");
});

test("MVP_TYPE_NAMES は10型を含む", () => {
  assert.equal(MVP_TYPE_NAMES.length, 10);
  assert.ok(MVP_TYPE_NAMES.includes("KeyboardText"));
  assert.ok(MVP_TYPE_NAMES.includes("FixedText"));
});

test("全エントリに displayNameJa / displayNameEn がある", () => {
  for (const entry of CLUSTER_TYPE_REGISTRY) {
    assert.ok(entry.displayNameJa.length > 0, `${entry.name} の displayNameJa が空`);
    assert.ok(entry.displayNameEn.length > 0, `${entry.name} の displayNameEn が空`);
  }
});
