import { NextRequest } from "next/server";
import { buildCellCommentCatalog } from "@/lib/cell-comment-catalog";
import { parseExcel } from "@/lib/excel-parser";
import { convertExcelToPdf } from "@/lib/excel-to-pdf";
import { correctDimensionsFromPrintMeta } from "@/lib/dimension-corrector";
import { createLogger } from "@/lib/logger";

const log = createLogger("parse-excel");
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!file.name.endsWith(".xlsx") && !file.name.endsWith(".xls")) {
      return Response.json(
        { error: "Excel ファイル (.xlsx, .xls) のみ対応しています" },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "ファイルサイズは 10MB 以下にしてください" },
        { status: 413 }
      );
    }

    const buffer = await file.arrayBuffer();
    log.info("File received", { fileName: file.name, sizeBytes: file.size });

    // Excel バイナリを Base64 保持 (definitionFile 用)。ブックはそのまま保持。
    const excelBase64 = Buffer.from(buffer).toString("base64");

    // Excel 解析 + PDF 変換を並列実行
    const [formStructure, conversionResult] = await Promise.all([
      Promise.resolve(parseExcel(buffer, file.name)),
      convertExcelToPdf(Buffer.from(buffer), file.name),
    ]);

    log.info("Excel parsed", {
      fileName: file.name,
      sheetsCount: formStructure.sheets.length,
      sheetNames: formStructure.sheets.map((s) => s.name),
    });

    if (conversionResult) {
      // PDF を Base64 化して FormStructure に含める
      formStructure.pdfBase64 = conversionResult.pdfBuffer.toString("base64");
      log.info("PDF generated", { pdfSizeBytes: conversionResult.pdfBuffer.length });

      // 印刷メタ情報をシートに紐づけ + 列幅/行高さを補正
      if (conversionResult.printMeta) {
        for (const meta of conversionResult.printMeta) {
          const sheet = formStructure.sheets.find((s) => s.name === meta.name);
          if (sheet) {
            // 補正前の寸法を記録
            const beforeW = sheet.totalWidth;
            const beforeH = sheet.totalHeight;
            sheet.printMeta = meta;
            correctDimensionsFromPrintMeta(sheet, meta);

            log.info("SheetJS vs eprint comparison", {
              sheetName: sheet.name,
              sheetjsTotalWidth: +beforeW.toFixed(1),
              eprintTotalWidth: +sheet.totalWidth.toFixed(1),
              widthDelta: +(sheet.totalWidth - beforeW).toFixed(1),
              sheetjsTotalHeight: +beforeH.toFixed(1),
              eprintTotalHeight: +sheet.totalHeight.toFixed(1),
              heightDelta: +(sheet.totalHeight - beforeH).toFixed(1),
            });
          }
        }
        log.info("Print meta attached", { sheetsCount: conversionResult.printMeta.length });
      }
    } else {
      log.warn("PDF conversion skipped — no conversion method available");
    }

    // Excel バイナリを FormStructure に格納
    formStructure.excelBase64 = excelBase64;
    formStructure.embeddedExcelFileName = file.name;

    // iReporter セルコメントの連携用カタログ（シート名・アドレス・パース結果）
    formStructure.cellCommentCatalog = buildCellCommentCatalog(formStructure);

    return Response.json(formStructure);
  } catch (e) {
    log.error("Parse failed", {
      error: e instanceof Error ? e.message : String(e),
    });
    const message = e instanceof Error ? e.message : "Excel 解析中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
