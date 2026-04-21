/**
 * ConMas XML からクラスター座標タグを抽出し、2ファイル間の数値差分に使う。
 */

export type ClusterCoordRow = {
  sheetIndex: number;
  clusterId: string;
  name: string;
  top: number;
  bottom: number;
  left: number;
  right: number;
};

function numTag(block: string, tag: string): number | null {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block);
  if (!m) return null;
  const v = parseFloat(m[1].trim());
  return Number.isFinite(v) ? v : null;
}

function textTag(block: string, tag: string): string {
  const m = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block);
  return m ? m[1].trim() : "";
}

/**
 * `<sheets>` 以下の各 `<sheet>` 内 `<cluster>` から座標を抽出する。
 */
export function extractClusterCoordsFromConmasXml(xml: string): ClusterCoordRow[] {
  const rows: ClusterCoordRow[] = [];
  const sheets = [...xml.matchAll(/<sheet>([\s\S]*?)<\/sheet>/gi)];
  for (let s = 0; s < sheets.length; s++) {
    const sheetBody = sheets[s][1];
    const clusters = [...sheetBody.matchAll(/<cluster>([\s\S]*?)<\/cluster>/gi)];
    for (const [, block] of clusters) {
      const top = numTag(block, "top");
      const bottom = numTag(block, "bottom");
      const left = numTag(block, "left");
      const right = numTag(block, "right");
      if (top === null || bottom === null || left === null || right === null) continue;
      rows.push({
        sheetIndex: s,
        clusterId: textTag(block, "clusterId"),
        name: textTag(block, "name"),
        top,
        bottom,
        left,
        right,
      });
    }
  }
  return rows;
}

export type ClusterCoordDiff = {
  key: string;
  field: "top" | "bottom" | "left" | "right";
  a: number;
  b: number;
  delta: number;
};

/**
 * clusterId + name で対応付けし、座標フィールドの差分を返す（欠損はスキップ）。
 */
export function diffClusterCoordsXml(aXml: string, bXml: string): ClusterCoordDiff[] {
  const a = extractClusterCoordsFromConmasXml(aXml);
  const b = extractClusterCoordsFromConmasXml(bXml);
  const mapB = new Map<string, ClusterCoordRow>();
  for (const row of b) {
    mapB.set(`${row.sheetIndex}|${row.clusterId}|${row.name}`, row);
  }
  const diffs: ClusterCoordDiff[] = [];
  for (const ra of a) {
    const key = `${ra.sheetIndex}|${ra.clusterId}|${ra.name}`;
    const rb = mapB.get(key);
    if (!rb) continue;
    for (const field of ["top", "bottom", "left", "right"] as const) {
      const va = ra[field];
      const vb = rb[field];
      const delta = vb - va;
      if (Math.abs(delta) > 1e-9) {
        diffs.push({ key, field, a: va, b: vb, delta });
      }
    }
  }
  return diffs;
}
