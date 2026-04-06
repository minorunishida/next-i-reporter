"use client";

import { useState, useMemo } from "react";
import type { ClusterDefinition, NetworkDefinition, SheetStructure } from "@/lib/form-structure";
import { getItemsFromCluster, createNetwork } from "@/lib/network-utils";
import { ValueLinkEditor } from "./ValueLinkEditor";

type Props = {
  networks: NetworkDefinition[];
  clusters: ClusterDefinition[];
  sheets: SheetStructure[];
  onChange: (networks: NetworkDefinition[]) => void;
  onSelectNetwork?: (id: string | null) => void;
};

const RELATION_OPTIONS: NetworkDefinition["relation"][] = [
  "", "Equal", "NotEqual", "GreaterEqual", "Greater", "LessEqual", "Less",
];
const RELATION_LABELS: Record<string, string> = {
  "": "（指定なし）",
  Equal: "等しい",
  NotEqual: "等しくない",
  GreaterEqual: "以上",
  Greater: "より大きい",
  LessEqual: "以下",
  Less: "より小さい",
};

function defaultNetwork(clusters: ClusterDefinition[]): NetworkDefinition {
  return createNetwork(
    clusters[0]?.id ?? "",
    clusters[1]?.id ?? clusters[0]?.id ?? "",
  );
}

function clusterLabel(cluster: ClusterDefinition, sheets: SheetStructure[]): string {
  const sheet = sheets.find((s) => s.index === cluster.sheetNo);
  const sheetName = sheet?.name ?? `シート${cluster.sheetNo + 1}`;
  return `[${sheetName}] ${cluster.name} (${cluster.cellAddress})`;
}

