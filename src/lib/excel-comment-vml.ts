/**
 * セルノート表示用 VML（Excel が comments.xml とセットで要求する legacy パーツ）。
 * SheetJS write_comments_vml と同等構造（xlsx.mjs 参照）— ライブラリの write は使わない。
 */
import * as XLSX from "xlsx";

const XLMLNS = {
  v: "urn:schemas-microsoft-com:vml",
  o: "urn:schemas-microsoft-com:office:office",
  x: "urn:schemas-microsoft-com:office:excel",
  mv: "http://macVmlSchemaUri",
} as const;

function wxt(h: Record<string, string | number>): string {
  return Object.keys(h)
    .map((k) => ` ${k}="${h[k]}"`)
    .join("");
}

function writetag(f: string, g: string): string {
  return `<${f}>${g}</${f}>`;
}

/**
 * @param sheetRId シートのシリアル（SheetJS と同様 vml ファイル名の番号に合わせる）
 * @param refs A1 形式のセル参照（大文字小文字可）
 */
export function buildVmlDrawingXml(sheetRId: number, refs: string[]): string {
  let shapeId = 1024;
  while (shapeId < sheetRId * 1000) shapeId += 1000;

  const csize = [21600, 21600];
  const bbox = ["m0,0l0", csize[1], csize[0], csize[1], csize[0], "0xe"].join(",");

  const o: string[] = [];
  o.push(
    `<xml xmlns:v="${XLMLNS.v}" xmlns:o="${XLMLNS.o}" xmlns:x="${XLMLNS.x}" xmlns:mv="${XLMLNS.mv}">`,
  );
  o.push(
    `<o:shapelayout v:ext="edit"><o:idmap v:ext="edit" data="${sheetRId}"/></o:shapelayout>`,
  );
  o.push(
    `<v:shapetype id="_x0000_t202" o:spt="202" coordsize="${csize.join(",")}" path="${bbox}">` +
      `<v:stroke joinstyle="miter"/>` +
      `<v:path o:connecttype="rect" gradientshapeok="t"/>` +
      `</v:shapetype>`,
  );

  /** Excel 既定のノート風（薄黄・枠は標準の黒系） */
  const noteFill = "#FFFFE1";
  const noteStroke = "#000000";

  /** ノート枠の表示サイズ（SheetJS 既定 104×64pt を縦横とも約 5 倍） */
  const LABEL_SCALE = 5;
  const labelWpt = 104 * LABEL_SCALE;
  const labelHpt = 64 * LABEL_SCALE;
  /** Anchor: 元は列幅 2 セル・行 4 セル相当 → 同倍率で終点を伸ばす */
  const anchorColSpan = 2 * LABEL_SCALE;
  const anchorRowSpan = 4 * LABEL_SCALE;

  for (const ref of refs) {
    const c = XLSX.utils.decode_cell(ref);
    const hidden = false;
    const fillxml = `<v:fill color="${noteFill}" type="solid"/>`;
    shapeId += 1;

    o.push(
      `<v:shape${wxt({
        id: `_x0000_s${shapeId}`,
        type: "#_x0000_t202",
        style:
          `position:absolute; margin-left:80pt;margin-top:5pt;width:${labelWpt}pt;height:${labelHpt}pt;z-index:10` +
          (hidden ? ";visibility:hidden" : ""),
        fillcolor: noteFill,
        strokecolor: noteStroke,
      })}>` +
        fillxml +
        `<v:shadow on="t" obscured="t"/>` +
        `<v:path o:connecttype="none"/>` +
        `<v:textbox><div style="text-align:left"></div></v:textbox>` +
        `<x:ClientData ObjectType="Note">` +
        `<x:MoveWithCells/>` +
        `<x:SizeWithCells/>` +
        writetag(
          "x:Anchor",
          [
            c.c + 1,
            0,
            c.r + 1,
            0,
            c.c + 1 + anchorColSpan,
            20,
            c.r + 1 + anchorRowSpan,
            20,
          ].join(","),
        ) +
        writetag("x:AutoFill", "False") +
        writetag("x:Row", String(c.r)) +
        writetag("x:Column", String(c.c)) +
        (hidden ? "" : "<x:Visible/>") +
        `</x:ClientData>` +
        `</v:shape>`,
    );
  }

  o.push("</xml>");
  return o.join("");
}
