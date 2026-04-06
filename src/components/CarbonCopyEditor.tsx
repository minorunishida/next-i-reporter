"use client";

import { useState } from "react";
import type { ClusterDefinition, CarbonCopyTarget, SheetStructure } from "@/lib/form-structure";

type Props = {
  clusters: ClusterDefinition[];
  sheets: SheetStructure[];
  onChange: (clusters: ClusterDefinition[]) => void;
};

function clusterLabel(cluster: ClusterDefinition, sheets: SheetStructure[]): string {
  const sheet = sheets.find((s) => s.index === cluster.sheetNo);
  const sheetName = sheet?.name ?? `シート${cluster.sheetNo + 1}`;
  return `[${sheetName}] ${cluster.name} (${cluster.cellAddress})`;
}

export function CarbonCopyEditor({ clusters, sheets, onChange }: Props) {
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);

  const sourceClusters = clusters.filter(
    (c) => c.carbonCopy && c.carbonCopy.length > 0,
  );

  const selectedSource = clusters.find((c) => c.id === selectedSourceId) ?? null;

  function updateClusterCarbonCopy(clusterId: string, newTargets: CarbonCopyTarget[] | undefined) {
    onChange(
      clusters.map((c) =>
        c.id === clusterId
          ? { ...c, carbonCopy: newTargets && newTargets.length > 0 ? newTargets : undefined }
          : c,
      ),
    );
  }

  function addSource() {
    const firstWithout = clusters.find((c) => !c.carbonCopy || c.carbonCopy.length === 0);
    if (!firstWithout) return;
    const firstOther = clusters.find((c) => c.id !== firstWithout.id);
    if (!firstOther) return;
    const newTargets: CarbonCopyTarget[] = [{ targetClusterId: firstOther.id, edit: 0 }];
    onChange(
      clusters.map((c) =>
        c.id === firstWithout.id ? { ...c, carbonCopy: newTargets } : c,
      ),
    );
    setSelectedSourceId(firstWithout.id);
  }

  function deleteSource(clusterId: string) {
    updateClusterCarbonCopy(clusterId, undefined);
    if (selectedSourceId === clusterId) setSelectedSourceId(null);
  }

  function addTarget(sourceId: string) {
    const source = clusters.find((c) => c.id === sourceId);
    if (!source) return;
    const firstAvailable = clusters.find((c) => c.id !== sourceId);
    if (!firstAvailable) return;
    const current = source.carbonCopy ?? [];
    updateClusterCarbonCopy(sourceId, [
      ...current,
      { targetClusterId: firstAvailable.id, edit: 0 },
    ]);
  }

  function updateTarget(
    sourceId: string,
    index: number,
    patch: Partial<CarbonCopyTarget>,
  ) {
    const source = clusters.find((c) => c.id === sourceId);
    if (!source || !source.carbonCopy) return;
    const newTargets = source.carbonCopy.map((t, i) =>
      i === index ? { ...t, ...patch } : t,
    );
    updateClusterCarbonCopy(sourceId, newTargets);
  }

  function deleteTarget(sourceId: string, index: number) {
    const source = clusters.find((c) => c.id === sourceId);
    if (!source || !source.carbonCopy) return;
    const newTargets = source.carbonCopy.filter((_, i) => i !== index);
    updateClusterCarbonCopy(sourceId, newTargets.length > 0 ? newTargets : undefined);
    if (newTargets.length === 0 && selectedSourceId === sourceId) {
      setSelectedSourceId(null);
    }
  }

  const canAddSource =
    clusters.length >= 2 &&
    clusters.some((c) => !c.carbonCopy || c.carbonCopy.length === 0);

  return (
    <div className="flex h-full gap-0 border border-gray-200 rounded-lg overflow-hidden">
      {/* 左ペイン: コピー元一覧 */}
      <div className="w-64 shrink-0 border-r border-gray-200 flex flex-col">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 bg-gray-50">
          <span className="text-sm font-medium text-gray-700">
            コピー元 ({sourceClusters.length})
          </span>
          <button
            onClick={addSource}
            disabled={!canAddSource}
            className="text-xs px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40"
          >
            + 追加
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sourceClusters.length === 0 && (
            <p className="text-xs text-gray-400 text-center mt-8 px-4">
              コピー元がありません。「+ 追加」で作成できます。
            </p>
          )}
          {sourceClusters.map((cluster) => {
            const isSelected = cluster.id === selectedSourceId;
            const count = cluster.carbonCopy?.length ?? 0;
            return (
              <div
                key={cluster.id}
                onClick={() => setSelectedSourceId(cluster.id)}
                className={`flex items-center gap-1 px-3 py-2 cursor-pointer border-b border-gray-100 group hover:bg-emerald-50 ${
                  isSelected ? "bg-emerald-100 border-l-2 border-l-emerald-500" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-gray-800 truncate">
                    {cluster.name}
                  </div>
                  <div className="text-xs text-emerald-600">
                    → {count}件
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteSource(cluster.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 text-xs px-1 shrink-0"
                  title="全削除"
                >
                  ✕
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* 右ペイン: コピー先リスト */}
      <div className="flex-1 overflow-y-auto p-4">
        {!selectedSource ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm">
            左のリストからコピー元を選択してください
          </div>
        ) : (
          <div className="space-y-4 max-w-lg">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">
              コピー元: {selectedSource.name}
            </h3>

            <div className="space-y-2">
              {(selectedSource.carbonCopy ?? []).map((target, index) => {
                const availableTargets = clusters.filter(
                  (c) => c.id !== selectedSource.id,
                );
                return (
                  <div
                    key={index}
                    className="flex items-center gap-2 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5"
                  >
                    {/* コピー先クラスタードロップダウン */}
                    <select
                      className="flex-1 text-sm border border-gray-300 rounded px-2 py-1 min-w-0"
                      value={target.targetClusterId}
                      onChange={(e) =>
                        updateTarget(selectedSource.id, index, {
                          targetClusterId: e.target.value,
                        })
                      }
                    >
                      {availableTargets.map((c) => (
                        <option key={c.id} value={c.id}>
                          {clusterLabel(c, sheets)}
                        </option>
                      ))}
                    </select>

                    {/* 編集トグル */}
                    <select
                      className="text-sm border border-gray-300 rounded px-2 py-1 shrink-0"
                      value={target.edit}
                      onChange={(e) =>
                        updateTarget(selectedSource.id, index, {
                          edit: Number(e.target.value) as 0 | 1,
                        })
                      }
                    >
                      <option value={0}>ロック (0)</option>
                      <option value={1}>編集可 (1)</option>
                    </select>

                    {/* 削除ボタン */}
                    <button
                      onClick={() => deleteTarget(selectedSource.id, index)}
                      className="text-red-400 hover:text-red-600 text-xs px-1 shrink-0"
                      title="削除"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              onClick={() => addTarget(selectedSource.id)}
              disabled={clusters.length < 2}
              className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40"
            >
              + コピー先を追加
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
