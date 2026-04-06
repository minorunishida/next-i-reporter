/**
 * ExcelOutputSetting シートを xlsx に ZIP レベルで追加する。
 * 既存の設定シート名（excel-cleaner と同定義）は除去してから上書き注入する。
 */
import JSZip from "jszip";
import { removeExcelOutputSetting } from "./excel-cleaner";

const REL_WORKSHEET =
  "http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet";
const CT_WORKSHEET =
  "application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml";

function nextFreeRid(relsXml: string): number {
  let max = 0;
  const re = /Id="rId(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(relsXml)) !== null) {
    max = Math.max(max, parseInt(m[1], 10));
  }
  return max + 1;
}

function maxWorksheetFileNum(zip: JSZip): number {
  let max = 0;
  for (const p of Object.keys(zip.files)) {
    const m = p.match(/^xl\/worksheets\/sheet(\d+)\.xml$/i);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

function maxSheetId(wbXml: string): number {
  let max = 0;
  const re = /sheetId="(\d+)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(wbXml)) !== null) {
    max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

/** CDATA 内に `]]>` が含まれる場合の分割（Excel OOXML でも安全） */
function escapeCdataBody(s: string): string {
  return s.replace(/]]>/g, "]]]]><![CDATA[>");
}

/**
 * マージ済み等の xlsx に ExcelOutputSetting シートを追加する。
 * A1 には `settingXml` をインライン文字列（CDATA）で格納する。
 */
export async function injectExcelOutputSettingSheet(
  xlsxBuffer: Buffer,
  settingXml: string,
): Promise<Buffer> {
  const stripped = Buffer.from(await removeExcelOutputSetting(xlsxBuffer), "base64");
  const zip = await JSZip.loadAsync(stripped);

  const wbXml = await zip.file("xl/workbook.xml")?.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!wbXml || !relsXml) {
    return stripped;
  }

  const wsNum = maxWorksheetFileNum(zip) + 1;
  const sheetPath = `xl/worksheets/sheet${wsNum}.xml`;
  const newRid = nextFreeRid(relsXml);
  const newSheetId = maxSheetId(wbXml) + 1;

  const rel = `<Relationship Id="rId${newRid}" Type="${REL_WORKSHEET}" Target="worksheets/sheet${wsNum}.xml"/>`;
  const updatedRels = relsXml.replace(
    /<\/Relationships>\s*$/i,
    rel + "</Relationships>",
  );
  zip.file("xl/_rels/workbook.xml.rels", updatedRels);

  const sheetEntry = `<sheet name="ExcelOutputSetting" sheetId="${newSheetId}" r:id="rId${newRid}"/>`;
  const updatedWb = wbXml.replace(/<\/sheets>/i, `${sheetEntry}</sheets>`);
  zip.file("xl/workbook.xml", updatedWb);

  const body = escapeCdataBody(settingXml);
  const worksheetXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
    'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheetData>' +
    '<row r="1" spans="1:1">' +
    '<c r="A1" t="inlineStr">' +
    "<is>" +
    `<t xml:space="preserve"><![CDATA[${body}]]></t>` +
    "</is>" +
    "</c>" +
    "</row>" +
    "</sheetData>" +
    "</worksheet>";
  zip.file(sheetPath, worksheetXml);

  const ctPath = "[Content_Types].xml";
  const ct = (await zip.file(ctPath)?.async("string")) ?? "";
  const partName = "/" + sheetPath.replace(/^\/+/, "");
  if (ct && !ct.includes(`PartName="${partName}"`)) {
    const insert = `<Override PartName="${partName}" ContentType="${CT_WORKSHEET}"/>`;
    const updatedCt = ct.replace(/<Types[^>]*>/, (h) => h + insert);
    zip.file(ctPath, updatedCt);
  }

  const out = await zip.generateAsync({
    type: "nodebuffer",
    compression: "DEFLATE",
    compressionOptions: { level: 9 },
  });
  return Buffer.from(out);
}
