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
    const [formStructure, pdfBuffer] = await Promise.all([
      Promise.resolve(parseExcel(buffer, file.name)),
      convertExcelToPdf(Buffer.from(buffer), file.name),
    ]);

    // PDF が取得できたら Base64 化して FormStructure に含める
    if (pdfBuffer) {
      formStructure.pdfBase64 = pdfBuffer.toString("base64");
      console.log(`[parse-excel] PDF generated: ${pdfBuffer.length} bytes`);
    } else {
      console.log("[parse-excel] PDF conversion skipped (Azure AD 未設定 or エラー)");
    }

    return Response.json(formStructure);
  } catch (e) {
    console.error("[parse-excel]", e);
    const message = e instanceof Error ? e.message : "Excel 解析中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
