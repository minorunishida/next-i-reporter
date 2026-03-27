import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { diffConmasTemplates } from "./template-diff";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "../../fixtures/xml");

test("diffConmasTemplates reports identical templates", async () => {
  const xml = await readFile(path.join(fixturesDir, "minimal-valid.xml"), "utf8");
  const diff = diffConmasTemplates(xml, xml);

  assert.equal(diff.identical, true);
  assert.equal(diff.differences.length, 0);
});

test("diffConmasTemplates reports structural differences", async () => {
  const left = await readFile(path.join(fixturesDir, "minimal-valid.xml"), "utf8");
  const right = await readFile(path.join(fixturesDir, "minimal-variant.xml"), "utf8");
  const diff = diffConmasTemplates(left, right);

  assert.equal(diff.identical, false);
  assert.match(diff.differences.join("\n"), /top\.defTopName differs/);
  assert.match(diff.differences.join("\n"), /clusterCount differs/);
  assert.match(diff.differences.join("\n"), /clusterTypes\.Check differs/);
});
