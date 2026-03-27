import test from "node:test";
import assert from "node:assert/strict";
import { esc, toFW, generateBlankPdfBase64, generateConmasXml } from "./xml-generator.ts";
import { validateConmasTemplate } from "./xml-validator.ts";
import type { AnalysisResult, FormStructure, ClusterDefinition } from "./form-structure.ts";

// --- esc ---

test("esc: escapes &, <, >, quotes", () => {
  assert.equal(esc('a&b<c>d"e\'f'), "a&amp;b&lt;c&gt;d&quot;e&apos;f");
});

test("esc: empty string returns empty", () => {
  assert.equal(esc(""), "");
});

test("esc: no special chars unchanged", () => {
  assert.equal(esc("hello world"), "hello world");
});

// --- toFW ---

test("toFW: single digit", () => {
  assert.equal(toFW(1), "１");
  assert.equal(toFW(0), "０");
  assert.equal(toFW(9), "９");
});

test("toFW: multi digit", () => {
  assert.equal(toFW(10), "１０");
  assert.equal(toFW(123), "１２３");
});

// --- generateBlankPdfBase64 ---

test("generateBlankPdfBase64: 1-page PDF starts with %PDF", () => {
  const b64 = generateBlankPdfBase64(1);
  const decoded = Buffer.from(b64, "base64").toString("binary");
  assert.ok(decoded.startsWith("%PDF-1.4"));
});

test("generateBlankPdfBase64: 3-page PDF contains /Count 3", () => {
  const b64 = generateBlankPdfBase64(3);
  const decoded = Buffer.from(b64, "base64").toString("binary");
  assert.ok(decoded.includes("/Count 3"));
});

// --- generateConmasXml ---

function makeMinimalResult(clusterOverrides?: Partial<ClusterDefinition>[]): AnalysisResult {
  const formStructure: FormStructure = {
    fileName: "test.xlsx",
    sheets: [
      {
        name: "Sheet1",
        index: 0,
        rowCount: 10,
        colCount: 5,
        rowHeights: Array(10).fill(20),
        colWidths: Array(5).fill(64),
        totalWidth: 320,
        totalHeight: 200,
        cells: [],
        pageSetup: { orientation: "portrait", paperSize: "A4", margins: { top: 20, bottom: 20, left: 20, right: 20 } },
      },
    ],
  };

  const clusters: ClusterDefinition[] = (clusterOverrides ?? []).map((o, i) => ({
    id: `0-${i}`,
    name: `クラスタ${i + 1}`,
    type: 30,
    typeName: "KeyboardText" as const,
    sheetNo: 0,
    cellAddress: "A1",
    region: { top: 0, bottom: 20, left: 0, right: 64 },
    confidence: 0.9,
    readOnly: false,
    inputParameters: "Required=0",
    ...o,
  }));

  return {
    formStructure,
    clusters,
    summary: {
      totalClusters: clusters.length,
      highConfidence: clusters.length,
      mediumConfidence: 0,
      lowConfidence: 0,
    },
  };
}

test("generateConmasXml: produces valid XML structure", () => {
  const result = makeMinimalResult([{}]);
  const xml = generateConmasXml(result);
  assert.ok(xml.startsWith('<?xml version="1.0"'));
  assert.ok(xml.includes("<conmas>"));
  assert.ok(xml.includes("</conmas>"));
  assert.ok(xml.includes("<defTopName>test</defTopName>"));
});

test("generateConmasXml: sheetCount matches sheet count", () => {
  const result = makeMinimalResult([{}]);
  const xml = generateConmasXml(result);
  assert.ok(xml.includes("<sheetCount>1</sheetCount>"));
});

test("generateConmasXml: cluster count matches in output", () => {
  const result = makeMinimalResult([{}, { name: "フィールド2", cellAddress: "B2" }]);
  const xml = generateConmasXml(result);
  const clusterMatches = xml.match(/<cluster>/g);
  assert.equal(clusterMatches?.length, 2);
});

test("generateConmasXml: special characters in cluster name are escaped", () => {
  const result = makeMinimalResult([{ name: 'テスト&<>"' }]);
  const xml = generateConmasXml(result);
  assert.ok(xml.includes("テスト&amp;&lt;&gt;&quot;"));
});

test("generateConmasXml: passes validation", () => {
  const result = makeMinimalResult([
    { name: "テキスト入力", type: 30, typeName: "KeyboardText" },
  ]);
  const xml = generateConmasXml(result);
  const validation = validateConmasTemplate(xml);
  assert.equal(validation.ok, true, `Validation errors: ${validation.errors.map(e => e.message).join(", ")}`);
});

test("generateConmasXml: 0 clusters produces valid XML", () => {
  const result = makeMinimalResult([]);
  const xml = generateConmasXml(result);
  assert.ok(xml.includes("<clusters>"));
  assert.ok(xml.includes("</clusters>"));
  const clusterMatches = xml.match(/<cluster>/g);
  assert.equal(clusterMatches, null);
});
