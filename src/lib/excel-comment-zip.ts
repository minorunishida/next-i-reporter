/**
 * xlsx (OOXML) を JSZip で開き、コメントパーツのみ差し替える。
 * SheetJS の read/write によるブック再生成は行わない（書式・スタイル破壊の回避）。
 * @see excel-cleaner.ts（同様の ZIP 直接操作）
 */
import JSZip from "jszip";
import { normalizeCommentRawForWrite } from "./cell-comment-build";
import { buildVmlDrawingXml } from "./excel-comment-vml";

/** Add-in 一括上限（cell-comment-spec.md） */
export const MAX_ZIP_COMMENT_CELLS = 1000;

const REL_COMMENTS =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments";
const REL_VML =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/vmlDrawing";
const CT_COMMENTS =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.comments+xml";
const CT_VML =
  "application/vnd.openxmlformats-officedocument.vmlDrawing";
const PKG_RELS_NS = "http://schemas.openxmlformats.org/package/2006/relationships";

export type ZipCommentUpdate = {
  sheetName: string;
  /**
   * ワークブック先頭からの 0-based シート順。
   * 名前（日本語・表記ゆれ）が zip 内 workbook.xml と一致しないときのフォールバック。
   */
  sheetIndex?: number;
  /** A1 形式（$ 可） */
  address: string;
  text: string;
};

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function unescapeSheetName(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function normalizeRef(addr: string): string {
  return addr.replace(/\$/g, "").split(":")[0]?.trim().toUpperCase() ?? "";
}

function resolveRelative(basePath: string, target: string): string {
  const baseDir = basePath.split("/").filter(Boolean);
  baseDir.pop();
  const segs = target.split("/").filter(Boolean);
  const stack = [...baseDir];
  for (const s of segs) {
    if (s === "..") stack.pop();
    else if (s && s !== ".") stack.push(s);
  }
  return stack.join("/");
}

function relativePathFromSheetToComments(
  sheetPath: string,
  commentsPath: string
): string {
  const a = sheetPath.split("/");
  const b = commentsPath.split("/");
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  const up = a.length - 1 - i;
  const prefix = up > 0 ? "../".repeat(up) : "";
  const rest = b.slice(i).join("/");
  return prefix + rest;
}

function nextCommentsFileName(zip: JSZip): string {
  let max = 0;
  for (const relPath of Object.keys(zip.files)) {
    const m = relPath.match(/^xl\/comments(\d+)\.xml$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `xl/comments${max + 1}.xml`;
}

function nextFreeRid(relsXml: string): number {
  let max = 0;
  const re = /Id="rId(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) {
    max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

/** 既存 comments.xml から ref -> プレーンテキスト（<t> 結合） */
function parseCommentsXmlToMap(xml: string): Map<string, string> {
  const map = new Map<string, string>();
  const blockRe =
    /<comment\s+[^>]*ref="([^"]+)"[^>]*>([\s\S]*?)<\/comment>/gi;
  let m: RegExpExecArray | null;
  while ((m = blockRe.exec(xml)) !== null) {
    const ref = normalizeRef(m[1]);
    const inner = m[2];
    const ts: string[] = [];
    const tRe = /<(?:\w+:)?t[^>]*>([\s\S]*?)<\/(?:\w+:)?t>/gi;
    let tm: RegExpExecArray | null;
    while ((tm = tRe.exec(inner)) !== null) {
      ts.push(
        tm[1]
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/&amp;/g, "&")
          .replace(/&quot;/g, '"')
      );
    }
    if (ref) map.set(ref, ts.join("\n"));
  }
  return map;
}

function buildCommentsXml(refToText: Map<string, string>): string {
  const author = "next-i-reporter";
  const refs = [...refToText.keys()].sort();
  const parts: string[] = [];
  parts.push('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>');
  parts.push(
    `<comments xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">`,
  );
  parts.push(`<authors><author>${escapeXml(author)}</author></authors>`);
  parts.push("<commentList>");
  for (const ref of refs) {
    const text = refToText.get(ref) ?? "";
    parts.push(
      `<comment ref="${escapeXml(ref)}" authorId="0"><text><t xml:space="preserve">${escapeXml(
        text,
      )}</t></text></comment>`,
    );
  }
  parts.push("</commentList></comments>");
  return parts.join("");
}

async function ensureContentTypeAsync(
  zip: JSZip,
  partPath: string,
  contentType: string,
): Promise<void> {
  const partName = "/" + partPath.replace(/^\/+/, "");
  const ctPath = "[Content_Types].xml";
  const ct = (await zip.file(ctPath)?.async("string")) ?? "";
  if (ct.includes(`PartName="${partName}"`)) return;
  const insert = `<Override PartName="${partName}" ContentType="${contentType}"/>`;
  const updated = ct.replace(/<Types[^>]*>/, (h) => h + insert);
  zip.file(ctPath, updated);
}

function appendRelationship(
  relsXml: string,
  rId: number,
  relType: string,
  target: string,
): string {
  const rel = `<Relationship Id="rId${rId}" Type="${relType}" Target="${target}"/>`;
  if (relsXml.includes("xmlns=")) {
    return relsXml.replace(
      /<\/Relationships>\s*$/i,
      rel + "</Relationships>",
    );
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="${PKG_RELS_NS}">${rel}</Relationships>`;
}

function hasRelType(relsXml: string, relType: string): boolean {
  return relsXml.includes(relType);
}

function getTargetForRelType(relsXml: string, relType: string): string | null {
  const re = /<Relationship\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) {
    const b = m[0];
    if (!b.includes(relType)) continue;
    const tm = b.match(/Target="([^"]*)"/);
    if (tm) return tm[1];
  }
  return null;
}

function getRidForRelType(relsXml: string, relType: string): number | null {
  const re = /<Relationship\b[^>]*\/?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) {
    const b = m[0];
    if (!b.includes(relType)) continue;
    const idm = b.match(/Id="rId(\d+)"/);
    if (idm) return parseInt(idm[1], 10);
  }
  return null;
}

/** xl/worksheets/sheet3.xml → 3 */
function sheetPathToSheetNum(sheetPath: string): number {
  const m = sheetPath.match(/sheet(\d+)\.xml$/i);
  return m ? parseInt(m[1], 10) : 1;
}

function insertLegacyDrawingIfMissing(
  sheetXml: string,
  rIdNum: number,
): string {
  if (/<legacyDrawing\b/i.test(sheetXml)) return sheetXml;
  const tag = `<legacyDrawing r:id="rId${rIdNum}"/>`;
  return sheetXml.replace(
    /<\/((?:[\w.]+:)?worksheet)>\s*$/im,
    `${tag}</$1>`,
  );
}

type WorkbookSheetIndex = {
  nameToPath: Map<string, string>;
  /** workbook.xml の <sheet> 出現順（0-based インデックス = ここでの順序） */
  orderedPaths: string[];
};

function buildWorkbookSheetIndex(
  wbXml: string,
  wbRels: string,
): WorkbookSheetIndex {
  const nameToPath = new Map<string, string>();
  const orderedPaths: string[] = [];
  const sheetBlocks = wbXml.match(/<(?:\w+:)?sheet\b[^>]*\/?>/gi) ?? [];
  for (const block of sheetBlocks) {
    const nameM = block.match(/\bname="([^"]*)"/i);
    const ridM = block.match(/\br:id="([^"]*)"/i);
    if (!nameM || !ridM) continue;
    const name = unescapeSheetName(nameM[1]);
    const rid = ridM[1];
    const relRe = new RegExp(
      `<Relationship[^>]*Id="${rid.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*Target="([^"]*)"`,
    );
    const rm = wbRels.match(relRe);
    if (rm) {
      let target = rm[1].replace(/^\//, "");
      if (!target.startsWith("xl/")) target = "xl/" + target;
      nameToPath.set(name, target);
      orderedPaths.push(target);
    }
  }
  return { nameToPath, orderedPaths };
}

function resolveSheetPath(
  sheetName: string,
  sheetIndex: number | undefined,
  nameToPath: Map<string, string>,
  orderedPaths: string[],
): string | undefined {
  const tryName = (n: string): string | undefined => nameToPath.get(n);
  const direct = tryName(sheetName);
  if (direct) return direct;
  const trimmed = sheetName.trim();
  const t2 = tryName(trimmed);
  if (t2) return t2;
  const norm = (s: string) => s.normalize("NFKC").trim();
  const ns = norm(sheetName);
  for (const [n, p] of nameToPath) {
    if (norm(n) === ns) return p;
  }
  for (const [n, p] of nameToPath) {
    if (n.toLowerCase() === sheetName.toLowerCase()) return p;
  }
  if (
    sheetIndex !== undefined &&
    Number.isFinite(sheetIndex) &&
    sheetIndex >= 0 &&
    sheetIndex < orderedPaths.length
  ) {
    return orderedPaths[Math.floor(sheetIndex)];
  }
  return undefined;
}

/**
 * 既存 xlsx バッファにコメントのみを書き込む（他パーツは触らない）。
 */
export async function injectCommentsIntoXlsxBuffer(
  buffer: Buffer,
  updates: ZipCommentUpdate[],
): Promise<Buffer> {
  if (updates.length === 0) return buffer;
  if (updates.length > MAX_ZIP_COMMENT_CELLS) {
    throw new Error(
      `コメント付与は最大 ${MAX_ZIP_COMMENT_CELLS} セルまでです（${updates.length} 件指定）`,
    );
  }

  const zip = await JSZip.loadAsync(buffer);
  const wbXml = await zip.file("xl/workbook.xml")?.async("string");
  const wbRels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!wbXml || !wbRels) return buffer;

  const { nameToPath: sheetNameToPath, orderedPaths } = buildWorkbookSheetIndex(
    wbXml,
    wbRels,
  );

  const bySheetPath = new Map<string, ZipCommentUpdate[]>();
  for (const u of updates) {
    const p = resolveSheetPath(
      u.sheetName,
      u.sheetIndex,
      sheetNameToPath,
      orderedPaths,
    );
    if (!p) continue;
    const normAddr = normalizeRef(u.address);
    if (!normAddr) continue;
    if (!bySheetPath.has(p)) bySheetPath.set(p, []);
    bySheetPath.get(p)!.push({
      sheetName: u.sheetName,
      address: normAddr,
      text: normalizeCommentRawForWrite(u.text),
    });
  }

  for (const [sheetPath, list] of bySheetPath) {
    await mergeCommentsForOneSheet(zip, sheetPath, list);
  }

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  return Buffer.from(out);
}

/**
 * 1) comments.xml を書き込む
 * 2) vmlDrawing（ノート表示用）を書き込む
 * 3) シート rels に comments / vml 関係を追加（未存在時のみ）
 * 4) [Content_Types] を必要に応じて追加
 * 5) worksheet に legacyDrawing を追加（未存在時のみ）
 *
 * SheetJS の write は使わない（ZIP 差し替えのみ）。
 */
async function mergeCommentsForOneSheet(
  zip: JSZip,
  sheetPath: string,
  list: ZipCommentUpdate[],
): Promise<void> {
  const relsPath = sheetPath.replace(
    /\/([^/]+)\.xml$/,
    "/_rels/$1.xml.rels",
  );

  let relsXml = (await zip.file(relsPath)?.async("string")) ?? "";
  let commentsPath: string | null = null;

  const cmTgt = getTargetForRelType(relsXml, REL_COMMENTS);
  if (cmTgt) {
    commentsPath = resolveRelative(sheetPath, cmTgt);
  }

  const refToText = new Map<string, string>();
  if (commentsPath && zip.file(commentsPath)) {
    const existing = await zip.file(commentsPath)!.async("string");
    const parsed = parseCommentsXmlToMap(existing);
    for (const [k, v] of parsed) refToText.set(k, v);
  }

  for (const u of list) {
    refToText.set(u.address.toUpperCase(), u.text);
  }

  const sheetNum = sheetPathToSheetNum(sheetPath);

  // --- 1) comments.xml ---
  const outCommentsPath = commentsPath ?? nextCommentsFileName(zip);
  const commentsXml = buildCommentsXml(refToText);
  zip.file(outCommentsPath, commentsXml);

  if (!commentsPath) {
    const relTarget = relativePathFromSheetToComments(sheetPath, outCommentsPath);
    const newRid = nextFreeRid(relsXml);
    relsXml = appendRelationship(relsXml, newRid, REL_COMMENTS, relTarget);
    zip.file(relsPath, relsXml);
    await ensureContentTypeAsync(zip, outCommentsPath, CT_COMMENTS);
  }

  // rels を再読込（上書き後）
  relsXml = (await zip.file(relsPath)?.async("string")) ?? "";

  // --- 2) vmlDrawing（Excel がノートを表示するために必要） ---
  const refsSorted = [...refToText.keys()].sort();
  let vmlPath: string;
  const existingVmlTarget = getTargetForRelType(relsXml, REL_VML);
  if (existingVmlTarget) {
    vmlPath = resolveRelative(sheetPath, existingVmlTarget);
  } else {
    vmlPath = `xl/drawings/vmlDrawing${sheetNum}.vml`;
  }
  const vmlXml = buildVmlDrawingXml(sheetNum, refsSorted);
  const vmlExisted = !!zip.file(vmlPath);
  zip.file(vmlPath, vmlXml);
  if (!vmlExisted) {
    await ensureContentTypeAsync(zip, vmlPath, CT_VML);
  }

  relsXml = (await zip.file(relsPath)?.async("string")) ?? "";
  if (!hasRelType(relsXml, REL_VML)) {
    const vmlRelTarget = relativePathFromSheetToComments(sheetPath, vmlPath);
    const rid = nextFreeRid(relsXml);
    relsXml = appendRelationship(relsXml, rid, REL_VML, vmlRelTarget);
    zip.file(relsPath, relsXml);
  }

  relsXml = (await zip.file(relsPath)?.async("string")) ?? "";
  const vmlRid = getRidForRelType(relsXml, REL_VML);

  // --- 5) legacyDrawing（取得できない場合は vml のみ — comments は上記で反映済み） ---
  if (vmlRid != null) {
    let sheetMain = (await zip.file(sheetPath)?.async("string")) ?? "";
    sheetMain = insertLegacyDrawingIfMissing(sheetMain, vmlRid);
    zip.file(sheetPath, sheetMain);
  }
}
