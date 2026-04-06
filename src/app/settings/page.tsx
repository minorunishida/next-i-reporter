"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_REGION_SYSTEM_PROMPT,
} from "@/lib/ai-default-prompts";

declare global {
  interface Window {
    electronAPI?: {
      isElectron: boolean;
      getSettings: () => Promise<{
        hasApiKey: boolean;
        eprintCliPath: string;
        aiModel: string;
        aiBaseURL: string;
        aiSystemPrompt: string;
        aiRegionSystemPrompt: string;
      }>;
      saveSettings: (s: Record<string, string | undefined>) => Promise<{ ok: boolean }>;
      restartServer: () => Promise<{ ok: boolean; dev?: boolean }>;
      openFileDialog: (options?: { filters?: { name: string; extensions: string[] }[] }) => Promise<string | null>;
    };
  }
}

type Status = "idle" | "saving" | "restarting" | "saved" | "error";

export default function SettingsPage() {
  const [isElectron, setIsElectron] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasApiKey, setHasApiKey] = useState(false);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [eprintCliPath, setEprintCliPath] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiBaseURL, setAiBaseURL] = useState("");
  const [aiSystemPrompt, setAiSystemPrompt] = useState("");
  const [aiRegionSystemPrompt, setAiRegionSystemPrompt] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (window.electronAPI?.isElectron) {
      setIsElectron(true);
      window.electronAPI.getSettings().then((s) => {
        setHasApiKey(s.hasApiKey);
        setEprintCliPath(s.eprintCliPath);
        setAiModel(s.aiModel);
        setAiBaseURL(s.aiBaseURL);
        setAiSystemPrompt(s.aiSystemPrompt);
        setAiRegionSystemPrompt(s.aiRegionSystemPrompt);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  async function handleBrowse() {
    const path = await window.electronAPI?.openFileDialog({
      filters: [{ name: "実行ファイル", extensions: ["exe"] }],
    });
    if (path) setEprintCliPath(path);
  }

  async function handleSave() {
    if (!window.electronAPI) return;
    if (!eprintCliPath.trim()) {
      setErrorMsg("eprint CLI パスを選択してください");
      setStatus("error");
      return;
    }
    setStatus("saving");
    setErrorMsg("");
    try {
      const payload: Record<string, string | undefined> = {
        eprintCliPath: eprintCliPath.trim(),
        AI_MODEL: aiModel.trim(),
        AI_BASE_URL: aiBaseURL.trim(),
        AI_SYSTEM_PROMPT: aiSystemPrompt.trim(),
        AI_REGION_SYSTEM_PROMPT: aiRegionSystemPrompt.trim(),
      };
      if (apiKeyInput.trim()) {
        payload.apiKey = apiKeyInput.trim();
      }
      await window.electronAPI.saveSettings(payload);

      // API キー / eprint パスの変更時のみサーバー再起動
      const needsRestart = Boolean(apiKeyInput.trim()) || Boolean(eprintCliPath.trim());
      if (needsRestart) {
        setStatus("restarting");
        await window.electronAPI.restartServer();
      }

      setStatus("saved");
      if (apiKeyInput.trim()) {
        setHasApiKey(true);
        setApiKeyInput("");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "保存に失敗しました");
      setStatus("error");
    }
  }

  async function handleClearApiKey() {
    if (!window.electronAPI) return;
    if (!confirm("API キーを削除しますか?")) return;
    setStatus("saving");
    try {
      await window.electronAPI.saveSettings({ apiKey: "" });
      setHasApiKey(false);
      setApiKeyInput("");
      setStatus("saved");
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "削除に失敗しました");
      setStatus("error");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center">
        <span className="text-sm text-slate-400">読み込み中...</span>
      </main>
    );
  }

  if (!isElectron) {
    return (
      <main className="flex min-h-[calc(100vh-2.5rem)] items-center justify-center">
        <div className="text-center text-sm text-slate-500">
          <p className="font-medium">この設定画面は Electron アプリ内でのみ利用できます。</p>
          <p className="mt-1 text-slate-400">開発時は <code className="font-mono">.env.local</code> を直接編集してください。</p>
          <Link href="/" className="mt-3 inline-block text-indigo-500 hover:text-indigo-700 transition-colors">
            戻る
          </Link>
        </div>
      </main>
    );
  }

  const isBusy = status === "saving" || status === "restarting";

  return (
    <main className="flex min-h-[calc(100vh-2.5rem)] flex-col items-center px-4 py-8">
      <div className="w-full max-w-xl">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
            </svg>
            戻る
          </Link>
          <h1 className="text-lg font-semibold text-slate-900">設定</h1>
        </div>

        {/* OpenAI API キー */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-800">API キー</h2>
              <p className="mt-0.5 text-xs text-slate-400">
                OS の暗号化機能 (DPAPI) で保護されます。平文では保存されません。
              </p>
            </div>
            {hasApiKey ? (
              <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 ring-1 ring-emerald-200">
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                設定済み
              </span>
            ) : (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                未設定
              </span>
            )}
          </div>

          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder={hasApiKey ? "新しいキーを入力して上書き" : "sk-proj-..."}
              autoComplete="off"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-800 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            {hasApiKey && (
              <button
                onClick={handleClearApiKey}
                disabled={isBusy}
                className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs text-red-500 hover:bg-red-50 disabled:opacity-40 transition-colors"
              >
                削除
              </button>
            )}
          </div>
          <p className="mt-2 text-[11px] text-slate-400">
            入力した値はこのアプリケーションには返りません。OS の保護領域に暗号化されます。
          </p>
        </section>

        {/* eprint CLI パス */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-3 flex items-center gap-1.5">
            <h2 className="text-sm font-semibold text-slate-800">eprint CLI パス</h2>
            <span className="rounded-full bg-red-50 px-1.5 py-0.5 text-[10px] font-medium text-red-500 ring-1 ring-red-200">必須</span>
          </div>
          <p className="mb-3 text-xs text-slate-400">
            Excel → PDF 変換に使用するローカル実行ファイル (.exe) を選択してください。
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={eprintCliPath}
              readOnly
              placeholder="ファイルを選択してください..."
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-700 placeholder:text-slate-300 cursor-default"
            />
            <button
              type="button"
              onClick={handleBrowse}
              className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              参照...
            </button>
          </div>
        </section>

        {/* AI モデル設定 */}
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-semibold text-slate-800">AI モデル設定</h2>

          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium text-slate-600">モデル名</label>
            <input
              type="text"
              value={aiModel}
              onChange={(e) => setAiModel(e.target.value)}
              placeholder="gpt-5.1"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-800 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-[11px] text-slate-400">空欄 = gpt-5.1</p>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">API ベース URL</label>
            <input
              type="text"
              value={aiBaseURL}
              onChange={(e) => setAiBaseURL(e.target.value)}
              placeholder="空欄 = OpenAI 標準エンドポイント"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-mono text-slate-800 placeholder:text-slate-300 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
            <p className="mt-1 text-[11px] text-slate-400">
              OpenAI 互換 API を使用する場合に指定。例: Gemini は <code className="font-mono">https://generativelanguage.googleapis.com/v1beta/openai/</code>
            </p>
          </div>
        </section>

        {/* 帳票解析プロンプト */}
        <PromptSection
          title="帳票解析プロンプト"
          description="Excel ファイル全体を解析するときのシステムプロンプト"
          value={aiSystemPrompt}
          onChange={setAiSystemPrompt}
          defaultValue={DEFAULT_SYSTEM_PROMPT}
        />

        {/* 領域解析プロンプト */}
        <PromptSection
          title="領域解析プロンプト"
          description="ユーザーが選択した領域を解析するときのシステムプロンプト"
          value={aiRegionSystemPrompt}
          onChange={setAiRegionSystemPrompt}
          defaultValue={DEFAULT_REGION_SYSTEM_PROMPT}
        />

        {/* 保存ボタン / ステータス */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={isBusy}
            className="rounded-lg bg-slate-900 px-5 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-wait transition-colors"
          >
            {status === "saving" ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                保存中...
              </span>
            ) : status === "restarting" ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                サーバー再起動中...
              </span>
            ) : (
              "保存して反映"
            )}
          </button>

          {status === "saved" && (
            <span className="flex items-center gap-1.5 text-sm text-emerald-600 animate-fade-in-up">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              保存しました
            </span>
          )}

          {status === "error" && (
            <span className="text-sm text-red-500">{errorMsg}</span>
          )}
        </div>

        <p className="mt-4 mb-8 text-xs text-slate-400">
          API キー・eprint パスの変更はサーバー再起動で反映。AI 設定（モデル・プロンプト）は即時反映されます。
        </p>
      </div>
    </main>
  );
}

function PromptSection({
  title,
  description,
  value,
  onChange,
  defaultValue,
}: {
  title: string;
  description: string;
  value: string;
  onChange: (v: string) => void;
  defaultValue: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const displayValue = value || defaultValue;
  const isDefault = !value || value === defaultValue;

  return (
    <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-400">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {isDefault && (
            <span className="text-[11px] text-slate-400">デフォルト</span>
          )}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
          >
            {expanded ? "閉じる" : "編集"}
          </button>
        </div>
      </div>

      {!expanded && (
        <pre className="max-h-20 overflow-hidden rounded-lg bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500 font-mono whitespace-pre-wrap">
          {displayValue.slice(0, 200)}...
        </pre>
      )}

      {expanded && (
        <>
          <textarea
            value={displayValue}
            onChange={(e) => onChange(e.target.value)}
            rows={16}
            className="w-full resize-y rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-mono leading-relaxed text-slate-700 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            style={{ minHeight: "200px" }}
          />
          {!isDefault && (
            <button
              type="button"
              onClick={() => {
                if (confirm("デフォルトのプロンプトに戻しますか？")) {
                  onChange("");
                }
              }}
              className="mt-2 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:bg-slate-50 transition-colors"
            >
              デフォルトに戻す
            </button>
          )}
        </>
      )}
    </section>
  );
}
