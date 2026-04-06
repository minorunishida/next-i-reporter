import type { AnalysisResult, ClusterDefinition, SheetStructure } from "./form-structure";
import { buildMergedCommentCatalog } from "./cell-comment-build";
import { TYPE_NUM_TO_STRING } from "./conmas-cluster-types";
import { mergeCellCommentsIntoExcelBase64 } from "./excel-comment-writer";
import { mapClusterRegionToPdf } from "./print-coord-mapper";

/**
 * シート数に応じた白いPDFを動的生成 (Base64)。
 * Designer は sheetCount とPDFページ数が一致することを期待する。
 */
export function generateBlankPdfBase64(pageCount: number): string {
  const W = "595.28";
  const H = "841.89";
  const stream = `1 1 1 rg\n0 0 ${W} ${H} re f\n`;

  const parts: string[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const write = (s: string) => { parts.push(s); pos += s.length; };

  write("%PDF-1.4\n");

  // obj 1: Catalog
  offsets.push(pos);
  write("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  // obj 2: Pages
  const kids = Array.from({ length: pageCount }, (_, i) => `${3 + i * 2} 0 R`).join(" ");
  offsets.push(pos);
  write(`2 0 obj\n<< /Type /Pages /Kids [${kids}] /Count ${pageCount} >>\nendobj\n`);

  // For each page: Page obj + Content stream obj
  for (let i = 0; i < pageCount; i++) {
    const pageObjNum = 3 + i * 2;
    const streamObjNum = 4 + i * 2;

    // Page object
    offsets.push(pos);
    write(`${pageObjNum} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Contents ${streamObjNum} 0 R /Resources << >> >>\nendobj\n`);

    // Content stream
    offsets.push(pos);
    write(`${streamObjNum} 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}endstream\nendobj\n`);
  }

  const totalObjs = 2 + pageCount * 2; // catalog + pages + (page+stream)*N
  const xrefOffset = pos;

  write(`xref\n0 ${totalObjs + 1}\n`);
  write("0000000000 65535 f \n");
  for (const off of offsets) {
    write(`${String(off).padStart(10, "0")} 00000 n \n`);
  }
  write(`trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`);

  // Base64 encode
  const binary = parts.join("");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(binary, "binary").toString("base64");
  }
  return btoa(binary);
}

/**
 * AnalysisResult から ConMas 互換の XML 文字列を生成する
 *
 * ゴールデンデータ ([V3.1_Sample]全インプットサンプル.xml) の要素順序・構造に完全準拠。
 * Designer の int.Parse / float.Parse / null アクセスに対して安全な値を設定。
 */
export async function generateConmasXml(result: AnalysisResult): Promise<string> {
  const { formStructure, clusters } = result;
  const commentCatalog = buildMergedCommentCatalog(formStructure, clusters);
  const fileName = formStructure.fileName.replace(/\.[^.]+$/, "");
  const now = new Date();
  const timestamp = `${now.getFullYear()}/${String(now.getMonth() + 1).padStart(2, "0")}/${String(now.getDate()).padStart(2, "0")} ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;

  const L: string[] = [];
  const p = (line: string) => L.push(line);

  p('<?xml version="1.0" encoding="utf-8"?>');
  p("<conmas>");

  // === header (ゴールデン準拠) ===
  p("  <header>");
  p("    <version></version>");
  p("    <command></command>");
  p("    <resultCode></resultCode>");
  p("    <message></message>");
  p("    <requestUser></requestUser>");
  p("    <createTime></createTime>");
  p("  </header>");

  // === top (ゴールデン準拠 — 全要素を順序通りに出力) ===
  p("  <top>");
  p("    <defTopId>0</defTopId>");
  p(`    <defTopName>${esc(fileName)}</defTopName>`);
  p("    <repTopId></repTopId>");
  p("    <repTopName></repTopName>");
  p("    <updateDefinitionApp>NextiReporter</updateDefinitionApp>");
  p("    <designerVersion>8.2.26030</designerVersion>");
  p("    <designerDisplayVersion>8.2.26030</designerDisplayVersion>");
  p("    <constrainedFunction></constrainedFunction>");
  p("    <constrainedFunctionOther></constrainedFunctionOther>");
  p("    <isSortReport>0</isSortReport>");
  p("    <notDisplayRenumberedIndex>0</notDisplayRenumberedIndex>");
  p("    <reportType>1</reportType>");
  p(`    <sheetCount>${formStructure.sheets.length}</sheetCount>`);
  p("    <autoGen>0</autoGen>");
  p("    <tables></tables>");
  p("    <mobileSave>0</mobileSave>");
  p("    <mobileReportSave>1</mobileReportSave>");
  p("    <useBiometrics>0</useBiometrics>");
  p("    <useIdentification>0</useIdentification>");
  p("    <safeKeeping>0</safeKeeping>");
  p("    <autoSelectGen>0</autoSelectGen>");
  p("    <nameEditable>1</nameEditable>");
  p("    <nameRegenerate>0</nameRegenerate>");
  p("    <lifeTime>0</lifeTime>");
  p("    <creatable></creatable>");
  p("    <finishOutput>1</finishOutput>");
  p("    <finishOutputFiles>");
  p("      <csv></csv>");
  p("      <csvImageAudio></csvImageAudio>");
  p("      <csvZip></csvZip>");
  p("      <dataOutputCsv></dataOutputCsv>");
  p("      <dataOutputCsvImageAudio></dataOutputCsvImageAudio>");
  p("      <xml></xml>");
  p("      <pdf></pdf>");
  p("      <pdfLayer></pdfLayer>");
  p("      <docuworks></docuworks>");
  p("      <excel></excel>");
  p("    </finishOutputFiles>");
  p("    <editOutput>0</editOutput>");
  p("    <editOutputFiles>");
  p("      <csv></csv>");
  p("      <csvImageAudio></csvImageAudio>");
  p("      <csvZip></csvZip>");
  p("      <dataOutputCsv></dataOutputCsv>");
  p("      <dataOutputCsvImageAudio></dataOutputCsvImageAudio>");
  p("      <xml></xml>");
  p("      <pdf></pdf>");
  p("      <pdfLayer></pdfLayer>");
  p("      <docuworks></docuworks>");
  p("      <excel></excel>");
  p("    </editOutputFiles>");
  p("    <excelOutput>1</excelOutput>");
  p("    <readOnly>0</readOnly>");
  p("    <lockMode>0</lockMode>");
  p("    <locked>0</locked>");
  p("    <editStatus>0</editStatus>");
  p("    <publicStatus>0</publicStatus>");
  p("    <picOriginalResolution>0</picOriginalResolution>");
  p("    <imageSize></imageSize>");
  p("    <isOriginalWhole>1</isOriginalWhole>");
  p("    <wholeImageSize></wholeImageSize>");
  p("    <saveIndividuallyImage>1</saveIndividuallyImage>");
  // 定義ファイル: Excel バイナリを Base64 で埋め込む (仕様: spec-excel-binary-in-conmas-xml.md)
  // cell-comment-spec: 16行LF・クラスタからの欠落セルへのコメント合成は buildMergedCommentCatalog
  const excelBase64 = await mergeCellCommentsIntoExcelBase64(
    formStructure.excelBase64 ?? "",
    formStructure.fileName,
    commentCatalog,
  );
  const excelExt = excelBase64
    ? (formStructure.fileName.split(".").pop()?.toLowerCase() ?? "xlsx")
    : "";
  const excelName = excelBase64 ? formStructure.fileName : "";
  p("    <definitionFile>");
  p(`      <type>${excelExt}</type>`);
  p(`      <name>${esc(excelName)}</name>`);
  p(`      <value>${excelBase64}</value>`);
  p("    </definitionFile>");
  // 背景PDF: Graph API で変換した実PDFがあればそれを使用、なければブランクPDF
  const pdfBase64 = formStructure.pdfBase64 || generateBlankPdfBase64(formStructure.sheets.length);
  p(`    <backgroundImage>${pdfBase64}</backgroundImage>`);
  p("    <thumbnail></thumbnail>");
  p("    <editMail></editMail>");
  p("    <completeMail></completeMail>");
  // remarks (ゴールデンでは「帳票備考」)
  for (let i = 1; i <= 10; i++) {
    p(`    <remarksName${i}>帳票備考${toFW(i)}</remarksName${i}>`);
  }
  for (let i = 1; i <= 10; i++) {
    p(`    <remarksValue${i}></remarksValue${i}>`);
  }
  p("    <remarksEditable>0</remarksEditable>");
  p("    <remarksClearCooperation>0</remarksClearCooperation>");
  p(`    <registTime>${timestamp}</registTime>`);
  p("    <registUser></registUser>");
  p("    <registUserName></registUserName>");
  p(`    <updateTime>${timestamp}</updateTime>`);
  p("    <updateUser></updateUser>");
  p("    <updateUserName></updateUserName>");
  p("    <canSendMailAsAttachment>0</canSendMailAsAttachment>");
  p("    <canOpenAsPdf>0</canOpenAsPdf>");
  p("    <saveToServerReopen>0</saveToServerReopen>");
  p("    <saveLocalCameraImage>0</saveLocalCameraImage>");
  p("    <cooperationTable>0</cooperationTable>");
  p("    <requiredCheckMode>0</requiredCheckMode>");
  p("    <requiredSaveMode>0</requiredSaveMode>");
  p("    <requiredCheckPrint>0</requiredCheckPrint>");
  p("    <minimumEditSize></minimumEditSize>");
  p("    <finishCreateSortedReport>0</finishCreateSortedReport>");
  p("    <isReportCopy>1</isReportCopy>");
  p("    <reportCopyType>0</reportCopyType>");
  p("    <mobileEditType>0</mobileEditType>");
  p("    <useNetworkAutoInputStart>0</useNetworkAutoInputStart>");
  p("    <existReportMaster></existReportMaster>");
  p("    <useApplicantLock>0</useApplicantLock>");
  p("    <useInputHistory>0</useInputHistory>");
  p("    <useInitInputJudge>0</useInitInputJudge>");
  p("    <useInitInputJudgeParameters></useInitInputJudgeParameters>");
  p("    <useChangeReason>0</useChangeReason>");
  p("    <serverVersion></serverVersion>");
  p("    <useExclusiveMode>0</useExclusiveMode>");
  p("    <useExclusiveModeManager>0</useExclusiveModeManager>");
  p('    <retinaMode new="0">0</retinaMode>');
  p('    <calculateMode new="0">0</calculateMode>');
  p("    <reEditDisable>0</reEditDisable>");
  p("    <useStartTime></useStartTime>");
  p("    <useEndTime></useEndTime>");
  p('    <systemKey1 xml:space="preserve"></systemKey1>');
  p('    <systemKey2 xml:space="preserve"></systemKey2>');
  p('    <systemKey3 xml:space="preserve"></systemKey3>');
  p('    <systemKey4 xml:space="preserve"></systemKey4>');
  p('    <systemKey5 xml:space="preserve"></systemKey5>');
  p("    <noNeedToFillOut>0</noNeedToFillOut>");
  p("    <noNeedToFillOutMode>0</noNeedToFillOutMode>");
  p("    <noNeedToFillOutCluster></noNeedToFillOutCluster>");
  p("    <noNeedToFillOutType>0</noNeedToFillOutType>");
  p("    <noNeedToFillOutString></noNeedToFillOutString>");
  p("    <journalizingDefTopId>0</journalizingDefTopId>");
  p("    <pinCooperationSelectCluster></pinCooperationSelectCluster>");
  p("    <trailOutput>0</trailOutput>");
  p("    <indexType>0</indexType>");
  p("    <voiceInputEndTime></voiceInputEndTime>");
  p("    <networkAnswerbackMode>0</networkAnswerbackMode>");
  p("    <audioRecordingFileFormat>0</audioRecordingFileFormat>");
  p("    <fontAutoResizingMode>0</fontAutoResizingMode>");
  p("    <useReferencedCluster>0</useReferencedCluster>");
  p("    <displaySaveMenu>");
  p("      <localSave>1</localSave>");
  p("      <continuationSave>1</continuationSave>");
  p("      <serverSave>1</serverSave>");
  p("      <finishSave>1</finishSave>");
  p("      <continuationServerSave>1</continuationServerSave>");
  p("      <continuationFinishSave>1</continuationFinishSave>");
  p("      <mailImage>1</mailImage>");
  p("      <mailPdf>1</mailPdf>");
  p("      <openApp>1</openApp>");
  p("      <print>1</print>");
  p("      <printReceipt>1</printReceipt>");
  p("      <savePdf>1</savePdf>");
  p("      <saveExcel>1</saveExcel>");
  p("    </displaySaveMenu>");
  p("    <dividedDeviceCode>");
  p("      <delimiterType></delimiterType>");
  p("      <encodeType></encodeType>");
  p("    </dividedDeviceCode>");
  p('    <nameParts xml:space="preserve">');
  p("      <part>");
  p("        <partId>1</partId>");
  p("        <type>dateTime</type>");
  p("        <value>yyyyMMddHHmm</value>");
  p("      </part>");
  p("      <part>");
  p("        <partId>2</partId>");
  p("        <type>value</type>");
  p("        <value>_</value>");
  p("      </part>");
  p("      <part>");
  p("        <partId>3</partId>");
  p("        <type>report</type>");
  p("        <value>defTopName</value>");
  p("      </part>");
  p("    </nameParts>");
  p("    <useAutoNumbering>0</useAutoNumbering>");
  p('    <autoNumbering xml:space="preserve">');
  p("      <startValue></startValue>");
  p("      <increment></increment>");
  p("      <digit></digit>");
  p("      <zeroPadding></zeroPadding>");
  p("      <numberingTiming></numberingTiming>");
  p("      <numberingForReeditFromComplete></numberingForReeditFromComplete>");
  p("      <numberingCyclicEnabled></numberingCyclicEnabled>");
  p("      <useReset></useReset>");
  p("      <reset>");
  p("        <termType></termType>");
  p("        <startDate></startDate>");
  p("        <executeTime></executeTime>");
  p("        <interval></interval>");
  p("        <week></week>");
  p("        <month></month>");
  p("        <day></day>");
  p("      </reset>");
  p("      <useSaveCount></useSaveCount>");
  p("      <saveCount>");
  p("        <digit></digit>");
  p("        <zeroPadding></zeroPadding>");
  p("      </saveCount>");
  p("    </autoNumbering>");
  p("    <workReportType>0</workReportType>");
  p("    <dailyReportCluster></dailyReportCluster>");
  p("    <workReportTableNo></workReportTableNo>");
  p("    <labels></labels>");
  p("    <networks></networks>");
  p("    <matrixScanSetting>");
  p("      <useScanditCluster></useScanditCluster>");
  p("      <scanditClusters></scanditClusters>");
  p("    </matrixScanSetting>");
  p("    <edgeOcrSetting>");
  p("      <edgeOcrClusters></edgeOcrClusters>");
  p("    </edgeOcrSetting>");
  p("    <pageClusters></pageClusters>");
  // === sheets + clusters は top > sheets の中に入る (variables ではない) ===
  p("    <sheets>");
  for (const sheet of formStructure.sheets) {
    const sc = clusters.filter((c) => c.sheetNo === sheet.index && c.type !== 20);
    L.push(...genSheet(sheet, sc));
  }
  p("    </sheets>");
  p("  </top>");
  p("</conmas>");

  return L.join("\n");
}

function genSheet(sheet: SheetStructure, clusters: ClusterDefinition[]): string[] {
  const L: string[] = [];
  const p = (line: string) => L.push(line);

  p("      <sheet>");
  p("        <defSheetId></defSheetId>");
  p(`        <defSheetName>${esc(sheet.name)}</defSheetName>`);
  p("        <repSheetId></repSheetId>");
  p("        <repSheetName></repSheetName>");
  p(`        <sheetNo>${sheet.index + 1}</sheetNo>`);
  p("        <autoSelectGen>0</autoSelectGen>");
  p("        <backgroundImage></backgroundImage>");
  p("        <inputImage></inputImage>");
  p("        <importImage>0</importImage>");
  p("        <thumbnail></thumbnail>");
  p(`        <width>${sheet.totalWidth.toFixed(2)}</width>`);
  p(`        <height>${sheet.totalHeight.toFixed(2)}</height>`);
  p("        <copyDisable>0</copyDisable>");
  p("        <sheetCopyCheck>0</sheetCopyCheck>");
  p("        <focusClusterIndex></focusClusterIndex>");
  for (let i = 1; i <= 10; i++) {
    p(`        <remarksName${i}>シート 備考${toFW(i)}</remarksName${i}>`);
  }
  for (let i = 1; i <= 10; i++) {
    p(`        <remarksValue${i} xml:space="preserve"></remarksValue${i}>`);
  }
  p("        <references></references>");
  p("        <clusters>");
  clusters.forEach((c, idx) => L.push(...genCluster(c, idx, sheet)));
  p("        </clusters>");
  p("      </sheet>");

  return L;
}

function genCluster(c: ClusterDefinition, id: number, sheet: SheetStructure): string[] {
  let top: number, bottom: number, left: number, right: number;

  if (sheet.printMeta) {
    const mapped = mapClusterRegionToPdf(c.region, sheet, sheet.printMeta);
    if (mapped) {
      top = mapped.top;
      bottom = mapped.bottom;
      left = mapped.left;
      right = mapped.right;
    } else {
      // クラスターが印刷範囲外 — レガシー正規化
      const w = sheet.totalWidth;
      const h = sheet.totalHeight;
      top = h > 0 ? c.region.top / h : 0;
      bottom = h > 0 ? c.region.bottom / h : 0;
      left = w > 0 ? c.region.left / w : 0;
      right = w > 0 ? c.region.right / w : 0;
    }
  } else {
    // printMeta なし — レガシー正規化
    const w = sheet.totalWidth;
    const h = sheet.totalHeight;
    top = h > 0 ? c.region.top / h : 0;
    bottom = h > 0 ? c.region.bottom / h : 0;
    left = w > 0 ? c.region.left / w : 0;
    right = w > 0 ? c.region.right / w : 0;
  }

  const typeStr = TYPE_NUM_TO_STRING[c.type] ?? c.typeName ?? "FixedText";

  const L: string[] = [];
  const p = (line: string) => L.push(line);

  p("        <cluster>");
  p(`          <sheetNo>${c.sheetNo + 1}</sheetNo>`);
  p(`          <clusterId>${id}</clusterId>`);
  p("          <isHidden>0</isHidden>");
  p("          <isHiddenDesigner>0</isHiddenDesigner>");
  p("          <mobileDisplay>0</mobileDisplay>");
  p("          <mobileListDisplayNo>0</mobileListDisplayNo>");
  p("          <pinNo>0</pinNo>");
  p("          <pinValue>0</pinValue>");
  p(`          <name>${esc(c.name)}</name>`);
  p(`          <type>${typeStr}</type>`);
  p(`          <top>${top.toFixed(6)}</top>`);
  p(`          <bottom>${bottom.toFixed(6)}</bottom>`);
  p(`          <right>${right.toFixed(6)}</right>`);
  p(`          <left>${left.toFixed(6)}</left>`);
  p(`          <value>${esc(c.value ?? "")}</value>`);
  p("          <external>0</external>");
  p(`          <displayValue>${esc(c.displayValue ?? "")}</displayValue>`);
  p("          <cooperationCluster></cooperationCluster>");
  p(`          <readOnly>${c.readOnly ? 1 : 0}</readOnly>`);
  p(`          <function>${esc(c.formula ?? "")}</function>`);
  p("          <actionPost></actionPost>");
  p("          <clearCluster></clearCluster>");
  p("          <originalFunction></originalFunction>");
  p("          <excelOutputValue></excelOutputValue>");
  p(`          <inputParameters>${esc(c.inputParameters)}</inputParameters>`);
  p("          <carbonCopy></carbonCopy>");
  p("          <userCustomMaster>");
  p("            <masterTableId></masterTableId>");
  p("            <masterKey></masterKey>");
  p("          </userCustomMaster>");
  p("          <reportCopy>");
  p("            <clear></clear>");
  p("            <displayDefaultValue></displayDefaultValue>");
  p("          </reportCopy>");
  p("          <dividedCopy>");
  p("            <delimiterType></delimiterType>");
  p("            <encodeType></encodeType>");
  p("          </dividedCopy>");
  p("          <buttonImage></buttonImage>");
  p("          <buttonImageName></buttonImageName>");
  for (let i = 1; i <= 10; i++) {
    p(`          <remarksValue${i}></remarksValue${i}>`);
  }
  // cellAddress: Designer COM Range[addr] で 0x800A03EC エラーが発生するため空を維持。
  // toAbsoluteCellAddress() でフォーマットは正しく $B$4 に変換できているが、
  // AI が返すアドレスと Excel 実セル構造の不一致が原因の可能性あり。
  // Designer 出力 XML との比較で正しいアドレス条件を特定する必要がある。
  p("          <cellAddress></cellAddress>");
  p("          <management>");
  p("            <valueToRemarks></valueToRemarks>");
  p("            <valueToSystemKeys></valueToSystemKeys>");
  p("          </management>");
  p("        </cluster>");

  return L;
}

/**
 * セルアドレスを Designer 準拠の絶対参照形式に変換
 * "B4" → "$B$4"
 *
 * sheet.cells に該当セルが存在し、かつ値・数式・結合・罫線のいずれかを持つ場合のみ
 * アドレスを返す。空セル（装飾のみ）は空を返す (仕様 §3.4: 空ならスキップ → COM エラー回避)
 * 結合セルの場合は origin セルのアドレスのみ返す（範囲形式だと Designer COM エラー）
 */
function toAbsoluteCellAddress(addr: string, sheet: SheetStructure): string {
  if (!addr) return "";

  // $ を除去して正規化 (インポート時に $ 付きで入る場合がある)
  const normalized = addr.replace(/\$/g, "").split(":")[0];

  // sheet.cells から該当セルを検索
  const cell = sheet.cells.find((c) => c.address === normalized);
  if (!cell) return "";

  // 値・数式・結合・データ入力規則のいずれかを持つセルのみ有効
  const hasContent = !!(cell.value || cell.formula || cell.isMerged || cell.dataValidation);
  if (!hasContent) return "";

  // 結合セルの場合は origin のアドレスのみ返す
  if (cell.isMerged && cell.mergeRange) {
    const { startRow, startCol } = cell.mergeRange;
    return toAbsoluteRef(startCol, startRow);
  }

  // 単一セル: "B4" → "$B$4"
  return toAbsoluteRef(normalized);
}

/** "B4" → "$B$4", or (col, row) → "$B$4" */
function toAbsoluteRef(colOrAddr: string | number, row?: number): string {
  if (typeof colOrAddr === "number" && row !== undefined) {
    // 0-based col/row → "$A$1" 形式
    let col = colOrAddr;
    let colStr = "";
    do {
      colStr = String.fromCharCode(65 + (col % 26)) + colStr;
      col = Math.floor(col / 26) - 1;
    } while (col >= 0);
    return `$${colStr}$${row + 1}`;
  }
  // "B4" → "$B$4"
  const addr = String(colOrAddr);
  const m = addr.match(/^([A-Za-z]+)(\d+)$/);
  if (!m) return addr;
  return `$${m[1].toUpperCase()}$${m[2]}`;
}

export function esc(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

export function toFW(n: number): string {
  const fw = "０１２３４５６７８９";
  return String(n).split("").map((d) => fw[parseInt(d)] ?? d).join("");
}
