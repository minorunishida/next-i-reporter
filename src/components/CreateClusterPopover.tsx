"use client";

import { useState, useEffect, useRef } from "react";
import { CLUSTER_TYPES } from "@/lib/form-structure";
import type { ClusterTypeName } from "@/lib/form-structure";

const TYPE_LABELS: Record<ClusterTypeName, string> = {
  KeyboardText: "テキスト入力",
  Date: "日付",
  Time: "時刻",
  InputNumeric: "数値入力",
  Calculate: "計算式",
  Select: "選択",
  Check: "チェック",
  Image: "画像",
  Handwriting: "手書き",
};

type AiResult = {
  name: string;
  typeName: string;
  type: number;
  confidence: number;
  inputParameters: string;
  readOnly: boolean;
  cellAddress: string;
  formula?: string | null;
};

type Props = {
  screenX: number;
  screenY: number;
  /** If provided, starts AI inference automatically */
  onRequestAi: () => Promise<AiResult>;
  onConfirm: (data: { name: string; typeName: ClusterTypeName; type: number; inputParameters: string; readOnly: boolean; cellAddress: string; formula?: string }) => void;
  onCancel: () => void;
};

export default function CreateClusterPopover({
  screenX,
  screenY,
  onRequestAi,
  onConfirm,
  onCancel,
}: Props) {
  const [status, setStatus] = useState<"loading" | "result" | "error" | "manual">("loading");
  const [name, setName] = useState("新規クラスター");
  const [typeName, setTypeName] = useState<ClusterTypeName>("KeyboardText");
  const [inputParameters, setInputParameters] = useState("");
  const [readOnly, setReadOnly] = useState(false);
  const [cellAddress, setCellAddress] = useState("");
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState("");
  const popoverRef = useRef<HTMLDivElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Start AI inference on mount
  useEffect(() => {
    let cancelled = false;
    onRequestAi()
      .then((result) => {
        if (cancelled) return;
        setName(result.name);
        setTypeName(result.typeName as ClusterTypeName);
        setInputParameters(result.inputParameters);
        setReadOnly(result.readOnly);
        setCellAddress(result.cellAddress);
        setConfidence(result.confidence);
        setStatus("result");
        // Auto-focus name input after result
        setTimeout(() => nameInputRef.current?.select(), 50);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "AI推論に失敗しました");
        setStatus("error");
      });
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleConfirm = () => {
    onConfirm({
      name,
      typeName,
      type: CLUSTER_TYPES[typeName],
      inputParameters,
      readOnly,
      cellAddress,
    });
  };

  const handleSkipToManual = () => {
    setStatus("manual");
    setTimeout(() => nameInputRef.current?.select(), 50);
  };

  // Position: try to show below-right of the cursor, but clamp to viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: Math.min(screenX + 8, window.innerWidth - 320),
    top: Math.min(screenY + 8, window.innerHeight - 300),
    zIndex: 9999,
  };

  return (
    <div
      ref={popoverRef}
      style={style}
      className="w-72 rounded-xl bg-white shadow-xl ring-1 ring-slate-200/80 overflow-hidden animate-fade-in-up"
      onMouseDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 border-b border-emerald-100">
        <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-xs font-semibold text-emerald-800">新規クラスター作成</span>
        {status === "result" && (
          <span className="ml-auto text-[10px] font-medium text-emerald-600 bg-emerald-100 rounded-full px-2 py-0.5">
            AI {Math.round(confidence * 100)}%
          </span>
        )}
      </div>

      <div className="p-3 flex flex-col gap-2.5">
        {/* Loading state */}
        {status === "loading" && (
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="h-5 w-5 border-2 border-emerald-300 border-t-emerald-600 rounded-full animate-spin" />
            <span className="text-xs text-slate-500">AI が推論中...</span>
            <button
              onClick={handleSkipToManual}
              className="text-[10px] text-slate-400 hover:text-slate-600 underline"
            >
              スキップして手動作成
            </button>
          </div>
        )}

        {/* Error state */}
        {status === "error" && (
          <div className="flex flex-col gap-2 py-2">
            <p className="text-xs text-red-600">{error}</p>
            <button
              onClick={handleSkipToManual}
              className="text-xs text-slate-500 hover:text-slate-700 underline"
            >
              手動で作成する
            </button>
          </div>
        )}

        {/* Result / Manual form */}
        {(status === "result" || status === "manual") && (
          <>
            {/* Name */}
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">名前</label>
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
                onKeyDown={(e) => { if (e.key === "Enter") handleConfirm(); }}
              />
            </div>

            {/* Type */}
            <div>
              <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">タイプ</label>
              <select
                value={typeName}
                onChange={(e) => setTypeName(e.target.value as ClusterTypeName)}
                className="mt-0.5 w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-emerald-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-100"
              >
                {(Object.keys(TYPE_LABELS) as ClusterTypeName[]).map((t) => (
                  <option key={t} value={t}>{TYPE_LABELS[t]} ({CLUSTER_TYPES[t]})</option>
                ))}
              </select>
            </div>

            {/* Buttons */}
            <div className="flex items-center gap-2 pt-1">
              <button
                onClick={handleConfirm}
                disabled={!name.trim()}
                className="flex-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                作成
              </button>
              <button
                onClick={onCancel}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 transition-colors"
              >
                キャンセル
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
