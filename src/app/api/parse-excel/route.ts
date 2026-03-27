import { NextRequest } from "next/server";
import { parseExcel } from "@/lib/excel-parser";
import { convertExcelToPdf } from "@/lib/excel-to-pdf";

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

    // Excel 解析 + PDF 変換を並列実行
    const [formStructure, conversionResult] = await Promise.all([
      Promise.resolve(parseExcel(buffer, file.name)),
      convertExcelToPdf(Buffer.from(buffer), file.name),
    ]);

    if (conversionResult) {
      // PDF を Base64 化して FormStructure に含める
      formStructure.pdfBase64 = conversionResult.pdfBuffer.toString("base64");
      console.log(`[parse-excel] PDF generated: ${conversionResult.pdfBuffer.length} bytes`);

      // 印刷メタ情報をシートに紐づけ
      if (conversionResult.printMeta) {
        for (const meta of conversionResult.printMeta) {
          const sheet = formStructure.sheets.find((s) => s.name === meta.name);
          if (sheet) {
            sheet.printMeta = meta;
          }
        }
        console.log(`[parse-excel] Print meta attached: ${conversionResult.printMeta.length} sheets`);
      }
    } else {
      console.log("[parse-excel] PDF conversion skipped");
    }

    return Response.json(formStructure);
  } catch (e) {
    console.error("[parse-excel]", e);
    const message = e instanceof Error ? e.message : "Excel 解析中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
