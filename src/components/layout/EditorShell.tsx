"use client";

import { useCallback, useEffect, type ReactNode } from "react";
import { SidePanel, type RailIcon } from "./SidePanel";
import { LeftPanelContent } from "./LeftPanelContent";
import { RightPanelContent } from "./RightPanelContent";
import {
  EditorProvider,
  useEditorState,
  useEditorDispatch,
  type ActiveTab,
} from "@/context/EditorContext";
import type {
  AnalysisResult,
  ClusterDefinition,
  FormStructure,
  NetworkDefinition,
} from "@/lib/form-structure";

// ─── Props ──────────────────────────────────────────────────────────────────

type Props = {
  analysisResult: AnalysisResult;
  formStructure: FormStructure;
  onClustersChange: (clusters: ClusterDefinition[]) => void;
  onNetworksChange: (networks: NetworkDefinition[]) => void;
  onCarbonCopyChange: (clusters: ClusterDefinition[]) => void;
  /** The center canvas (ClusterEditor) */
  children: ReactNode;
  /** Header strip (AI解析結果, navigation buttons, action buttons) */
  headerSlot?: ReactNode;
};

// ─── Rail icon SVGs ─────────────────────────────────────────────────────────

const LayersIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
  </svg>
);

const NetworkIcon = (
  <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <circle cx="3" cy="7" r="2" />
    <circle cx="11" cy="7" r="2" />
    <line x1="5" y1="7" x2="9" y2="7" />
  </svg>
);

const CopyIcon = (
  <svg className="h-4 w-4" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
    <rect x="1" y="1" width="8" height="8" rx="1" />
    <rect x="5" y="5" width="8" height="8" rx="1" />
  </svg>
);

const PropertiesIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
  </svg>
);

const LogsIcon = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
  </svg>
);

// ─── Inner component (needs context) ────────────────────────────────────────