export function NetworkEditor({ networks, clusters, sheets, onChange, onSelectNetwork }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  function selectNetwork(id: string | null) {
    setSelectedId(id);
    onSelectNetwork?.(id);
  }

  const selected = networks.find((n) => n.id === selectedId) ?? null;

  function addNetwork() {
    const net = defaultNetwork(clusters);
    onChange([...networks, net]);
    selectNetwork(net.id);
  }

  function removeNetwork(id: string) {
    onChange(networks.filter((n) => n.id !== id));
    if (selectedId === id) selectNetwork(null);
  }

  function updateNetwork(patch: Partial<NetworkDefinition>) {
    onChange(
      networks.map((n) => (n.id === selectedId ? { ...n, ...patch } : n)),
    );
  }

  const prevCluster = useMemo(
    () => clusters.find((c) => c.id === selected?.prevClusterId),
    [clusters, selected?.prevClusterId],
  );
  const nextCluster = useMemo(
    () => clusters.find((c) => c.id === selected?.nextClusterId),
    [clusters, selected?.nextClusterId],
  );
  const parentItems = useMemo(
    () => (prevCluster ? getItemsFromCluster(prevCluster) : []),
    [prevCluster],
  );
  const childItems = useMemo(
    () => (nextCluster ? getItemsFromCluster(nextCluster) : []),
    [nextCluster],
  );

  return (
    <div className="flex h-full gap-0 border border-gray-200 rounded-lg overflow-hidden">
      {/* 左ペイン: ネットワーク一覧 */}
      <div className="w-64 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
          <span className="text-sm font-medium text-gray-700">
            接続 ({networks.length})
          </span>
          <button
            onClick={addNetwork}
            disabled={clusters.length < 2}
            className="text-xs px-2 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40"
          >
            + 追加
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {networks.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">
              接続がありません。「+ 追加」で作成できます。
            </p>
          )}
          {networks.map((net) => {
            const prev = clusters.find((c) => c.id === net.prevClusterId);
            const next = clusters.find((c) => c.id === net.nextClusterId);
            const isSelected = net.id === selectedId;
            return (
              <div
                key={net.id}
                onClick={() => selectNetwork(net.id)}
                className={`flex items-center gap-1 px-3 py-2 cursor-pointer border-b border-gray-100 group hover:bg-indigo-50 ${
                  isSelected ? "bg-indigo-100 border-l-2 border-l-indigo-500" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-800 truncate">
                    {prev?.name ?? "?"}
                  </div>
                  <div className="text-xs text-indigo-500 flex items-center gap-0.5">
                    <span>↓</span>
                    <span className="truncate text-gray-600">{next?.name ?? "?"}</span>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); removeNetwork(net.id); }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-1 shrink-0"
                  title="削除"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右ペイン: 詳細編集 */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            左のリストから接続を選択してください
          </div>
        ) : (
          <div className="space-y-5 max-w-lg">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">接続の設定</h3>

            {/* 親クラスター */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">親クラスター</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full"
                value={selected.prevClusterId}
                onChange={(e) => updateNetwork({ prevClusterId: e.target.value })}
              >
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>{clusterLabel(c, sheets)}</option>
                ))}
              </select>
            </div>

            {/* 子クラスター */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">子クラスター</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5 w-full"
                value={selected.nextClusterId}
                onChange={(e) => updateNetwork({ nextClusterId: e.target.value })}
              >
                {clusters.map((c) => (
                  <option key={c.id} value={c.id}>{clusterLabel(c, sheets)}</option>
                ))}
              </select>
            </div>

            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 pt-1">動作設定</h3>

            {/* 自動入力開始 */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">自動移動</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.nextAutoInputStart}
                onChange={(e) => updateNetwork({ nextAutoInputStart: Number(e.target.value) as 0 | 1 })}
              >
                <option value={1}>する</option>
                <option value={0}>しない</option>
              </select>
            </div>

            {/* 条件 */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">条件</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.relation}
                onChange={(e) => updateNetwork({ relation: e.target.value as NetworkDefinition["relation"] })}
              >
                {RELATION_OPTIONS.map((r) => (
                  <option key={r} value={r}>{RELATION_LABELS[r]}</option>
                ))}
              </select>
            </div>

            {/* スキップ */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">スキップ</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.skip}
                onChange={(e) => updateNetwork({ skip: Number(e.target.value) as 0 | 1 | 2 })}
              >
                <option value={0}>しない</option>
                <option value={1}>する</option>
                <option value={2}>条件付き</option>
              </select>
            </div>

            {/* 記入不要 */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">記入不要</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.noNeedToFillOut}
                onChange={(e) => updateNetwork({ noNeedToFillOut: Number(e.target.value) as 0 | 1 | 2 })}
              >
                <option value={0}>行わない</option>
                <option value={1}>先行入力時に後続を記入不要</option>
                <option value={2}>どちらか入力時に残りを記入不要</option>
              </select>
            </div>

            {/* 端末種別 */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">端末種別</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.terminalType}
                onChange={(e) => {
                  const v = e.target.value;
                  updateNetwork({ terminalType: v === "" ? "" : (Number(v) as 0 | 1) });
                }}
              >
                <option value="">未指定</option>
                <option value={0}>iOS</option>
                <option value={1}>Windows</option>
              </select>
            </div>

            {/* 自動入力 */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">自動入力</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.nextAutoInput}
                onChange={(e) => updateNetwork({ nextAutoInput: Number(e.target.value) as 0 | 1 })}
              >
                <option value={0}>しない</option>
                <option value={1}>する</option>
              </select>
            </div>

            {/* 自動入力後編集 */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">自動入力後編集</label>
              <select
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.nextAutoInputEdit}
                onChange={(e) => updateNetwork({ nextAutoInputEdit: Number(e.target.value) as 0 | 1 })}
              >
                <option value={0}>不可</option>
                <option value={1}>可</option>
              </select>
            </div>

            {/* 必須値 */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">必須値</label>
              <input
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.requiredValue}
                onChange={(e) => updateNetwork({ requiredValue: e.target.value })}
                placeholder="（空白可）"
              />
            </div>

            {/* カスタムマスター */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">カスタムマスター検索フィールド</label>
              <input
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.customMasterSearchField}
                onChange={(e) => updateNetwork({ customMasterSearchField: e.target.value })}
                placeholder="（空白可）"
              />
            </div>

            {/* checkGroupIdMode */}
            <div className="grid grid-cols-[7rem_1fr] items-center gap-2">
              <label className="text-sm text-gray-600">グループIDチェック</label>
              <input
                className="text-sm border border-gray-300 rounded px-2 py-1.5"
                value={selected.checkGroupIdMode}
                onChange={(e) => updateNetwork({ checkGroupIdMode: e.target.value })}
                placeholder="（空白可）"
              />
            </div>

            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2 pt-1">値連動</h3>
            <ValueLinkEditor
              valueLinks={selected.valueLinks}
              parentItems={parentItems}
              childItems={childItems}
              onChange={(valueLinks) => updateNetwork({ valueLinks })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
