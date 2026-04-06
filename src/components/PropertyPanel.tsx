"use client";

import type { ClusterDefinition, ClusterTypeName } from "@/lib/form-structure";
import { CLUSTER_TYPES_FULL } from "@/lib/form-structure";
import {
  CLUSTER_TYPE_REGISTRY,
  CATEGORY_LABELS_JA,
  type ClusterCategory,
  type ClusterTypeEntry,
} from "@/lib/cluster-type-registry";
import ParameterEditor from "./ParameterEditor";

// ─── Confidence helpers ─────────────────────────────────────────────────────

function confidenceColor(c: number) {
  if (c >= 0.9)
    return {
      bg: "rgba(16,185,129,0.18)",
      border: "rgba(16,185,129,0.55)",
      label: "高",
      badgeCls:
        "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60",
    };
  if (c >= 0.7)
    return {
      bg: "rgba(245,158,11,0.18)",
      border: "rgba(245,158,11,0.55)",
      label: "中",
      badgeCls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60",
    };
  return {
    bg: "rgba(239,68,68,0.18)",
    border: "rgba(239,68,68,0.55)",
    label: "低",
    badgeCls: "bg-red-50 text-red-700 ring-1 ring-red-200/60",
  };
}

// ─── PropertyPanel ──────────────────────────────────────────────────────────

export function PropertyPanel({
  cluster,
  onUpdate,
  onDelete,
}: {
  cluster: ClusterDefinition;
  onUpdate: (patch: Partial<ClusterDefinition>) => void;
  onDelete: () => void;
}) {
  const cc = confidenceColor(cluster.confidence);

  return (
    <div className="flex flex-col gap-0 divide-y divide-slate-100">
      {/* Header */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[10px] font-mono text-slate-400">
            {cluster.cellAddress}
          </span>
          <span
            className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ${cc.badgeCls}`}
          >
            {cc.label} {Math.round(cluster.confidence * 100)}%
          </span>
        </div>
        {/* Confidence bar */}
        <div className="h-1 w-full rounded-full bg-slate-100 overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-300"
            style={{
              width: `${cluster.confidence * 100}%`,
              background:
                cluster.confidence >= 0.9
                  ? "linear-gradient(90deg, #10b981, #34d399)"
                  : cluster.confidence >= 0.7
                    ? "linear-gradient(90deg, #f59e0b, #fbbf24)"
                    : "linear-gradient(90deg, #ef4444, #f87171)",
            }}
          />
        </div>
      </div>

      {/* Name */}
      <div className="px-4 py-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          名前
        </label>
        <input
          type="text"
          value={cluster.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        />
      </div>

      {/* Type */}
      <div className="px-4 py-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          タイプ
        </label>
        <select
          value={cluster.typeName}
          onChange={(e) => {
            const typeName = e.target.value as ClusterTypeName;
            onUpdate({ typeName, type: CLUSTER_TYPES_FULL[typeName] });
          }}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        >
          {(() => {
            const grouped = new Map<ClusterCategory, ClusterTypeEntry[]>();
            for (const entry of CLUSTER_TYPE_REGISTRY) {
              if (!grouped.has(entry.category))
                grouped.set(entry.category, []);
              grouped.get(entry.category)!.push(entry);
            }
            return Array.from(grouped.entries()).map(([cat, entries]) => (
              <optgroup key={cat} label={CATEGORY_LABELS_JA[cat]}>
                {entries.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.displayNameJa}
                  </option>
                ))}
              </optgroup>
            ));
          })()}
        </select>
      </div>

      {/* readOnly toggle */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
            読取専用
          </label>
          <button
            onClick={() => onUpdate({ readOnly: !cluster.readOnly })}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 ${
              cluster.readOnly ? "bg-blue-500" : "bg-slate-200"
            }`}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-sm transition-transform duration-200 ${
                cluster.readOnly
                  ? "translate-x-[18px]"
                  : "translate-x-[3px]"
              }`}
            />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          {cluster.readOnly
            ? "ユーザーは値を変更できません"
            : "ユーザーが値を入力できます"}
        </p>
      </div>

      {/* Value (display only) */}
      {(cluster.value || cluster.formula) && (
        <div className="px-4 py-3">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
            {cluster.formula ? "数式" : "値"}
          </label>
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-mono text-slate-600 ring-1 ring-slate-200/60 break-all">
            {cluster.formula ? `=${cluster.formula}` : cluster.value}
          </div>
        </div>
      )}

      {/* inputParameters editor */}
      <div className="px-4 py-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          パラメータ
        </label>
        <ParameterEditor
          typeName={cluster.typeName}
          inputParameters={cluster.inputParameters}
          onChange={(newParams) => onUpdate({ inputParameters: newParams })}
        />
      </div>

      {/* Region info */}
      <div className="px-4 py-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          領域 (px)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["top", "bottom", "left", "right"] as const).map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 w-10">{key}</span>
              <span className="text-[11px] font-mono text-slate-600">
                {Math.round(cluster.region[key])}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Delete */}
      <div className="px-4 py-3">
        <button
          onClick={onDelete}
          className="w-full rounded-xl bg-red-50 px-4 py-2.5 text-xs font-semibold text-red-600 ring-1 ring-red-200/60 hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
        >
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
          このクラスターを削除
        </button>
      </div>
    </div>
  );
}

// ─── EmptyPropertyPanel ─────────────────────────────────────────────────────

export function EmptyPropertyPanel({
  selectedCount,
}: {
  selectedCount: number;
}) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200/60">
        <svg
          className="h-5 w-5 text-slate-300"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122"
          />
        </svg>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">
          クラスターを選択してください
        </p>
        <p className="mt-1 text-[10px] text-slate-400">
          プレビューでクラスターをクリックするとプロパティを編集できます
        </p>
      </div>
      {selectedCount > 1 && (
        <p className="text-[10px] text-blue-500 font-medium">
          {selectedCount} 件選択中
        </p>
      )}
    </div>
  );
}
