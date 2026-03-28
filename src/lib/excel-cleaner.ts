/**
 * ExcelOutputSetting シートを xlsx から除去する
 *
 * 仕様: spec-excel-definition-io-designer.md §2.2
 * Designer は取込時に設定シートを抽出・削除する。
 * definitionFile に埋め込む Excel にも設定シートがあってはならない。
 *
 * xlsx は ZIP (Open XML) なので、JSZip で直接操作し、
 * SheetJS による再書き出し (書式破壊のリスク) を回避する。
 */

import JSZip from "jszip";

const SETTING_SHEET_NAMES = [
  "exceloutputsetting",
  "xcaptriireportersetting",
  "conmasireportersetting",
];

/**
 * Excel バッファから ExcelOutputSetting シートを ZIP レベルで除去し、
 * Base64 文字列を返す。設定シートがなければ元のバイナリをそのまま Base64 化。
 */
export async function removeExcelOutputSetting(buffer: Buffer): Promise<string> {
  const zip = await JSZip.loadAsync(buffer);

  // workbook.xml からシート名→rId マッピングを取得
  const wbXml = await zip.file("xl/workbook.xml")?.async("string");
  if (!wbXml) {
    // xlsx 構造でなければそのまま返す
    return buffer.toString("base64");
  }

  // シート名を解析: <sheet name="ExcelOutputSetting" sheetId="2" r:id="rId2"/>
  const sheetRegex = /<sheet\s+[^>]*name="([^"]*)"[^>]*r:id="([^"]*)"[^>]*\/>/gi;
  let match: RegExpExecArray | null;
  let targetRId: string | null = null;
  let targetName: string | null = null;
  const sheetsToKeep: string[] = [];

  while ((match = sheetRegex.exec(wbXml)) !== null) {
    const name = match[1];
    const rId = match[2];
    if (SETTING_SHEET_NAMES.includes(name.toLowerCase())) {
      targetRId = rId;
      targetName = name;
    } else {
      sheetsToKeep.push(name);
    }
  }

  if (!targetRId || !targetName) {
    // 設定シートなし — そのまま
    return buffer.toString("base64");
  }

  // workbook.xml.rels から rId → ファイルパスを取得
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!relsXml) return buffer.toString("base64");

  const relRegex = new RegExp(
    `<Relationship[^>]*Id="${targetRId}"[^>]*Target="([^"]*)"[^>]*/>`,
  );
  const relMatch = relsXml.match(relRegex);
  const targetPath = relMatch ? `xl/${relMatch[1]}` : null;

  // 1. シートの XML ファイルを削除
  if (targetPath) {
    zip.remove(targetPath);
    // rels ファイルも削除 (例: xl/worksheets/_rels/sheet2.xml.rels)
    const relsPath = targetPath.replace(
      /([^/]+)\.xml$/,
      "_rels/$1.xml.rels",
    );
    if (zip.file(relsPath)) zip.remove(relsPath);
  }

  // 2. workbook.xml から <sheet> エントリを除去
  const updatedWbXml = wbXml.replace(
    new RegExp(`<sheet\\s+[^>]*name="${escapeRegex(targetName)}"[^>]*/>`),
    "",
  );
  zip.file("xl/workbook.xml", updatedWbXml);

  // 3. workbook.xml.rels から Relationship を除去
  const updatedRelsXml = relsXml.replace(
    new RegExp(`<Relationship[^>]*Id="${targetRId}"[^>]*/>`),
    "",
  );
  zip.file("xl/_rels/workbook.xml.rels", updatedRelsXml);

  // 4. [Content_Types].xml からシートの参照を除去
  const ctXml = await zip.file("[Content_Types].xml")?.async("string");
  if (ctXml && targetPath) {
    const partName = "/" + targetPath;
    const updatedCtXml = ctXml.replace(
      new RegExp(`<Override[^>]*PartName="${escapeRegex(partName)}"[^>]*/>`),
      "",
    );
    zip.file("[Content_Types].xml", updatedCtXml);
  }

  // ZIP を再生成して Base64 (DEFLATE 圧縮で元サイズに近づける)
  const cleaned = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  return cleaned.toString("base64");
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
