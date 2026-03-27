import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { inspectConmasTemplate } from "./template-inspector";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "../../fixtures/xml");

test("inspectConmasTemplate summarizes generated-style XML", async () => {
  const xml = await readFile(path.join(fixturesDir, "minimal-valid.xml"), "utf8");
  const inspection = inspectConmasTemplate(xml);

  assert.equal(inspection.defTopName, "検証サンプル");
  assert.equal(inspection.declaredSheetCount, 1);
  assert.equal(inspection.actualSheetCount, 1);
  assert.equal(inspection.clusterCount, 2);
  assert.equal(inspection.hasBackgroundImage, true);
  assert.deepEqual(inspection.clusterTypeCounts, {
    FixedText: 1,
    KeyboardText: 1,
  });
  assert.equal(inspection.sheets[0]?.clusterCount, 2);
  assert.equal(inspection.sheets[0]?.clusters[1]?.cellAddress, "B2");
});
