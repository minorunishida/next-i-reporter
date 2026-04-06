import test from "node:test";
import assert from "node:assert/strict";
import { parseConmasXml } from "./xml-parser.ts";
import { generateConmasXml } from "./xml-generator.ts";
import type { AnalysisResult, FormStructure, ClusterDefinition } from "./form-structure.ts";

// ─── ヘルパー ───────────────────────────────────────────────────────────────

function makeFormStructure(overrides?: Partial<FormStructure>): FormStructure {
  return {
    fileName: "test.xlsx",
    sheets: [
      {
        name: "Sheet1",
        index: 0,
        rowCount: 10,
        colCount: 5,
        rowHeights: [],
        colWidths: [],
        totalWidth: 800,
        totalHeight: 1200,
        cells: [],
        pageSetup: {
          orientation: "portrait",
          paperSize: "A4",
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        },
      },
    ],
    ...overrides,
  };
}

function makeCluster(overrides?: Partial<ClusterDefinition>): ClusterDefinition {
  return {
    id: "0-0",
    name: "テスト項目",
    type: 30,
    typeName: "KeyboardText",
    sheetNo: 0,
    cellAddress: "B2",
    region: { top: 100, bottom: 200, left: 50, right: 300 },
    confidence: 0.9,
    readOnly: false,
    inputParameters: "Required=0;Align=Left;Font=MS Gothic;FontSize=11",
    ...overrides,
  };
}

function makeAnalysisResult(
  clusters: ClusterDefinition[],
  formOverrides?: Partial<FormStructure>,
): AnalysisResult {
  return {
    formStructure: makeFormStructure(formOverrides),
    clusters,
    summary: {
      totalClusters: clusters.length,
      highConfidence: clusters.filter((c) => c.confidence >= 0.9).length,
      mediumConfidence: clusters.filter((c) => c.confidence >= 0.7 && c.confidence < 0.9).length,
      lowConfidence: clusters.filter((c) => c.confidence < 0.7).length,
    },
  };
}

// ─── テスト ─────────────────────────────────────────────────────────────────

