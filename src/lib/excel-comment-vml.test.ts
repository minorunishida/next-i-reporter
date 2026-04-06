import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildVmlDrawingXml } from "./excel-comment-vml";

describe("buildVmlDrawingXml", () => {
  it("ノート枠は visibility:hidden・x:Visible は付けない（既定は閉じたノート）", () => {
    const xml = buildVmlDrawingXml(1, ["A1"]);
    assert.ok(!xml.includes("<x:Visible"), xml);
    assert.ok(xml.includes('ObjectType="Note"'));
    assert.ok(/visibility:\s*hidden/i.test(xml), xml);
  });
});
