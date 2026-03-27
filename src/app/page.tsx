"use client";

import { useState, useCallback } from "react";
import ExcelUploader from "@/components/ExcelUploader";
import FormPreview from "@/components/FormPreview";
import ClusterEditor from "@/components/ClusterEditor";
import type { FormStructure, AnalysisResult, ClusterDefinition } from "@/lib/form-structure";

type Step = "upload" | "preview" | "analyzing" | "result";

export default function Home() {
  const [step, setStep] = useState<Step>("upload");
  const [formStructure, setFormStructure] = useState<FormStructure | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleParsed = useCallback((data: FormStructure) => {
    setFormStructure(data);
    setAnalysisResult(null);
    setError(null);
    setStep("preview");
  }, []);

  const handleAnalyze = useCallback(async () => {
    if (!formStructure) return;
    setStep("analyzing");
    setError(null);
    try {
      // AI に送る際は pdfBase64 を除外 (トークン節約)
      const { pdfBase64: _pdf, ...formForAi } = formStructure;
      const res = await fetch("/api/ai-analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formForAi),
      });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "AI 解析に失敗しました");
      }
      const result: AnalysisResult = await res.json();
      // pdfBase64 を復元 (XML 生成時に必要)
      result.formStructure.pdfBase64 = formStructure.pdfBase64;
      setAnalysisResult(result);
      setStep("result");
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
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? "AI 解析に失敗しました");
      }
      const result: AnalysisResult = await res.json();
      result.formStructure.pdfBase64 = formStructure.pdfBase64;
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
    <main className="flex min-h-[calc(100vh-3.5rem)] flex-col items-center px-4 py-8 sm:py-12">
      <div className="w-full max-w-7xl animate-fade-in-up">
        {/* Step indicator */}
        <div className="mb-8 flex justify-center">
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
                      className={`h-px w-8 sm:w-12 transition-colors duration-300 ${
                        isDone || isActive ? "bg-blue-300" : "bg-slate-200"
                      }`}
                    />
                  )}
                  <div className="flex flex-col items-center gap-1.5">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold transition-all duration-300 ${
                        isActive
                          ? "bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-200 animate-pulse-glow"
                          : isDone
                            ? "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200"
                            : "bg-slate-100 text-slate-400 ring-1 ring-slate-200"
                      }`}
                    >
                      {isDone ? (
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        s.icon
                      )}
                    </div>
                    <span
                      className={`text-[10px] sm:text-xs font-medium transition-colors duration-300 ${
                        isActive
                          ? "text-blue-600"
                          : isDone
                            ? "text-emerald-600"
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
          <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 shadow-sm animate-fade-in-up">
            <svg className="h-5 w-5 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <section className="flex flex-col items-center animate-fade-in-up">
            <ExcelUploader onParsed={handleParsed} />
          </section>
        )}

        {/* STEP 2: Preview */}
        {(step === "preview" || step === "analyzing") && formStructure && (
          <section className="flex flex-col gap-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
                  <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-800">
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
                className={`group relative overflow-hidden rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 ${
                  step === "analyzing"
                    ? "bg-blue-400 cursor-wait shadow-blue-200"
                    : "bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0"
                }`}
              >
                {step === "analyzing" ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    AI 解析中...
                  </span>
                ) : (
                  <span className="flex items-center gap-2">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    AI で解析する
                  </span>
                )}
              </button>
            </div>
          </section>
        )}

        {/* STEP 3: Results */}
        {step === "result" && analysisResult && formStructure && (
          <section className="flex flex-col gap-6 animate-fade-in-up">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 ring-1 ring-emerald-100">
                  <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h2 className="text-lg font-semibold text-slate-800">
                  AI 解析結果
                </h2>
                <span className="text-xs text-slate-400">
                  {analysisResult.summary.totalClusters} クラスタ検出
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

            <ClusterEditor
              analysisResult={analysisResult}
              formStructure={formStructure}
              onClustersChange={handleClustersChange}
            />

            <div className="flex justify-end gap-3">
              <button
                onClick={handleReanalyze}
                className="group relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 hover:shadow-lg hover:shadow-violet-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  AI で再解析
                </span>
              </button>
              <button
                onClick={async () => {
                  if (!analysisResult) return;
                  try {
                    const res = await fetch("/api/generate-xml", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(analysisResult),
                    });
                    if (!res.ok) {
                      const body = await res.json();
                      throw new Error(body.error ?? "XML 生成に失敗しました");
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
                className="group relative overflow-hidden rounded-xl px-6 py-2.5 text-sm font-semibold text-white shadow-md transition-all duration-200 bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 hover:shadow-lg hover:shadow-emerald-200 hover:-translate-y-0.5 active:translate-y-0"
              >
                <span className="flex items-center gap-2">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  ConMas XML をダウンロード
                </span>
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
