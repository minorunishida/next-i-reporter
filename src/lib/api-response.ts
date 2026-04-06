/**
 * API が JSON 以外（HTML の 500 等）を返したときも人が読めるメッセージにする。
 */
export function messageFromFailedResponse(text: string, status: number): string {
  const t = text.trim();
  try {
    const j = JSON.parse(t) as { error?: unknown };
    if (typeof j.error === "string" && j.error.length > 0) return j.error;
  } catch {
    /* 非 JSON */
  }
  if (
    status >= 500 &&
    (t.startsWith("<!") || t.includes("Internal Server Error") || t.includes("internal server"))
  ) {
    return "サーバー内部エラーです。Electron 版では .exe と同じフォルダに .env を置き、OPENAI_API_KEY を設定してからアプリを再起動してください。";
  }
  return t.length > 0 ? t.slice(0, 500) : `エラー (${status})`;
}

/** res.text() 済みの本文を JSON としてパース（成功時） */
export function parseJsonResponse<T>(text: string): T {
  return JSON.parse(text) as T;
}
