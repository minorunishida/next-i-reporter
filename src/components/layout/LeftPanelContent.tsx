"use client";

import { useMemo } from "react";
import type {
  ClusterDefinition,
  ClusterTypeName,
  FormStructure,
  NetworkDefinition,
  CarbonCopyTarget,
} from "@/lib/form-structure";
import {
  TYPE_LABELS_JA,
  CLUSTER_TYPE_REGISTRY,
  CATEGORY_LABELS_JA,
  type ClusterCategory,
  type ClusterTypeEntry,
} from "@/lib/cluster-type-registry";
import {
  useEditorState,
  useEditorDispatch,
  type ActiveTab,
  type EditorMode,
  type ConfidenceFilter,
} from "@/context/EditorContext";

type Props = {
  clusters: ClusterDefinition[];
  formStructure: FormStructure;
  networks: NetworkDefinition[];
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onBulkDelete: () => void;
  onNudge: (dx: number, dy: number) => void;
};

const TYPE_LABELS = TYPE_LABELS_JA;

export function LeftPanelContent({
  clusters,
  formStructure,
  networks,
  onSelectAll,
  onDeselectAll,
  onBulkDelete,
  onNudge,
}: Props) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();

  const {
    activeTab,
    activeSheet,
    selectedIds,
    editorMode,
    filterType,
    filterConfidence,
    searchQuery,
    showNetworkLines,
    showCarbonCopyLines,
    selectedNetworkId,
    selectedSourceId,
  } = state;

  const sheetClusters = useMemo(
    () => clusters.filter((c) => c.sheetNo === activeSheet),
    [clusters, activeSheet],
  );

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const c of sheetClusters) {
      counts.set(c.typeName, (counts.get(c.typeName) ?? 0) + 1);
    }
    return counts;
  }, [sheetClusters]);

  const sourceClusters = useMemo(
    () => clusters.filter((c) => c.carbonCopy && c.carbonCopy.length > 0),
    [clusters],
  );

  return (
    <div className="flex flex-col gap-0 h-full">
      {/* Mode toggle */}
      <div className="px-3 py-2 border-b border-slate-100">
        <div className="flex items-center rounded-lg ring-1 ring-slate-200/60 overflow-hidden">
          {(
            [
              { mode: "select" as EditorMode, label: "選択", key: "V", color: "blue" },
              { mode: "create" as EditorMode, label: "作成", key: "N", color: "emerald" },
              { mode: "network" as EditorMode, label: "接続", key: "L", color: "indigo" },
              { mode: "carbonCopy" as EditorMode, label: "コピー", key: "C", color: "emerald" },
            ] as const
          ).map((item, i) => (
            <button
              key={item.mode}
              onClick={() =>
                dispatch({ type: "SET_EDITOR_MODE", mode: item.mode })
              }
              className={`flex-1 py-1.5 text-[10px] font-medium transition-all duration-150 ${
                i > 0 ? "border-l border-slate-200/60" : ""
              } ${
                editorMode === item.mode
                  ? `bg-${item.color}-50 text-${item.color}-700 shadow-inner`
                  : "text-slate-500 hover:bg-slate-50 hover:text-slate-700"
              }`}
              title={`${item.label}モード (${item.key})`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* Filters & search (clusters tab) */}
      {activeTab === "clusters" && (
        <div className="px-3 py-2 border-b border-slate-100 flex flex-col gap-2">
          {/* Search */}
          <div className="relative">
            <svg
              className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) =>
                dispatch({ type: "SET_SEARCH_QUERY", query: e.target.value })
              }
              placeholder="名前で検索..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/50 py-1.5 pl-8 pr-3 text-xs text-slate-700 placeholder:text-slate-400 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
            />
          </div>

          {/* Type filter */}
          <select
            value={filterType}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER_TYPE",
                filterType: e.target.value as ClusterTypeName | "all",
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          >
            <option value="all">全タイプ</option>
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
                      {e.displayNameJa}{" "}
                      {typeCounts.get(e.name)
                        ? `(${typeCounts.get(e.name)})`
                        : ""}
                    </option>
                  ))}
                </optgroup>
              ));
            })()}
          </select>

          {/* Confidence filter */}
          <select
            value={filterConfidence}
            onChange={(e) =>
              dispatch({
                type: "SET_FILTER_CONFIDENCE",
                level: e.target.value as ConfidenceFilter,
              })
            }
            className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-2.5 py-1.5 text-xs text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
          >
            <option value="all">全信頼度</option>
            <option value="high">高信頼 (90%+)</option>
            <option value="medium">要確認 (70-89%)</option>
            <option value="low">低信頼 (&lt;70%)</option>
          </select>

          {/* Bulk actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={onSelectAll}
              className="rounded px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200/60"
            >
              全選択
            </button>
            <button
              onClick={onDeselectAll}
              className="rounded px-2 py-1 text-[10px] font-medium text-slate-500 hover:bg-slate-100 ring-1 ring-slate-200/60"
            >
              解除
            </button>
            <button
              onClick={onBulkDelete}
              disabled={selectedIds.size === 0}
              className={`rounded px-2 py-1 text-[10px] font-semibold ring-1 ${
                selectedIds.size > 0
                  ? "bg-red-50 text-red-600 ring-red-200/60 hover:bg-red-100"
                  : "bg-slate-50 text-slate-300 ring-slate-200/40 cursor-not-allowed"
              }`}
            >
              削除{selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}
            </button>
            {/* Nudge */}
            <div className="flex items-center gap-0 ml-auto">
              <button
                onClick={() => onNudge(-1, 0)}
                disabled={selectedIds.size === 0}
                className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title="← 左"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="flex flex-col">
                <button
                  onClick={() => onNudge(0, -1)}
                  disabled={selectedIds.size === 0}
                  className="rounded p-0.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="↑ 上"
                >
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                  </svg>
                </button>
                <button
                  onClick={() => onNudge(0, 1)}
                  disabled={selectedIds.size === 0}
                  className="rounded p-0.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="↓ 下"
                >
                  <svg className="h-2.5 w-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
              </div>
              <button
                onClick={() => onNudge(1, 0)}
                disabled={selectedIds.size === 0}
                className="rounded p-1 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed"
                title="→ 右"
              >
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Connection line toggles */}
      {((networks.length > 0) ||
        clusters.some((c) => c.carbonCopy?.length)) && (
        <div className="px-3 py-2 border-b border-slate-100 flex flex-col gap-1.5">
          {networks.length > 0 && (
            <button
              onClick={() => dispatch({ type: "TOGGLE_NETWORK_LINES" })}
              className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border transition-colors w-full ${
                showNetworkLines
                  ? "bg-indigo-50 border-indigo-300 text-indigo-700"
                  : "bg-white border-gray-300 text-gray-500"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <circle cx="3" cy="7" r="2" fill={showNetworkLines ? "#6366f1" : "#9ca3af"} />
                <circle cx="11" cy="7" r="2" fill={showNetworkLines ? "#6366f1" : "#9ca3af"} />
                <line x1="5" y1="7" x2="9" y2="7" stroke={showNetworkLines ? "#6366f1" : "#9ca3af"} strokeWidth="1.5" />
              </svg>
              接続線 {showNetworkLines ? "表示中" : "非表示"} ({networks.length})
            </button>
          )}
          {clusters.some((c) => c.carbonCopy?.length) && (
            <button
              onClick={() => dispatch({ type: "TOGGLE_CARBON_COPY_LINES" })}
              className={`flex items-center gap-1.5 text-[10px] px-2 py-1 rounded border transition-colors w-full ${
                showCarbonCopyLines
                  ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                  : "bg-white border-gray-300 text-gray-500"
              }`}
            >
              <svg width="12" height="12" viewBox="0 0 14 14" fill="none" className="shrink-0">
                <rect x="1" y="1" width="7" height="7" rx="1" stroke={showCarbonCopyLines ? "#10b981" : "#9ca3af"} strokeWidth="1.5" />
                <rect x="6" y="6" width="7" height="7" rx="1" stroke={showCarbonCopyLines ? "#10b981" : "#9ca3af"} strokeWidth="1.5" />
              </svg>
              コピー線 {showCarbonCopyLines ? "表示中" : "非表示"} (
              {clusters.reduce((n, c) => n + (c.carbonCopy?.length ?? 0), 0)})
            </button>
          )}
        </div>
      )}

      {/* Sheet tabs */}
      {formStructure.sheets.length > 1 && (
        <div className="px-3 py-2 border-b border-slate-100">
          <div className="flex gap-1 flex-wrap">
            {formStructure.sheets.map((s, i) => {
              const count = clusters.filter((c) => c.sheetNo === i).length;
              return (
                <button
                  key={s.name}
                  onClick={() => dispatch({ type: "SET_ACTIVE_SHEET", sheet: i })}
                  className={`rounded-lg px-2.5 py-1 text-[10px] font-medium transition-all ${
                    i === activeSheet
                      ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60"
                      : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {s.name}
                  <span
                    className={`ml-1 inline-flex items-center justify-center rounded-full px-1 text-[8px] font-semibold ${
                      i === activeSheet
                        ? "bg-blue-100 text-blue-700"
                        : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Cluster list (clusters tab) */}
      {activeTab === "clusters" && (
        <div className="flex-1 overflow-auto">
          <div className="px-3 py-1.5">
            <span className="text-[10px] font-semibold text-slate-400">
              クラスター ({sheetClusters.length})
            </span>
          </div>
          {sheetClusters.map((c) => {
            const isSelected = selectedIds.has(c.id);
            return (
              <button
                key={c.id}
                onClick={() =>
                  dispatch({ type: "SELECT_CLUSTER", id: c.id, multi: false })
                }
                className={`w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs border-b border-slate-50 transition-colors ${
                  isSelected
                    ? "bg-blue-50 text-blue-700"
                    : "text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span className="truncate flex-1">{c.name}</span>
                <span className="text-[9px] text-slate-400 shrink-0">
                  {TYPE_LABELS[c.typeName] ?? c.typeName}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Network list (networks tab) */}
      {activeTab === "networks" && (
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] font-semibold text-slate-400">
              接続 ({networks.length})
            </span>
          </div>
          {networks.length === 0 && (
            <p className="text-[10px] text-gray-400 text-center mt-6 px-4">
              接続がありません
            </p>
          )}
          {networks.map((net) => {
            const prev = clusters.find((c) => c.id === net.prevClusterId);
            const next = clusters.find((c) => c.id === net.nextClusterId);
            const isSelected = net.id === selectedNetworkId;
            return (
              <button
                key={net.id}
                onClick={() =>
                  dispatch({ type: "SET_SELECTED_NETWORK_ID", id: net.id })
                }
                className={`w-full flex flex-col gap-0.5 px-3 py-2 text-left border-b border-slate-50 transition-colors ${
                  isSelected
                    ? "bg-indigo-50 border-l-2 border-l-indigo-500"
                    : "hover:bg-indigo-50/50"
                }`}
              >
                <span className="text-xs text-gray-800 truncate">
                  {prev?.name ?? "?"}
                </span>
                <span className="text-[10px] text-indigo-500 flex items-center gap-0.5">
                  <span>↓</span>
                  <span className="truncate text-gray-600">
                    {next?.name ?? "?"}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      )}

      {/* Carbon copy source list (carbonCopy tab) */}
      {activeTab === "carbonCopy" && (
        <div className="flex-1 overflow-auto">
          <div className="flex items-center justify-between px-3 py-1.5">
            <span className="text-[10px] font-semibold text-slate-400">
              コピー元 ({sourceClusters.length})
            </span>
          </div>
          {sourceClusters.length === 0 && (
            <p className="text-[10px] text-gray-400 text-center mt-6 px-4">
              コピー元がありません
            </p>
          )}
          {sourceClusters.map((cluster) => {
            const isSelected = cluster.id === selectedSourceId;
            const count = cluster.carbonCopy?.length ?? 0;
            return (
              <button
                key={cluster.id}
                onClick={() =>
                  dispatch({
                    type: "SET_SELECTED_SOURCE_ID",
                    id: cluster.id,
                  })
                }
                className={`w-full flex items-center gap-2 px-3 py-2 text-left border-b border-slate-50 transition-colors ${
                  isSelected
                    ? "bg-emerald-50 border-l-2 border-l-emerald-500"
                    : "hover:bg-emerald-50/50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-800 truncate">
                    {cluster.name}
                  </div>
                  <div className="text-[10px] text-emerald-600">→ {count}件</div>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
