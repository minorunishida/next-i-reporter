"use client";

import { useMemo } from "react";
import type {
  ClusterDefinition,
  NetworkDefinition,
  SheetStructure,
  CarbonCopyTarget,
} from "@/lib/form-structure";
import { getItemsFromCluster, createNetwork } from "@/lib/network-utils";
import { ValueLinkEditor } from "@/components/ValueLinkEditor";
import { PropertyPanel, EmptyPropertyPanel } from "@/components/PropertyPanel";
import { useEditorState, useEditorDispatch } from "@/context/EditorContext";

// ─── Network detail (relation labels) ───────────────────────────────────────

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

function clusterLabel(cluster: ClusterDefinition, sheets: SheetStructure[]): string {
  const sheet = sheets.find((s) => s.index === cluster.sheetNo);
  const sheetName = sheet?.name ?? `シート${cluster.sheetNo + 1}`;
  return `[${sheetName}] ${cluster.name} (${cluster.cellAddress})`;
}

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  clusters: ClusterDefinition[];
  networks: NetworkDefinition[];
  sheets: SheetStructure[];
  onUpdateCluster: (id: string, patch: Partial<ClusterDefinition>) => void;
  onDeleteCluster: (id: string) => void;
  onNetworksChange: (networks: NetworkDefinition[]) => void;
  onCarbonCopyChange: (clusters: ClusterDefinition[]) => void;
};