function EditorShellInner({
  analysisResult,
  formStructure,
  onClustersChange,
  onNetworksChange,
  onCarbonCopyChange,
  children,
  headerSlot,
}: Props) {
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const { activeTab, leftPanelExpanded, rightPanelExpanded, selectedIds } = state;

  const clusters = analysisResult.clusters;
  const networks = analysisResult.formStructure.networks ?? [];

  // Keyboard shortcuts for panel toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "[" || (e.ctrlKey && e.key === "b")) {
        e.preventDefault();
        dispatch({ type: "TOGGLE_LEFT_PANEL" });
      } else if (e.key === "]" || (e.ctrlKey && e.shiftKey && e.key === "B")) {
        e.preventDefault();
        dispatch({ type: "TOGGLE_RIGHT_PANEL" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [dispatch]);

  // ── Left rail icons ──
  const leftRailIcons: RailIcon[] = [
    {
      id: "clusters",
      icon: LayersIcon,
      label: "クラスター",
      active: activeTab === "clusters",
      badge: clusters.filter((c) => c.sheetNo === state.activeSheet).length,
    },
    {
      id: "networks",
      icon: NetworkIcon,
      label: "ネットワーク",
      active: activeTab === "networks",
      badge: networks.length || undefined,
    },
    {
      id: "carbonCopy",
      icon: CopyIcon,
      label: "カーボンコピー",
      active: activeTab === "carbonCopy",
      badge: clusters.reduce((n, c) => n + (c.carbonCopy?.length ?? 0), 0) || undefined,
    },
    {
      id: "logs",
      icon: LogsIcon,
      label: "ログ",
      active: activeTab === "logs",
    },
  ];

  const handleLeftRailClick = useCallback(
    (id: string) => {
      dispatch({ type: "SET_ACTIVE_TAB", tab: id as ActiveTab });
      if (!leftPanelExpanded) {
        dispatch({ type: "SET_LEFT_PANEL", expanded: true });
      }
    },
    [dispatch, leftPanelExpanded],
  );

  // ── Right rail icons ──
  const rightRailIcons: RailIcon[] = [
    {
      id: "properties",
      icon: PropertiesIcon,
      label: "プロパティ",
      active: true,
    },
  ];

  const handleRightRailClick = useCallback(
    () => {
      if (!rightPanelExpanded) {
        dispatch({ type: "SET_RIGHT_PANEL", expanded: true });
      }
    },
    [dispatch, rightPanelExpanded],
  );

  // ── Handlers for left panel ──
  const filteredClusters = clusters; // Filtering happens inside LeftPanelContent

  const handleSelectAll = useCallback(() => {
    const sheetClusters = clusters.filter((c) => c.sheetNo === state.activeSheet);
    dispatch({ type: "SET_SELECTED_IDS", ids: new Set(sheetClusters.map((c) => c.id)) });
  }, [clusters, state.activeSheet, dispatch]);

  const handleDeselectAll = useCallback(() => {
    dispatch({ type: "DESELECT_ALL" });
  }, [dispatch]);

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onClustersChange(clusters.filter((c) => !selectedIds.has(c.id)));
    dispatch({ type: "DESELECT_ALL" });
  }, [clusters, selectedIds, onClustersChange, dispatch]);

  const handleNudge = useCallback(
    (dx: number, dy: number) => {
      if (selectedIds.size === 0) return;
      const next = clusters.map((c) => {
        if (!selectedIds.has(c.id)) return c;
        return {
          ...c,
          region: {
            top: c.region.top + dy,
            bottom: c.region.bottom + dy,
            left: c.region.left + dx,
            right: c.region.right + dx,
          },
        };
      });
      onClustersChange(next);
    },
    [clusters, selectedIds, onClustersChange],
  );

  const handleUpdateCluster = useCallback(
    (id: string, patch: Partial<ClusterDefinition>) => {
      onClustersChange(clusters.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [clusters, onClustersChange],
  );

  const handleDeleteCluster = useCallback(
    (id: string) => {
      onClustersChange(clusters.filter((c) => c.id !== id));
      dispatch({ type: "DESELECT_ALL" });
    },
    [clusters, onClustersChange, dispatch],
  );

  // ── Tab title mapping ──
  const tabTitles: Record<ActiveTab, string> = {
    clusters: "クラスター",
    networks: "ネットワーク",
    carbonCopy: "カーボンコピー",
    logs: "ログ",
  };

  return (
    <div className="flex flex-col h-[calc(100vh-2.5rem)] animate-fade-in-up">
      {/* Header strip */}
      {headerSlot && (
        <div className="shrink-0 px-4 py-1.5 border-b border-slate-200/80 bg-white">
          {headerSlot}
        </div>
      )}

      {/* Three-column layout */}
      <div className="flex flex-1 min-h-0 overflow-hidden bg-slate-100">
        {/* Left panel */}
        <SidePanel
          side="left"
          expanded={leftPanelExpanded}
          onToggle={() => dispatch({ type: "TOGGLE_LEFT_PANEL" })}
          railIcons={leftRailIcons}
          onRailIconClick={handleLeftRailClick}
          title={tabTitles[activeTab]}
        >
          <LeftPanelContent
            clusters={clusters}
            formStructure={formStructure}
            networks={networks}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
            onBulkDelete={handleBulkDelete}
            onNudge={handleNudge}
          />
        </SidePanel>

        {/* Center canvas */}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
          <div className="flex-1 overflow-auto">{children}</div>
        </div>

        {/* Right panel */}
        <SidePanel
          side="right"
          expanded={rightPanelExpanded}
          onToggle={() => dispatch({ type: "TOGGLE_RIGHT_PANEL" })}
          railIcons={rightRailIcons}
          onRailIconClick={handleRightRailClick}
          title="プロパティ"
        >
          <RightPanelContent
            clusters={clusters}
            networks={networks}
            sheets={formStructure.sheets}
            onUpdateCluster={handleUpdateCluster}
            onDeleteCluster={handleDeleteCluster}
            onNetworksChange={onNetworksChange}
            onCarbonCopyChange={onCarbonCopyChange}
          />
        </SidePanel>
      </div>
    </div>
  );
}

// ─── Wrapped with Provider ──────────────────────────────────────────────────

export default function EditorShell(props: Props) {
  return (
    <EditorProvider>
      <EditorShellInner {...props} />
    </EditorProvider>
  );
}
