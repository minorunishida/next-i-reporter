import { NextRequest } from "next/server";
import { analyzeRegion } from "@/lib/ai-analyzer";
import { loadRuntimeEnv } from "@/lib/ai-config";
import type { SheetStructure } from "@/lib/form-structure";

export async function POST(request: NextRequest) {
  loadRuntimeEnv();

  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY が設定されていません（設定画面で設定してください）" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { sheet, regionCells, contextCells, drawnRegion } = body as {
      sheet: SheetStructure;
      regionCells: Parameters<typeof analyzeRegion>[1];
      contextCells: Parameters<typeof analyzeRegion>[2];
      drawnRegion: Parameters<typeof analyzeRegion>[3];
    };

    if (!sheet || !drawnRegion) {
      return Response.json({ error: "sheet と drawnRegion が必要です" }, { status: 400 });
    }

    const result = await analyzeRegion(
      sheet,
      regionCells ?? [],
      contextCells ?? [],
      drawnRegion
    );
    return Response.json(result);
  } catch (e) {
    console.error("[ai-analyze-region]", e);
    const message = e instanceof Error ? e.message : "AI 解析中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
