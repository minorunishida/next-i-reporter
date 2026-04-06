import { readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_REGION_SYSTEM_PROMPT,
} from "./ai-default-prompts";

export interface AiConfig {
  model: string;
  baseURL: string | undefined;
  systemPrompt: string;
  regionSystemPrompt: string;
}

/**
 * userData/settings.json から AI 設定を読み取る。
 * リクエストごとに呼ぶ（プロンプト変更がサーバー再起動なしで即反映）。
 */
export function loadAiConfig(): AiConfig {
  const defaults: AiConfig = {
    model: process.env.OPENAI_MODEL ?? "gpt-5.1",
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    regionSystemPrompt: DEFAULT_REGION_SYSTEM_PROMPT,
  };

  const userDataPath = process.env.USER_DATA_PATH;
  if (!userDataPath) return defaults;

  try {
    const raw = readFileSync(
      path.join(userDataPath, "settings.json"),
      "utf8",
    );
    const s = JSON.parse(raw);
    return {
      model: s.AI_MODEL || defaults.model,
      baseURL: s.AI_BASE_URL || defaults.baseURL,
      systemPrompt: s.AI_SYSTEM_PROMPT || defaults.systemPrompt,
      regionSystemPrompt:
        s.AI_REGION_SYSTEM_PROMPT || defaults.regionSystemPrompt,
    };
  } catch {
    return defaults;
  }
}
