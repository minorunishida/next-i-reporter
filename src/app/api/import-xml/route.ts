import { NextRequest } from "next/server";
import { parseConmasXml } from "@/lib/xml-parser";

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB (XML + Base64 PDF)

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return Response.json({ error: "ファイルが選択されていません" }, { status: 400 });
    }

    if (!file.name.endsWith(".xml")) {
      return Response.json(
        { error: "ConMas XML ファイル (.xml) のみ対応しています" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return Response.json(
        { error: "ファイルサイズは 50MB 以下にしてください" },
        { status: 413 },
      );
    }

    const text = await file.text();
    const result = parseConmasXml(text, file.name);

    return Response.json(result);
  } catch (err) {
    console.error("[import-xml] Error:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "XML のパースに失敗しました" },
      { status: 500 },
    );
  }
}
