import test from "node:test";
import assert from "node:assert/strict";
import {
  parseSelectValues,
  serializeSelectValues,
  resolveClusterXmlIds,
  resolveInternalId,
  getItemsFromCluster,
  validateValueLinks,
  validateNetworks,
} from "./network-utils.ts";
import type { ClusterDefinition, NetworkDefinition } from "./form-structure.ts";

// ─── テスト用クラスターファクトリー ─────────────────────────────────────────

function makeCluster(
  id: string,
  sheetNo: number,
  type = 70,
  inputParameters = "",
): ClusterDefinition {
  return {
    id,
    name: `cluster-${id}`,
    type,
    typeName: "Select",
    sheetNo,
    cellAddress: "A1",
    region: { top: 0, bottom: 100, left: 0, right: 100 },
    confidence: 1,
    readOnly: false,
    inputParameters,
  };
}

// ─── parseSelectValues / serializeSelectValues ───────────────────────────────

test("parseSelectValues: 空文字は空配列", () => {
  assert.deepEqual(parseSelectValues(""), []);
});

test("parseSelectValues: 単一値", () => {
  assert.deepEqual(parseSelectValues("A"), ["A"]);
});

test("parseSelectValues: 複数値", () => {
  assert.deepEqual(parseSelectValues("A,B,C"), ["A", "B", "C"]);
});

test("parseSelectValues: ,, はカンマ1個を意味する", () => {
  assert.deepEqual(parseSelectValues("A,,B"), ["A,B"]);
});

test("parseSelectValues: ,, を含む値と通常の区切り", () => {
  assert.deepEqual(parseSelectValues("A,,B,C"), ["A,B", "C"]);
});

test("parseSelectValues: 先頭と末尾の ,,", () => {
  assert.deepEqual(parseSelectValues(",,A,B,,"), [",A", "B,"]);
});

test("serializeSelectValues: 空配列は空文字", () => {
  assert.equal(serializeSelectValues([]), "");
});

test("serializeSelectValues: 単一値", () => {
  assert.equal(serializeSelectValues(["A"]), "A");
});

test("serializeSelectValues: 複数値", () => {
  assert.equal(serializeSelectValues(["A", "B", "C"]), "A,B,C");
});

test("serializeSelectValues: カンマを含む値は ,, にエスケープ", () => {
  assert.equal(serializeSelectValues(["A,B", "C"]), "A,,B,C");
});

test("parseSelectValues/serializeSelectValues ラウンドトリップ", () => {
  const values = ["X,Y", "Z", "W,W"];
  assert.deepEqual(parseSelectValues(serializeSelectValues(values)), values);
});

// ─── resolveClusterXmlIds ────────────────────────────────────────────────────

const clusters3 = [
  makeCluster("0-0", 0),
  makeCluster("0-1", 0),
  makeCluster("0-2", 0),
  makeCluster("1-3", 1),
  makeCluster("1-4", 1),
];

test("resolveClusterXmlIds: Sheet0 の最初のクラスター", () => {
  assert.deepEqual(resolveClusterXmlIds("0-0", clusters3), { sheetNo: 1, clusterId: 0 });
});

test("resolveClusterXmlIds: Sheet0 の3番目のクラスター", () => {
  assert.deepEqual(resolveClusterXmlIds("0-2", clusters3), { sheetNo: 1, clusterId: 2 });
});

test("resolveClusterXmlIds: Sheet1 の最初のクラスター", () => {
  assert.deepEqual(resolveClusterXmlIds("1-3", clusters3), { sheetNo: 2, clusterId: 0 });
});

test("resolveClusterXmlIds: Sheet1 の2番目のクラスター", () => {
  assert.deepEqual(resolveClusterXmlIds("1-4", clusters3), { sheetNo: 2, clusterId: 1 });
});

test("resolveClusterXmlIds: 存在しない id は null", () => {
  assert.equal(resolveClusterXmlIds("0-99", clusters3), null);
});

test("resolveClusterXmlIds: 不正な id は null", () => {
  assert.equal(resolveClusterXmlIds("invalid", clusters3), null);
});

test("resolveClusterXmlIds: type 20 はカウントしない", () => {
  const cs = [
    makeCluster("0-0", 0, 20), // type=20: スキップ
    makeCluster("0-1", 0, 70),
    makeCluster("0-2", 0, 70),
  ];
  // type 20 を除いた場合: "0-1" → idx=0, "0-2" → idx=1
  assert.deepEqual(resolveClusterXmlIds("0-1", cs), { sheetNo: 1, clusterId: 0 });
  assert.deepEqual(resolveClusterXmlIds("0-2", cs), { sheetNo: 1, clusterId: 1 });
  // type 20 自体は解決できない (type 20 はカウントされないため配列に含まれない)
  assert.equal(resolveClusterXmlIds("0-0", cs), null);
});

// ─── resolveInternalId ───────────────────────────────────────────────────────