export function RightPanelContent({
  clusters,
  networks,
  sheets,
  onUpdateCluster,
  onDeleteCluster,
  onNetworksChange,
  onCarbonCopyChange,
}: Props) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const { activeTab, selectedId, selectedIds, selectedNetworkId, selectedSourceId } = state;

  // ── Cluster tab ──
  const selectedCluster = useMemo(
    () => clusters.find((c) => c.id === selectedId) ?? null,
    [clusters, selectedId],
  );

  // ── Network tab ──
  const selectedNetwork = useMemo(
    () => networks.find((n) => n.id === selectedNetworkId) ?? null,
    [networks, selectedNetworkId],
  );

  const prevCluster = useMemo(
    () => clusters.find((c) => c.id === selectedNetwork?.prevClusterId),
    [clusters, selectedNetwork?.prevClusterId],
  );
  const nextCluster = useMemo(
    () => clusters.find((c) => c.id === selectedNetwork?.nextClusterId),
    [clusters, selectedNetwork?.nextClusterId],
  );
  const parentItems = useMemo(
    () => (prevCluster ? getItemsFromCluster(prevCluster) : []),
    [prevCluster],
  );
  const childItems = useMemo(
    () => (nextCluster ? getItemsFromCluster(nextCluster) : []),
    [nextCluster],
  );

  function updateNetwork(patch: Partial<NetworkDefinition>) {
    onNetworksChange(
      networks.map((n) => (n.id === selectedNetworkId ? { ...n, ...patch } : n)),
    );
  }

  function removeNetwork(id: string) {
    onNetworksChange(networks.filter((n) => n.id !== id));
    if (selectedNetworkId === id) dispatch({ type: "SET_SELECTED_NETWORK_ID", id: null });
  }

  function addNetwork() {
    const net = createNetwork(
      clusters[0]?.id ?? "",
      clusters[1]?.id ?? clusters[0]?.id ?? "",
    );
    onNetworksChange([...networks, net]);
    dispatch({ type: "SET_SELECTED_NETWORK_ID", id: net.id });
  }

  // ── Carbon copy tab ──
  const selectedSource = useMemo(
    () => clusters.find((c) => c.id === selectedSourceId) ?? null,
    [clusters, selectedSourceId],
  );

  function updateClusterCarbonCopy(
    clusterId: string,
    newTargets: CarbonCopyTarget[] | undefined,
  ) {
    onCarbonCopyChange(
      clusters.map((c) =>
        c.id === clusterId
          ? {
              ...c,
              carbonCopy:
                newTargets && newTargets.length > 0 ? newTargets : undefined,
            }
          : c,
      ),
    );
  }

  function addSource() {
    const firstWithout = clusters.find(
      (c) => !c.carbonCopy || c.carbonCopy.length === 0,
    );
    if (!firstWithout) return;
    const firstOther = clusters.find((c) => c.id !== firstWithout.id);
    if (!firstOther) return;
    const newTargets: CarbonCopyTarget[] = [
      { targetClusterId: firstOther.id, edit: 0 },
    ];
    onCarbonCopyChange(
      clusters.map((c) =>
        c.id === firstWithout.id
          ? { ...c, carbonCopy: newTargets }
          : c,
      ),
    );
    dispatch({ type: "SET_SELECTED_SOURCE_ID", id: firstWithout.id });
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
    updateClusterCarbonCopy(
      sourceId,
      newTargets.length > 0 ? newTargets : undefined,
    );
    if (newTargets.length === 0 && selectedSourceId === sourceId) {
      dispatch({ type: "SET_SELECTED_SOURCE_ID", id: null });
    }
  }

  function deleteSource(clusterId: string) {
    updateClusterCarbonCopy(clusterId, undefined);
    if (selectedSourceId === clusterId)
      dispatch({ type: "SET_SELECTED_SOURCE_ID", id: null });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // Render by active tab
  // ═════════════════════════════════════════════════════════════════════════

  if (activeTab === "clusters") {
    return selectedCluster ? (
      <PropertyPanel
        cluster={selectedCluster}
        onUpdate={(patch) => onUpdateCluster(selectedCluster.id, patch)}
        onDelete={() => onDeleteCluster(selectedCluster.id)}
      />
    ) : (
      <EmptyPropertyPanel selectedCount={selectedIds.size} />
    );
  }

  if (activeTab === "networks") {
    if (!selectedNetwork) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4 py-12 text-center">
          <p className="text-xs text-gray-400">左のリストから接続を選択</p>
          <button
            onClick={addNetwork}
            disabled={clusters.length < 2}
            className="text-xs px-3 py-1.5 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-40"
          >
            + 接続を追加
          </button>
        </div>
      );
    }

    return (
      <div className="p-3 space-y-4 overflow-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700">接続の設定</h3>
          <button
            onClick={() => removeNetwork(selectedNetwork.id)}
            className="text-[10px] text-red-500 hover:text-red-700"
          >
            削除
          </button>
        </div>

        {/* 親クラスター */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">親クラスター</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.prevClusterId}
            onChange={(e) => updateNetwork({ prevClusterId: e.target.value })}
          >
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {clusterLabel(c, sheets)}
              </option>
            ))}
          </select>
        </div>

        {/* 子クラスター */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">子クラスター</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.nextClusterId}
            onChange={(e) => updateNetwork({ nextClusterId: e.target.value })}
          >
            {clusters.map((c) => (
              <option key={c.id} value={c.id}>
                {clusterLabel(c, sheets)}
              </option>
            ))}
          </select>
        </div>

        <h3 className="text-xs font-semibold text-gray-700 border-t pt-3">動作設定</h3>

        {/* 自動移動 */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">自動移動</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.nextAutoInputStart}
            onChange={(e) =>
              updateNetwork({
                nextAutoInputStart: Number(e.target.value) as 0 | 1,
              })
            }
          >
            <option value={1}>する</option>
            <option value={0}>しない</option>
          </select>
        </div>

        {/* 条件 */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">条件</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.relation}
            onChange={(e) =>
              updateNetwork({
                relation: e.target.value as NetworkDefinition["relation"],
              })
            }
          >
            {RELATION_OPTIONS.map((r) => (
              <option key={r} value={r}>
                {RELATION_LABELS[r]}
              </option>
            ))}
          </select>
        </div>

        {/* スキップ */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">スキップ</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.skip}
            onChange={(e) =>
              updateNetwork({ skip: Number(e.target.value) as 0 | 1 | 2 })
            }
          >
            <option value={0}>しない</option>
            <option value={1}>する</option>
            <option value={2}>条件付き</option>
          </select>
        </div>

        {/* 記入不要 */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">記入不要</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.noNeedToFillOut}
            onChange={(e) =>
              updateNetwork({
                noNeedToFillOut: Number(e.target.value) as 0 | 1 | 2,
              })
            }
          >
            <option value={0}>行わない</option>
            <option value={1}>先行入力時に後続を記入不要</option>
            <option value={2}>どちらか入力時に残りを記入不要</option>
          </select>
        </div>

        {/* 端末種別 */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">端末種別</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.terminalType}
            onChange={(e) => {
              const v = e.target.value;
              updateNetwork({
                terminalType: v === "" ? "" : (Number(v) as 0 | 1),
              });
            }}
          >
            <option value="">未指定</option>
            <option value={0}>iOS</option>
            <option value={1}>Windows</option>
          </select>
        </div>

        {/* 自動入力 */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">自動入力</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.nextAutoInput}
            onChange={(e) =>
              updateNetwork({
                nextAutoInput: Number(e.target.value) as 0 | 1,
              })
            }
          >
            <option value={0}>しない</option>
            <option value={1}>する</option>
          </select>
        </div>

        {/* 自動入力後編集 */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">自動入力後編集</label>
          <select
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.nextAutoInputEdit}
            onChange={(e) =>
              updateNetwork({
                nextAutoInputEdit: Number(e.target.value) as 0 | 1,
              })
            }
          >
            <option value={0}>不可</option>
            <option value={1}>可</option>
          </select>
        </div>

        {/* 必須値 */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">必須値</label>
          <input
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.requiredValue}
            onChange={(e) => updateNetwork({ requiredValue: e.target.value })}
            placeholder="（空白可）"
          />
        </div>

        {/* カスタムマスター */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">
            カスタムマスター検索フィールド
          </label>
          <input
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.customMasterSearchField}
            onChange={(e) =>
              updateNetwork({ customMasterSearchField: e.target.value })
            }
            placeholder="（空白可）"
          />
        </div>

        {/* checkGroupIdMode */}
        <div className="space-y-1">
          <label className="text-[10px] text-gray-500">
            グループIDチェック
          </label>
          <input
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
            value={selectedNetwork.checkGroupIdMode}
            onChange={(e) =>
              updateNetwork({ checkGroupIdMode: e.target.value })
            }
            placeholder="（空白可）"
          />
        </div>

        <h3 className="text-xs font-semibold text-gray-700 border-t pt-3">
          値連動
        </h3>
        <ValueLinkEditor
          valueLinks={selectedNetwork.valueLinks}
          parentItems={parentItems}
          childItems={childItems}
          onChange={(valueLinks) => updateNetwork({ valueLinks })}
        />
      </div>
    );
  }

  // Carbon copy tab
  if (activeTab === "carbonCopy") {
    if (!selectedSource) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3 px-4 py-12 text-center">
          <p className="text-xs text-gray-400">
            左のリストからコピー元を選択
          </p>
          <button
            onClick={addSource}
            disabled={
              clusters.length < 2 ||
              !clusters.some(
                (c) => !c.carbonCopy || c.carbonCopy.length === 0,
              )
            }
            className="text-xs px-3 py-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-40"
          >
            + コピー元を追加
          </button>
        </div>
      );
    }

    return (
      <div className="p-3 space-y-3 overflow-auto">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold text-gray-700">
            コピー元: {selectedSource.name}
          </h3>
          <button
            onClick={() => deleteSource(selectedSource.id)}
            className="text-[10px] text-red-500 hover:text-red-700"
          >
            削除
          </button>
        </div>

        <div className="space-y-2">
          {(selectedSource.carbonCopy ?? []).map((target, index) => {
            const availableTargets = clusters.filter(
              (c) => c.id !== selectedSource.id,
            );
            return (
              <div
                key={index}
                className="flex items-center gap-1.5 bg-emerald-50 border border-emerald-100 rounded px-2 py-1.5"
              >
                <select
                  className="flex-1 text-xs border border-gray-300 rounded px-1.5 py-1 min-w-0"
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
                <select
                  className="text-xs border border-gray-300 rounded px-1.5 py-1 shrink-0"
                  value={target.edit}
                  onChange={(e) =>
                    updateTarget(selectedSource.id, index, {
                      edit: Number(e.target.value) as 0 | 1,
                    })
                  }
                >
                  <option value={0}>ロック</option>
                  <option value={1}>編集可</option>
                </select>
                <button
                  onClick={() => deleteTarget(selectedSource.id, index)}
                  className="text-red-400 hover:text-red-600 text-xs px-0.5 shrink-0"
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
    );
  }

  return null;
}
