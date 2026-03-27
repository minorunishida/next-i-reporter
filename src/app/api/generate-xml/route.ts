import { NextRequest } from "next/server";
import { generateConmasXml } from "@/lib/xml-generator";
import type { AnalysisResult } from "@/lib/form-structure";

export async function POST(request: NextRequest) {
  try {
    const result: AnalysisResult = await request.json();

    if (!result?.clusters?.length || !result?.formStructure?.sheets?.length) {
      return Response.json(
        { error: "解析結果が不正です" },
        { status: 400 }
      );
    }

    const xml = generateConmasXml(result);
    const fileName = result.formStructure.fileName.replace(/\.[^.]+$/, "") + "_conmas.xml";

    return new Response(xml, {
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(fileName)}"`,
      },
    });
  } catch (e) {
    console.error("[generate-xml]", e);
    const message = e instanceof Error ? e.message : "XML 生成中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
