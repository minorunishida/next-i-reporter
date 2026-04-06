import { NextRequest } from "next/server";
import type { AnalysisResult } from "@/lib/form-structure";
import { buildMergedDefinitionExcelBase64 } from "@/lib/excel-definition-export";
import { isXlsxZipBuffer } from "@/lib/excel-comment-writer";
import { injectExcelOutputSettingSheet } from "@/lib/excel-output-setting";
import { buildExcelOutputSettingXml } from "@/lib/excel-setting-xml-builder";

function excelContentType(fileName: string): string {
  const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "xlsx") {
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  }
  if (ext === "xls") {
    return "application/vnd.ms-excel";
  }
  return "application/octet-stream";
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as AnalysisResult;
    const result: AnalysisResult = {
      formStructure: body.formStructure,
      clusters: body.clusters,
      summary: body.summary,
    };

    if (!result?.clusters?.length || !result?.formStructure?.sheets?.length) {
      return Response.json({ error: "解析結果が不正です" }, { status: 400 });
    }

    const raw = result.formStructure.excelBase64?.trim();
    if (!raw) {
      return Response.json(
        {
          error:
            "Excel 定義がありません。Excel からアップロードした帳票、または定義ファイル付きの XML をご利用ください。",
        },
        { status: 400 },
      );
    }

    let excelBase64 = await buildMergedDefinitionExcelBase64(result);
    if (!excelBase64) {
      return Response.json(
        { error: "Excel 定義の生成に失敗しました" },
        { status: 500 },
      );
    }

    let downloadName =
      result.formStructure.embeddedExcelFileName?.trim() ||
      result.formStructure.fileName ||
      "definition.xlsx";
    const mergedBuf = Buffer.from(excelBase64, "base64");
    if (isXlsxZipBuffer(mergedBuf) && /\.xml$/i.test(downloadName)) {
      downloadName = downloadName.replace(/\.xml$/i, ".xlsx");
    }

    const mergedBuf2 = Buffer.from(excelBase64, "base64");
    if (isXlsxZipBuffer(mergedBuf2)) {
      const settingXml = buildExcelOutputSettingXml(result);
      const withSetting = await injectExcelOutputSettingSheet(mergedBuf2, settingXml);
      excelBase64 = withSetting.toString("base64");
    }

    const buffer = Buffer.from(excelBase64, "base64");
    const encoded = encodeURIComponent(downloadName);

    return new Response(buffer, {
      headers: {
        "Content-Type": excelContentType(downloadName),
        "Content-Disposition": `attachment; filename*=UTF-8''${encoded}`,
      },
    });
  } catch (e) {
    console.error("[generate-excel-definition]", e);
    const message =
      e instanceof Error ? e.message : "Excel 定義の生成中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
