"use client";

import { useState, useCallback, useEffect } from "react";
import confetti from "canvas-confetti";

const ANALYZING_MESSAGES = [
  "セルを読み取っています...",
  "帳票の構造を分析中...",
  "入力欄を探しています...",
  "数式を解析中...",
  "結合セルを確認しています...",
  "クラスター候補を推測中...",
  "型を判定しています...",
  "パラメータを生成中...",
  "もう少しで完了します...",
  "AIが頑張っています...",
  "コーヒーでも飲みますか？",
  "帳票マスターへの道...",
];
import ExcelUploader from "@/components/ExcelUploader";
import FormPreview from "@/components/FormPreview";
import ClusterEditor from "@/components/ClusterEditor";
import EditorShell from "@/components/layout/EditorShell";
import type { FormStructure, AnalysisResult, ClusterDefinition, NetworkDefinition } from "@/lib/form-structure";
import { messageFromFailedResponse, parseJsonResponse } from "@/lib/api-response";

type Step = "upload" | "preview" | "analyzing" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [formStructure, setFormStructure] = useState<FormStructure | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  // activeTab and selectedNetworkId are now managed inside EditorShell's EditorContext

  const handleParsed = useCallback((data: FormStructure) => {
    setFormStructure(data);
    setAnalysisResult(null);
    setError(null);
    setStep("preview");
  }, []);

  const handleImported = useCallback((data: AnalysisResult) => {
    setFormStructure(data.formStructure);
    setAnalysisResult(data);
    setError(null);
    setStep("result");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!formStructure) return;
    setStep("analyzing");
    setError(null);
    try {
      // AI に送る際は pdfBase64/excelBase64 を除外 (トークン節約)
      const { pdfBase64: _pdf, excelBase64: _xls, ...formForAi } = formStructure;
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formForAi),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(messageFromFailedResponse(text, res.status));
      }
      const result = parseJsonResponse<AnalysisResult>(text);
      // pdfBase64 を復元 (XML 生成時に必要)
      result.formStructure.pdfBase64 = formStructure.pdfBase64;
      result.formStructure.excelBase64 = formStructure.excelBase64;
      result.formStructure.embeddedExcelFileName = formStructure.embeddedExcelFileName;
      result.formStructure.cellCommentCatalog = formStructure.cellCommentCatalog;
      setAnalysisResult(result);
      setStep("result");
      // 派手なクラッカー演出（3連発）
      const fire = (delay: number, opts: confetti.Options) =>
        setTimeout(() => confetti(opts), delay);
      fire(0, { particleCount: 80, spread: 100, startVelocity: 30, gravity: 0.6, origin: { x: 0.5, y: 0.5 }, colors: ["#4f46e5", "#6366f1", "#818cf8", "#fbbf24", "#f59e0b"] });
      fire(300, { particleCount: 60, spread: 120, startVelocity: 40, gravity: 0.5, origin: { x: 0.3, y: 0.6 }, colors: ["#4f46e5", "#10b981", "#34d399", "#fbbf24"] });
      fire(600, { particleCount: 60, spread: 120, startVelocity: 40, gravity: 0.5, origin: { x: 0.7, y: 0.6 }, colors: ["#8b5cf6", "#a855f7", "#f59e0b", "#ef4444"] });
      fire(1000, { particleCount: 120, spread: 160, startVelocity: 25, gravity: 0.4, scalar: 1.2, origin: { x: 0.5, y: 0.4 }, colors: ["#4f46e5", "#6366f1", "#fbbf24", "#10b981", "#ef4444"] });
      fire(1500, { particleCount: 40, spread: 80, startVelocity: 20, gravity: 0.3, scalar: 1.5, origin: { x: 0.5, y: 0.5 }, shapes: ["circle"], colors: ["#4f46e5", "#fbbf24"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStep("preview");
    }
  }, [formStructure]);

  const handleClustersChange = useCallback((clusters: ClusterDefinition[]) => {
    setAnalysisResult((prev) => {
      if (!prev) return prev;
      const highConfidence = clusters.filter((c) => c.confidence >= 0.9).length;
      const mediumConfidence = clusters.filter((c) => c.confidence >= 0.7 && c.confidence < 0.9).length;
      const lowConfidence = clusters.filter((c) => c.confidence < 0.7).length;
      return {
        ...prev,
        clusters,
        summary: {
          totalClusters: clusters.length,
          highConfidence,
          mediumConfidence,
          lowConfidence,
        },
      };
    });
  }, []);

  const handleNetworksChange = useCallback((networks: NetworkDefinition[]) => {
    setAnalysisResult((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        formStructure: { ...prev.formStructure, networks },
      };
    });
  }, []);

  const handleCarbonCopyChange = useCallback((clusters: ClusterDefinition[]) => {
    setAnalysisResult((prev) => {
      if (!prev) return prev;
      const highConfidence = clusters.filter((c) => c.confidence >= 0.9).length;
      const mediumConfidence = clusters.filter((c) => c.confidence >= 0.7 && c.confidence < 0.9).length;
      const lowConfidence = clusters.filter((c) => c.confidence < 0.7).length;
      return {
        ...prev,
        clusters,
        summary: {
          totalClusters: clusters.length,
          highConfidence,
          mediumConfidence,
          lowConfidence,
        },
      };
    });
  }, []);

  const handleReanalyze = useCallback(async () => {
    if (!formStructure) return;
    setStep("analyzing");
    setError(null);
    try {
      const { pdfBase64: _pdf, ...formForAi } = formStructure;
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formForAi),
      });
      const text = await res.text();
      if (!res.ok) {
        throw new Error(messageFromFailedResponse(text, res.status));
      }
      const result = parseJsonResponse<AnalysisResult>(text);
      result.formStructure.pdfBase64 = formStructure.pdfBase64;
      result.formStructure.excelBase64 = formStructure.excelBase64;
      result.formStructure.embeddedExcelFileName = formStructure.embeddedExcelFileName;
      result.formStructure.cellCommentCatalog = formStructure.cellCommentCatalog;
      setAnalysisResult(result);
      setStep("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setStep("result");
    }
  }, [formStructure]);

  const handleReset = useCallback(() => {
    setFormStructure(null);
    setAnalysisResult(null);
    setError(null);
    setStep("upload");
  }, []);

  const steps = [
    { key: "upload", label: "アップロード", icon: "1" },
    { key: "preview", label: "プレビュー", icon: "2" },
    { key: "result", label: "AI 解析結果", icon: "3" },
  ] as const;

  return (
    <main className={`flex min-h-[calc(100vh-2.5rem)] flex-col ${step === "result" ? "" : "items-center px-4 py-4 sm:py-6"}`}>
      <div className={`w-full animate-fade-in-up ${step === "result" ? "" : "max-w-7xl mx-auto px-4"}`}>
        {/* Step indicator */}
        <div className="mb-4 flex justify-center">
          <div className="flex items-center gap-0">
            {steps.map((s, i) => {
              const isActive =
                s.key === step || (s.key === "preview" && step === "analyzing");
              const isDone =
                (s.key === "upload" && step !== "upload") ||
                (s.key === "preview" && (step === "result" || step === "analyzing"));

              return (
                <div key={s.key} className="flex items-center">
                  {i > 0 && (
                    <div
                      className={`h-px w-10 sm:w-16 transition-colors duration-300 ${
                        isDone ? "bg-slate-300" : "bg-slate-200"
                      }`}
                    />
                  )}
                  <div className="flex items-center gap-1.5 px-1">
                    {isDone ? (
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    ) : (
                      <span
                        className={`text-xs font-medium ${
                          isActive ? "text-slate-500" : "text-slate-300"
                        }`}
                      >
                        {s.icon}
                      </span>
                    )}
                    <span
                      className={`text-xs font-medium transition-colors duration-300 ${
                        isActive
                          ? "text-slate-900 border-b border-slate-900 pb-0.5"
                          : isDone
                            ? "text-slate-500"
                            : "text-slate-400"
                      }`}
                    >
                      {s.label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Error banner */}
        {error && (
          <div className="mb-6 flex items-center gap-3 rounded-lg border-l-4 border-red-400 bg-red-50 px-4 py-3 text-sm text-red-700 animate-fade-in-up">
            <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Upload with brand hero */}
        {step === "upload" && (
          <section className="flex flex-col items-center animate-fade-in-up mt-8 sm:mt-16">
            {/* Brand hero */}
            <div className="text-center mb-16">
              <h1 className="text-[8rem] sm:text-[12rem] font-black tracking-tighter text-gray-900 leading-none">
                KONDO<span className="text-indigo-600">723</span>
              </h1>
              <p className="mt-4 text-xl text-gray-400 font-light tracking-widest uppercase">
                AI-Powered Form Definition
              </p>
              <p className="mt-2 text-sm text-gray-300 tracking-wide">
                Excel to ConMas i-Reporter
              </p>
            </div>
            <ExcelUploader onParsed={handleParsed} onImported={handleImported} />
          </section>
        )}

        {/* STEP 2: Preview */}
        {(step === "preview" || step === "analyzing") && formStructure && (
          <section className="flex flex-col gap-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                </svg>
                <h2 className="text-sm font-semibold text-slate-900">
                  セル構造の確認
                </h2>
              </div>
              <button
                onClick={handleReset}
                className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
              >
                別のファイルを選択
              </button>
            </div>

            <FormPreview formStructure={formStructure} />

            <div className="flex justify-end">
              <button
                onClick={handleAnalyze}
                disabled={step === "analyzing"}
                className={`rounded-lg px-5 py-2 text-sm font-medium text-white transition-colors duration-150 ${
                  step === "analyzing"
                    ? "bg-slate-400 cursor-wait"
                    : "bg-slate-900 hover:bg-slate-800"
                }`}
              >
                <span className="flex items-center gap-2">
                  {step === "analyzing" ? (
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  )}
                  {step === "analyzing" ? "解析中..." : "AI で解析する"}
                </span>
              </button>
            </div>
          </section>
        )}

        {/* STEP 3: Results — Acrobat-style 3-column layout */}
        {step === "result" && analysisResult && formStructure && (
          <EditorShell
            analysisResult={analysisResult}
            formStructure={analysisResult.formStructure}
            onClustersChange={handleClustersChange}
            onNetworksChange={handleNetworksChange}
            onCarbonCopyChange={handleCarbonCopyChange}
            headerSlot={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <h2 className="text-sm font-semibold text-slate-900">AI 解析結果</h2>
                  <span className="text-xs text-slate-400">
                    {analysisResult.summary.totalClusters} クラスター検出
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setStep("preview")}
                    className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    プレビューに戻る
                  </button>
                  <button
                    onClick={handleReset}
                    className="rounded-lg px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                  >
                    最初から
                  </button>
                </div>
              </div>
            }
            actionBarSlot={
              <>
                <button
                  onClick={handleReanalyze}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-700 bg-white ring-1 ring-slate-200 hover:bg-slate-50 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI で再解析
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!analysisResult.formStructure.excelBase64?.trim()}
                  title={
                    analysisResult.formStructure.excelBase64?.trim()
                      ? undefined
                      : "Excel から取り込んだ帳票、または定義ファイル付き XML のみダウンロードできます"
                  }
                  onClick={async () => {
                    if (!analysisResult) return;
                    try {
                      const res = await fetch("/api/generate-excel-definition", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(analysisResult),
                      });
                      if (!res.ok) {
                        throw new Error(messageFromFailedResponse(await res.text(), res.status));
                      }
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const baseDl =
                        analysisResult.formStructure.embeddedExcelFileName?.trim() ||
                        analysisResult.formStructure.fileName ||
                        "definition.xlsx";
                      a.download = /\.xml$/i.test(baseDl)
                        ? baseDl.replace(/\.xml$/i, ".xlsx")
                        : baseDl;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Excel 定義の生成に失敗しました");
                    }
                  }}
                  className="rounded-lg px-5 py-2 text-sm font-medium text-white bg-[#217346] hover:bg-[#1a5c38] shadow-sm transition-colors duration-150 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#217346]"
                >
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    Excel 定義をダウンロード
                  </span>
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    if (!analysisResult) return;
                    try {
                      const res = await fetch("/api/generate-xml", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(analysisResult),
                      });
                      if (!res.ok) {
                        throw new Error(messageFromFailedResponse(await res.text(), res.status));
                      }
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      const name = analysisResult.formStructure.fileName.replace(/\.[^.]+$/, "") + "_conmas.xml";
                      a.download = name;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "XML 生成に失敗しました");
                    }
                  }}
                  className="rounded-lg px-5 py-2 text-sm font-medium text-white bg-slate-900 hover:bg-slate-800 transition-colors duration-150"
                >
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                    ConMas XML をダウンロード
                  </span>
                </button>
              </>
            }
          >
            <ClusterEditor
              analysisResult={analysisResult}
              formStructure={analysisResult.formStructure}
              onClustersChange={handleClustersChange}
              networks={analysisResult.formStructure.networks}
              onNetworksChange={handleNetworksChange}
              onCarbonCopyChange={handleCarbonCopyChange}
            />
          </EditorShell>
        )}
      </div>

      {/* Full-screen AI analyzing overlay */}
      {step === "analyzing" && <AnalyzingOverlay />}
    </main>
  );
}

