import test from "node:test";
import assert from "node:assert/strict";
import {
  extractClusterCoordsFromConmasXml,
  diffClusterCoordsXml,
} from "./cluster-xml-coords.ts";

const sampleXml = `<?xml version="1.0"?>
<conmas>
  <top>
    <sheets>
      <sheet>
        <clusters>
          <cluster>
            <clusterId>0</clusterId>
            <name>宛名</name>
            <top>0.1</top>
            <bottom>0.2</bottom>
            <left>0.3</left>
            <right>0.4</right>
          </cluster>
        </clusters>
      </sheet>
    </sheets>
  </top>
</conmas>`;

test("extractClusterCoordsFromConmasXml: reads cluster floats", () => {
  const rows = extractClusterCoordsFromConmasXml(sampleXml);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "宛名");
  assert.equal(rows[0].top, 0.1);
  assert.equal(rows[0].right, 0.4);
});

test("diffClusterCoordsXml: reports deltas when coords differ", () => {
  const b = sampleXml.replace("<top>0.1</top>", "<top>0.15</top>");
  const diffs = diffClusterCoordsXml(sampleXml, b);
  assert.ok(diffs.some((d) => d.field === "top" && Math.abs(d.delta - 0.05) < 1e-9));
});

test("diffClusterCoordsXml: no diffs when identical", () => {
  assert.equal(diffClusterCoordsXml(sampleXml, sampleXml).length, 0);
});
