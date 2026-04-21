/**
 * 2つの ConMas XML の <cluster> 座標を比較する CLI。
 *
 *   npm run diff-cluster-xml -- path/to/designer.xml path/to/generated.xml
 */

import { readFileSync } from "node:fs";
import {
  diffClusterCoordsXml,
  extractClusterCoordsFromConmasXml,
} from "../src/lib/cluster-xml-coords";

const aPath = process.argv[2];
const bPath = process.argv[3];

if (!aPath || !bPath) {
  console.error(
    "Usage: npm run diff-cluster-xml -- <designer.xml> <other.xml>"
  );
  process.exit(1);
}

const xmlA = readFileSync(aPath, "utf8");
const xmlB = readFileSync(bPath, "utf8");
const diffs = diffClusterCoordsXml(xmlA, xmlB);

if (diffs.length === 0) {
  console.log(
    "一致: 対応するクラスター（sheetIndex|clusterId|name）で座標差分はありません。"
  );
} else {
  console.log("座標差分 (b - a):");
  for (const d of diffs) {
    console.log(
      `  ${d.key}  ${d.field}: a=${d.a}  b=${d.b}  delta=${d.delta.toFixed(8)}`
    );
  }
}

const na = extractClusterCoordsFromConmasXml(xmlA).length;
const nb = extractClusterCoordsFromConmasXml(xmlB).length;
console.log(`\nクラスター数: A=${na}  B=${nb}`);