test("resolveInternalId: Sheet1 clusterId=0 → '0-0'", () => {
  assert.equal(resolveInternalId(1, 0, clusters3), "0-0");
});

test("resolveInternalId: Sheet1 clusterId=2 → '0-2'", () => {
  assert.equal(resolveInternalId(1, 2, clusters3), "0-2");
});

test("resolveInternalId: Sheet2 clusterId=0 → '1-3'", () => {
  assert.equal(resolveInternalId(2, 0, clusters3), "1-3");
});

test("resolveInternalId: 存在しないインデックスは null", () => {
  assert.equal(resolveInternalId(1, 99, clusters3), null);
});

test("resolveClusterXmlIds / resolveInternalId ラウンドトリップ", () => {
  for (const c of clusters3.filter((c) => c.type !== 20)) {
    const xml = resolveClusterXmlIds(c.id, clusters3);
    assert.ok(xml, `${c.id} が解決できない`);
    const back = resolveInternalId(xml.sheetNo, xml.clusterId, clusters3);
    assert.equal(back, c.id, `ラウンドトリップ失敗: ${c.id}`);
  }
});

// ─── getItemsFromCluster ─────────────────────────────────────────────────────

test("getItemsFromCluster: Items なし", () => {
  const c = makeCluster("0-0", 0, 70, "Required=1");
  assert.deepEqual(getItemsFromCluster(c), []);
});

test("getItemsFromCluster: Items あり", () => {
  const c = makeCluster("0-0", 0, 70, "Items=A,B,C;Labels=ラベルA,ラベルB,ラベルC");
  assert.deepEqual(getItemsFromCluster(c), ["A", "B", "C"]);
});

test("getItemsFromCluster: inputParameters が空", () => {
  const c = makeCluster("0-0", 0, 70, "");
  assert.deepEqual(getItemsFromCluster(c), []);
});

test("getItemsFromCluster: ;; エスケープを含む Items", () => {
  const c = makeCluster("0-0", 0, 70, "Items=A;;B,C");
  assert.deepEqual(getItemsFromCluster(c), ["A;B", "C"]);
});

// ─── validateValueLinks ──────────────────────────────────────────────────────

const parentCluster = makeCluster("0-0", 0, 70, "Items=A,B,C");
const childCluster = makeCluster("0-1", 0, 70, "Items=X,Y,Z");

test("validateValueLinks: 正常ケース", () => {
  const result = validateValueLinks(
    [{ parentValue: "A", selectValues: "X,Y" }],
    parentCluster,
    childCluster,
  );
  assert.ok(result.valid);
  assert.equal(result.errors.length, 0);
});

test("validateValueLinks: parentValue が Items に存在しない", () => {
  const result = validateValueLinks(
    [{ parentValue: "D", selectValues: "X" }],
    parentCluster,
    childCluster,
  );
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("D")));
});

test("validateValueLinks: selectValues の値が子 Items に存在しない", () => {
  const result = validateValueLinks(
    [{ parentValue: "A", selectValues: "W" }],
    parentCluster,
    childCluster,
  );
  assert.ok(!result.valid);
  assert.ok(result.errors.some((e) => e.includes("W")));
});

test("validateValueLinks: Items が空のクラスターはスキップ", () => {
  const emptyParent = makeCluster("0-0", 0, 30, ""); // KeyboardText
  const emptyChild = makeCluster("0-1", 0, 30, "");
  const result = validateValueLinks(
    [{ parentValue: "anything", selectValues: "anything" }],
    emptyParent,
    emptyChild,
  );
  assert.ok(result.valid);
});

// ─── validateNetworks ────────────────────────────────────────────────────────

function makeNetwork(id: string, prev: string, next: string): NetworkDefinition {
  return {
    id,
    prevClusterId: prev,
    nextClusterId: next,
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

test("validateNetworks: 正常ケース", () => {
  const nets = [makeNetwork("net-0", "0-0", "0-1")];
  const results = validateNetworks(nets, clusters3);
  assert.equal(results[0].errors.length, 0);
});

test("validateNetworks: 存在しないクラスター参照", () => {
  const nets = [makeNetwork("net-0", "0-99", "0-1")];
  const results = validateNetworks(nets, clusters3);
  assert.ok(results[0].errors.some((e) => e.includes("親クラスター")));
});

test("validateNetworks: 自己ループ", () => {
  const nets = [makeNetwork("net-0", "0-0", "0-0")];
  const results = validateNetworks(nets, clusters3);
  assert.ok(results[0].errors.some((e) => e.includes("自己ループ")));
});

test("validateNetworks: 重複エッジ", () => {
  const nets = [
    makeNetwork("net-0", "0-0", "0-1"),
    makeNetwork("net-1", "0-0", "0-1"),
  ];
  const results = validateNetworks(nets, clusters3);
  assert.equal(results[0].errors.length, 0);
  assert.ok(results[1].errors.some((e) => e.includes("重複")));
});
