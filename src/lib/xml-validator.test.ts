import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { validateConmasTemplate } from "./xml-validator";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const fixturesDir = path.resolve(__dirname, "../../fixtures/xml");

test("validateConmasTemplate accepts a minimal valid template", async () => {
  const xml = await readFile(path.join(fixturesDir, "minimal-valid.xml"), "utf8");
  const result = validateConmasTemplate(xml);

  assert.equal(result.ok, true);
  assert.equal(result.errors.length, 0);
});

test("validateConmasTemplate reports structural problems", async () => {
  const xml = await readFile(path.join(fixturesDir, "invalid-template.xml"), "utf8");
  const result = validateConmasTemplate(xml);

  assert.equal(result.ok, false);
  assert.match(result.errors.map((error) => error.message).join("\n"), /未知の cluster type/);
  assert.match(result.errors.map((error) => error.message).join("\n"), /0-1 の範囲/);
  assert.match(result.errors.map((error) => error.message).join("\n"), /一致しません/);
});
