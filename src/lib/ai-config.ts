import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_REGION_SYSTEM_PROMPT,
} from "./ai-default-prompts";

/** USER_DATA_PATH が未設定の場合のフォールバック（electron:dev 対応） */
function resolveUserDataFallback(): string | null {
  // dev モードでは package.json の name ("next-i-reporter") が使われる
  // パッケージ版では appId ("jp.kondo723.app") が使われる
  const appNames = ["next-i-reporter", "jp.kondo723.app"];

  for (const appName of appNames) {
    let dir: string | null = null;
    if (process.platform === "win32" && process.env.APPDATA) {
      dir = path.join(process.env.APPDATA, appName);
    } else if (process.platform === "darwin" && process.env.HOME) {
      dir = path.join(process.env.HOME, "Library", "Application Support", appName);
    } else if (process.env.HOME) {
      dir = path.join(process.env.HOME, ".config", appName);
    }
    if (dir && existsSync(dir)) return dir;
  }
  return null;
}

function getUserDataPath(): string | null {
  return process.env.USER_DATA_PATH || resolveUserDataFallback();
}

/**
 * Electron が書き出した runtime-env.json からシークレットを読み込み、
 * process.env にまだ設定されていないものを注入する。
 * electron:dev で Next.js dev サーバー（別プロセス）に設定を渡すための仕組み。
 */
export function loadRuntimeEnv(): void {
  // 既に API キーがあれば不要
  if (process.env.OPENAI_API_KEY) return;

  const userDataPath = getUserDataPath();
  if (!userDataPath) return;

  const runtimeEnvPath = path.join(userDataPath, "runtime-env.json");
  if (!existsSync(runtimeEnvPath)) return;

  try {
    const raw = readFileSync(runtimeEnvPath, "utf8");
    const env = JSON.parse(raw) as Record<string, string>;
    for (const [key, value] of Object.entries(env)) {
      if (value && !process.env[key]) {
        process.env[key] = value;
      }
    }
  } catch {
    // ignore parse errors
  }
}

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
  // runtime-env から API キー等を注入（electron:dev 対応）
  loadRuntimeEnv();

  const defaults: AiConfig = {
    model: process.env.OPENAI_MODEL ?? "gpt-5.1",
    baseURL: process.env.OPENAI_BASE_URL || undefined,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    regionSystemPrompt: DEFAULT_REGION_SYSTEM_PROMPT,
  };

  const userDataPath = getUserDataPath();
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
