import { NextRequest } from "next/server";
import { analyzeForm } from "@/lib/ai-analyzer";
import type { FormStructure } from "@/lib/form-structure";

export async function POST(request: NextRequest) {
  if (!process.env.OPENAI_API_KEY) {
    return Response.json(
      { error: "OPENAI_API_KEY が設定されていません (.env.local を確認)" },
      { status: 500 }
    );
  }

  try {
    const formStructure: FormStructure = await request.json();

    if (!formStructure?.sheets?.length || !Array.isArray(formStructure.sheets)) {
      return Response.json(
        { error: "解析するシートがありません" },
        { status: 400 }
      );
    }

    const result = await analyzeForm(formStructure);
    return Response.json(result);
  } catch (e) {
    console.error("[ai-analyze]", e);
    const message = e instanceof Error ? e.message : "AI 解析中にエラーが発生しました";
    return Response.json({ error: message }, { status: 500 });
  }
}
