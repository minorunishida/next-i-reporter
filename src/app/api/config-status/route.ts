import { loadAiConfig } from "@/lib/ai-config";

/**
 * GET /api/config-status
 * フロントエンドが起動時に設定状態を確認するためのエンドポイント。
 * API キーの有無、AI モデル名、eprint パスなどを返す。
 */
export async function GET() {
  // loadAiConfig は内部で loadRuntimeEnv() を呼び、
  // runtime-env.json から API キー等を process.env に注入する
  let aiModel = "";
  let aiBaseURL = "";
  try {
    const config = loadAiConfig();
    aiModel = config.model;
    aiBaseURL = config.baseURL ?? "";
  } catch {
    aiModel = process.env.OPENAI_MODEL ?? "gpt-5.1";
  }

  // loadRuntimeEnv 後に API キーをチェック
  const hasApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const eprintPath = process.env.EPRINT_CLI_PATH ?? "";

  return Response.json({
    hasApiKey,
    aiModel,
    aiBaseURL,
    eprintPath: eprintPath ? true : false,
    ready: hasApiKey,
  });
}
