"use client";

import type { ClusterDefinition, ClusterTypeName } from "@/lib/form-structure";

type Props = {
  clusters: ClusterDefinition[];
  selectedIds: Set<string>;
  filterType: ClusterTypeName | "all";
  filterConfidence: "all" | "high" | "medium" | "low";
  searchQuery: string;
  onFilterTypeChange: (type: ClusterTypeName | "all") => void;
  onFilterConfidenceChange: (level: "all" | "high" | "medium" | "low") => void;
  onSearchChange: (query: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
};

const TYPE_LABELS: Record<ClusterTypeName, string> = {
  FixedText: "固定テキスト",
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

export default function ClusterToolbar({
  clusters,
  selectedIds,
  filterType,
  filterConfidence,
  searchQuery,
  onFilterTypeChange,
  onFilterConfidenceChange,
  onSearchChange,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
}: Props) {
  // Type counts
  const typeCounts = new Map<string, number>();
  for (const c of clusters) {
    typeCounts.set(c.typeName, (typeCounts.get(c.typeName) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200/60">
      {/* Top row: summary + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 ring-1 ring-blue-100">
            <svg className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-sm font-semibold text-slate-800">
              クラスタ一覧
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
                  {TYPE_LABELS[type as ClusterTypeName] ?? type}
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
          {(Object.keys(TYPE_LABELS) as ClusterTypeName[]).map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]} {typeCounts.get(t) ? `(${typeCounts.get(t)})` : ""}
            </option>
          ))}
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