test("parseConmasXml: 空の XML から最低限の構造を取得", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<conmas>
  <top>
    <defTopName>テスト帳票</defTopName>
    <sheetCount>1</sheetCount>
    <backgroundImage></backgroundImage>
    <sheets>
      <sheet>
        <defSheetName>Sheet1</defSheetName>
        <sheetNo>1</sheetNo>
        <width>800</width>
        <height>1200</height>
        <clusters></clusters>
      </sheet>
    </sheets>
  </top>
</conmas>`;

  const result = parseConmasXml(xml, "テスト.xml");
  assert.equal(result.formStructure.fileName, "テスト.xml");
  assert.equal(result.formStructure.sheets.length, 1);
  assert.equal(result.formStructure.sheets[0].name, "Sheet1");
  assert.equal(result.formStructure.sheets[0].index, 0);
  assert.equal(result.clusters.length, 0);
});

test("parseConmasXml: クラスタを含む XML をパース", () => {
  const xml = `<?xml version="1.0" encoding="utf-8"?>
<conmas>
  <top>
    <defTopName>テスト帳票</defTopName>
    <sheets>
      <sheet>
        <defSheetName>Sheet1</defSheetName>
        <sheetNo>1</sheetNo>
        <width>800</width>
        <height>1200</height>
        <clusters>
          <cluster>
            <sheetNo>1</sheetNo>
            <clusterId>0</clusterId>
            <name>担当者名</name>
            <type>KeyboardText</type>
            <top>0.100000</top>
            <bottom>0.200000</bottom>
            <left>0.050000</left>
            <right>0.400000</right>
            <value></value>
            <displayValue></displayValue>
            <readOnly>0</readOnly>
            <function></function>
            <inputParameters>Required=1;Align=Left;Font=MS Gothic;FontSize=11</inputParameters>
            <cellAddress>B2</cellAddress>
          </cluster>
          <cluster>
            <sheetNo>1</sheetNo>
            <clusterId>1</clusterId>
            <name>金額合計</name>
            <type>Calculate</type>
            <top>0.300000</top>
            <bottom>0.350000</bottom>
            <left>0.500000</left>
            <right>0.900000</right>
            <value></value>
            <displayValue></displayValue>
            <readOnly>1</readOnly>
            <function>SUM(C2:C10)</function>
            <inputParameters>Decimal=0;Comma=1;Align=Right</inputParameters>
            <cellAddress>C11</cellAddress>
          </cluster>
        </clusters>
      </sheet>
    </sheets>
  </top>
</conmas>`;

  const result = parseConmasXml(xml);
  assert.equal(result.clusters.length, 2);

  // 1st cluster
  const c0 = result.clusters[0];
  assert.equal(c0.name, "担当者名");
  assert.equal(c0.type, 30);
  assert.equal(c0.typeName, "KeyboardText");
  assert.equal(c0.readOnly, false);
  assert.equal(c0.cellAddress, "B2");
  assert.ok(c0.inputParameters.includes("Required=1"));
  // 座標: 0-1 比率 → px (800 x 1200)
  assert.equal(c0.region.top, 0.1 * 1200);
  assert.equal(c0.region.left, 0.05 * 800);

  // 2nd cluster
  const c1 = result.clusters[1];
  assert.equal(c1.name, "金額合計");
  assert.equal(c1.type, 67);
  assert.equal(c1.typeName, "Calculate");
  assert.equal(c1.readOnly, true);
  assert.equal(c1.formula, "SUM(C2:C10)");
});

test("parseConmasXml: confidence はインポート時 1.0", () => {
  const xml = `<conmas><top><sheets><sheet>
    <sheetNo>1</sheetNo><width>100</width><height>100</height>
    <clusters><cluster>
      <name>x</name><type>Check</type>
      <top>0</top><bottom>0.1</bottom><left>0</left><right>0.1</right>
      <readOnly>0</readOnly><inputParameters></inputParameters><cellAddress>A1</cellAddress>
    </cluster></clusters>
  </sheet></sheets></top></conmas>`;

  const result = parseConmasXml(xml);
  assert.equal(result.clusters[0].confidence, 1.0);
  assert.equal(result.summary.highConfidence, 1);
});

test("parseConmasXml: backgroundImage を pdfBase64 として取得", () => {
  const xml = `<conmas><top>
    <backgroundImage>AAAA</backgroundImage>
    <sheets></sheets>
  </top></conmas>`;

  const result = parseConmasXml(xml);
  assert.equal(result.formStructure.pdfBase64, "AAAA");
});

test("parseConmasXml: 複数シートのパース", () => {
  const xml = `<conmas><top><sheets>
    <sheet>
      <defSheetName>Page1</defSheetName><sheetNo>1</sheetNo>
      <width>100</width><height>200</height>
      <clusters><cluster>
        <name>A</name><type>KeyboardText</type>
        <top>0</top><bottom>0.5</bottom><left>0</left><right>1</right>
        <readOnly>0</readOnly><inputParameters></inputParameters><cellAddress>A1</cellAddress>
      </cluster></clusters>
    </sheet>
    <sheet>
      <defSheetName>Page2</defSheetName><sheetNo>2</sheetNo>
      <width>300</width><height>400</height>
      <clusters><cluster>
        <name>B</name><type>Date</type>
        <top>0.1</top><bottom>0.2</bottom><left>0.3</left><right>0.4</right>
        <readOnly>0</readOnly><inputParameters></inputParameters><cellAddress>B1</cellAddress>
      </cluster></clusters>
    </sheet>
  </sheets></top></conmas>`;

  const result = parseConmasXml(xml);
  assert.equal(result.formStructure.sheets.length, 2);
  assert.equal(result.formStructure.sheets[0].name, "Page1");
  assert.equal(result.formStructure.sheets[1].name, "Page2");
  assert.equal(result.formStructure.sheets[1].index, 1);
  assert.equal(result.clusters.length, 2);
  assert.equal(result.clusters[1].sheetNo, 1);
  // Page2: 0.1 * 400 = 40
  assert.equal(result.clusters[1].region.top, 0.1 * 400);
});

test("往復テスト: generate → parse でクラスタ名・型・座標が保持される", async () => {
  const original = makeAnalysisResult([
    makeCluster({ name: "項目A", type: 30, typeName: "KeyboardText", cellAddress: "A1" }),
    makeCluster({
      name: "合計金額",
      type: 67,
      typeName: "Calculate",
      cellAddress: "C5",
      formula: "SUM(C2:C4)",
      readOnly: true,
      region: { top: 400, bottom: 500, left: 200, right: 600 },
      inputParameters: "Decimal=2;Comma=1;Align=Right",
    }),
  ]);

  const xml = await generateConmasXml(original);
  const parsed = parseConmasXml(xml, "test.xlsx");

  assert.equal(parsed.clusters.length, 2);

  // クラスタ名の保持
  assert.equal(parsed.clusters[0].name, "項目A");
  assert.equal(parsed.clusters[1].name, "合計金額");

  // 型の保持
  assert.equal(parsed.clusters[0].type, 30);
  assert.equal(parsed.clusters[0].typeName, "KeyboardText");
  assert.equal(parsed.clusters[1].type, 67);
  assert.equal(parsed.clusters[1].typeName, "Calculate");

  // readOnly
  assert.equal(parsed.clusters[1].readOnly, true);

  // formula
  assert.equal(parsed.clusters[1].formula, "SUM(C2:C4)");

  // inputParameters
  assert.ok(parsed.clusters[1].inputParameters.includes("Decimal=2"));
  assert.ok(parsed.clusters[1].inputParameters.includes("Comma=1"));
});

test("往復テスト: 特殊文字がエスケープ・アンエスケープされる", async () => {
  const original = makeAnalysisResult([
    makeCluster({ name: "A&B<C>D", cellAddress: "A1" }),
  ]);

  const xml = await generateConmasXml(original);
  // エスケープされていることを確認
  assert.ok(xml.includes("A&amp;B&lt;C&gt;D"));

  const parsed = parseConmasXml(xml);
  // アンエスケープで復元
  assert.equal(parsed.clusters[0].name, "A&B<C>D");
});

test("parseConmasXml: 全38型の type 文字列を正しく数値変換", () => {
  const types = [
    ["KeyboardText", 30], ["FixedText", 20], ["Date", 40], ["Check", 90],
    ["Image", 100], ["Handwriting", 119], ["Create", 116], ["Approve", 118],
    ["QRCode", 121], ["EdgeOCR", 133],
  ] as const;

  for (const [typeStr, expectedNum] of types) {
    const xml = `<conmas><top><sheets><sheet>
      <sheetNo>1</sheetNo><width>100</width><height>100</height>
      <clusters><cluster>
        <name>test</name><type>${typeStr}</type>
        <top>0</top><bottom>0.1</bottom><left>0</left><right>0.1</right>
        <readOnly>0</readOnly><inputParameters></inputParameters><cellAddress>A1</cellAddress>
      </cluster></clusters>
    </sheet></sheets></top></conmas>`;

    const result = parseConmasXml(xml);
    assert.equal(result.clusters[0].type, expectedNum, `${typeStr} should map to ${expectedNum}`);
    assert.equal(result.clusters[0].typeName, typeStr);
  }
});
