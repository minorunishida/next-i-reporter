"use client";

import type { ClusterDefinition, ClusterTypeName } from "@/lib/form-structure";
import {
  TYPE_LABELS_JA,
  CLUSTER_TYPE_REGISTRY,
  CATEGORY_LABELS_JA,
  type ClusterCategory,
  type ClusterTypeEntry,
} from "@/lib/cluster-type-registry";

type Props = {
  clusters: ClusterDefinition[];
  selectedIds: Set<string>;
  editorMode: "select" | "create" | "network" | "carbonCopy";
  onModeChange: (mode: "select" | "create" | "network" | "carbonCopy") => void;
  filterType: ClusterTypeName | "all";
  filterConfidence: "all" | "high" | "medium" | "low";
  searchQuery: string;
  onFilterTypeChange: (type: ClusterTypeName | "all") => void;
  onFilterConfidenceChange: (level: "all" | "high" | "medium" | "low") => void;
  onSearchChange: (query: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onNudge: (dx: number, dy: number) => void;
};

const TYPE_LABELS = TYPE_LABELS_JA;

export default function ClusterToolbar({
  clusters,
  selectedIds,
  editorMode,
  onModeChange,
  filterType,
  filterConfidence,
  searchQuery,
  onFilterTypeChange,
  onFilterConfidenceChange,
  onSearchChange,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onNudge,
}: Props) {
  // Type counts
  const typeCounts = new Map<string, number>();
  for (const c of clusters) {
    typeCounts.set(c.typeName, (typeCounts.get(c.typeName) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200/60">
      {/* Top row: mode toggle + summary + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Mode toggle */}
          <div className="flex items-center rounded-lg ring-1 ring-slate-200/60 overflow-hidden">
            <button
              onClick={() => onModeChange("select")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                editorMode === "select"
                  ? "bg-blue-50 text-blue-700 shadow-inner"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
              title="選択モード (V)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
              </svg>
              選択
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => onModeChange("create")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                editorMode === "create"
                  ? "bg-emerald-50 text-emerald-700 shadow-inner"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
              title="作成モード (N)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              作成
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => onModeChange("network")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                editorMode === "network"
                  ? "bg-indigo-50 text-indigo-700 shadow-inner"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
              title="接続モード (L)"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <circle cx="3" cy="7" r="2" />
                <circle cx="11" cy="7" r="2" />
                <line x1="5" y1="7" x2="9" y2="7" />
              </svg>
              接続
            </button>
            <div className="w-px h-5 bg-slate-200" />
            <button
              onClick={() => onModeChange("carbonCopy")}
              className={`flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium transition-all duration-150 ${
                editorMode === "carbonCopy"
                  ? "bg-emerald-50 text-emerald-700 shadow-inner"
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
              title="カーボンコピーモード (C)"
            >
              <svg className="h-3.5 w-3.5" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
                <rect x="1" y="1" width="8" height="8" rx="1" />
                <rect x="5" y="5" width="8" height="8" rx="1" />
              </svg>
              コピー
            </button>
          </div>

          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-800">
              クラスター一覧
            </span>
            <span className="text-xs text-slate-400">
              {clusters.length} 件
            </span>
          </div>
          {/* Mini type badges */}
          <div className="hidden sm:flex items-center gap-1.5 ml-2">
            {Array.from(typeCounts.entries())
              .sort((a, b) => b[1] - a[1])
              .slice(0, 4)
              .map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-0.5 text-[10px] font-medium text-slate-500 ring-1 ring-slate-200/60"
                >
                  {TYPE_LABELS[type] ?? type}
                  <span className="font-semibold text-slate-700">{count}</span>
                </span>
              ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Select All / Deselect All */}
          <button
            onClick={onSelectAll}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors ring-1 ring-slate-200/60"
          >
            全選択
          </button>
          <button
            onClick={onDeselectAll}
            className="rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors ring-1 ring-slate-200/60"
          >
            選択解除
          </button>

          {/* Bulk delete */}
          <button
            onClick={onBulkDelete}
            disabled={selectedIds.size === 0}
            className={`rounded-lg px-2.5 py-1.5 text-[11px] font-semibold transition-colors ring-1 ${
              selectedIds.size > 0
                ? "bg-red-50 text-red-600 ring-red-200/60 hover:bg-red-100"
                : "bg-slate-50 text-slate-300 ring-slate-200/40 cursor-not-allowed"
            }`}
          >
            <span className="flex items-center gap-1">
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              削除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </span>
          </button>

          {/* Nudge buttons */}
          <div className="flex items-center gap-0.5 ml-1" title="選択中のクラスターを移動 (矢印キーでも操作可)">
            <button
              onClick={() => onNudge(-1, 0)}
              disabled={selectedIds.size === 0}
              className="rounded-lg p-1.5 text-slate-500 cursor-pointer hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
              title="左に移動 (←)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="flex flex-col gap-0">
              <button
                onClick={() => onNudge(0, -1)}
                disabled={selectedIds.size === 0}
                className="rounded-lg p-0.5 text-slate-500 cursor-pointer hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
                title="上に移動 (↑)"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                </svg>
              </button>
              <button
                onClick={() => onNudge(0, 1)}
                disabled={selectedIds.size === 0}
                className="rounded-lg p-0.5 text-slate-500 cursor-pointer hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
                title="下に移動 (↓)"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>
            <button
              onClick={() => onNudge(1, 0)}
              disabled={selectedIds.size === 0}
              className="rounded-lg p-1.5 text-slate-500 cursor-pointer hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-slate-500 transition-colors"
              title="右に移動 (→)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Undo / Redo (placeholder) */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              disabled
              className="rounded-lg p-1.5 text-slate-300 cursor-not-allowed"
              title="元に戻す (準備中)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 015 5v2M3 10l4-4M3 10l4 4" />
              </svg>
            </button>
            <button
              disabled
              className="rounded-lg p-1.5 text-slate-300 cursor-not-allowed"
              title="やり直す (準備中)"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 00-5 5v2m16-7l-4-4m4 4l-4 4" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom row: filters */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <svg className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="名前で検索..."
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        {/* Filter by type */}
        <select
          value={filterType}
          onChange={(e) => onFilterTypeChange(e.target.value as ClusterTypeName | "all")}
          className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        >
          <option value="all">全タイプ</option>
          {(() => {
            const grouped = new Map<ClusterCategory, ClusterTypeEntry[]>();
            for (const entry of CLUSTER_TYPE_REGISTRY) {
              if (!grouped.has(entry.category)) grouped.set(entry.category, []);
              grouped.get(entry.category)!.push(entry);
            }
            return Array.from(grouped.entries()).map(([cat, entries]) => (
              <optgroup key={cat} label={CATEGORY_LABELS_JA[cat]}>
                {entries.map((e) => (
                  <option key={e.name} value={e.name}>
                    {e.displayNameJa} {typeCounts.get(e.name) ? `(${typeCounts.get(e.name)})` : ""}
                  </option>
                ))}
              </optgroup>
            ));
          })()}
        </select>

        {/* Filter by confidence */}
        <select
          value={filterConfidence}
          onChange={(e) => onFilterConfidenceChange(e.target.value as "all" | "high" | "medium" | "low")}
          className="rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        >
          <option value="all">全信頼度</option>
          <option value="high">高信頼 (90%+)</option>
          <option value="medium">要確認 (70-89%)</option>
          <option value="low">低信頼 (&lt;70%)</option>
        </select>
      </div>
    </div>
  );
}