function AnalyzingOverlay() {
  const [msgIdx, setMsgIdx] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const msgTimer = setInterval(() => {
      setMsgIdx((i) => (i + 1) % ANALYZING_MESSAGES.length);
    }, 2500);
    const elapsedTimer = setInterval(() => {
      setElapsed((e) => e + 1);
    }, 1000);
    // 小さなキラキラを定期的に打ち上げ
    const sparkleTimer = setInterval(() => {
      confetti({
        particleCount: 8,
        spread: 40,
        startVelocity: 15,
        gravity: 0.6,
        colors: ["#6366f1", "#3b82f6", "#8b5cf6", "#a855f7"],
        origin: { x: 0.3 + Math.random() * 0.4, y: 0.45 },
        scalar: 0.6,
      });
    }, 3000);
    return () => {
      clearInterval(msgTimer);
      clearInterval(elapsedTimer);
      clearInterval(sparkleTimer);
    };
  }, []);

  const progress = Math.min(95, elapsed * 4 + 8);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gradient-to-br from-slate-900/80 via-indigo-950/70 to-slate-900/80 backdrop-blur-sm animate-fade-in-up">
      <div className="flex flex-col items-center gap-8 px-8">

        {/* Pulsing rings */}
        <div className="relative flex items-center justify-center">
          <div className="absolute h-40 w-40 rounded-full border border-blue-400/20 animate-ping" style={{ animationDuration: "3s" }} />
          <div className="absolute h-32 w-32 rounded-full border border-indigo-400/30 animate-ping" style={{ animationDuration: "2.5s" }} />
          <div className="absolute h-24 w-24 rounded-full border border-purple-400/20 animate-ping" style={{ animationDuration: "2s" }} />

          {/* Main icon */}
          <div className="relative h-20 w-20 rounded-2xl bg-gradient-to-br from-blue-500 via-indigo-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-indigo-500/40">
            <svg className="h-10 w-10 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
            </svg>

            {/* Orbiting particles */}
            <div className="absolute inset-[-12px] animate-spin" style={{ animationDuration: "4s" }}>
              <div className="absolute top-0 left-1/2 h-2.5 w-2.5 rounded-full bg-blue-400 shadow-lg shadow-blue-400/50" />
            </div>
            <div className="absolute inset-[-18px] animate-spin" style={{ animationDuration: "6s", animationDirection: "reverse" }}>
              <div className="absolute bottom-0 left-1/2 h-2 w-2 rounded-full bg-purple-400 shadow-lg shadow-purple-400/50" />
            </div>
            <div className="absolute inset-[-8px] animate-spin" style={{ animationDuration: "3s" }}>
              <div className="absolute left-0 top-1/2 h-1.5 w-1.5 rounded-full bg-indigo-300 shadow-lg shadow-indigo-300/50" />
            </div>
          </div>
        </div>

        {/* Title */}
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">
            AI Analyzing
          </h2>
          <p className="mt-3 text-base text-blue-200/90 transition-all duration-500 min-h-[1.5em]">
            {ANALYZING_MESSAGES[msgIdx]}
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-80">
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 transition-all duration-1000 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-slate-400 font-mono">{elapsed}s</span>
            <span className="text-xs text-slate-400">{progress.toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
