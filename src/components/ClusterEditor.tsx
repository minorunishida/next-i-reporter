"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type {
  AnalysisResult,
  ClusterDefinition,
  ClusterTypeName,
  FormStructure,
  NetworkDefinition,
  SheetStructure,
  CellInfo,
} from "@/lib/form-structure";
import { TYPE_LABELS_JA } from "@/lib/cluster-type-registry";
import { mapClusterRegionToPdf, computePrintAreaPx, computePdfContentArea } from "@/lib/print-coord-mapper";
import { createNetwork } from "@/lib/network-utils";
import { loadPdfJs } from "@/lib/load-pdfjs";
import { messageFromFailedResponse, parseJsonResponse } from "@/lib/api-response";
import CreateClusterPopover from "./CreateClusterPopover";
import { useEditorState, useEditorDispatch } from "@/context/EditorContext";
import type { RegionAnalysisResult } from "@/lib/ai-analyzer";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  analysisResult: AnalysisResult;
  formStructure: FormStructure;
  onClustersChange: (clusters: ClusterDefinition[]) => void;
  networks?: NetworkDefinition[];
  onNetworksChange?: (networks: NetworkDefinition[]) => void;
  onCarbonCopyChange?: (clusters: ClusterDefinition[]) => void;
};

// ─── Constants ───────────────────────────────────────────────────────────────

const TYPE_LABELS = TYPE_LABELS_JA;

function confidenceColor(c: number) {
  if (c >= 0.9) return { bg: "rgba(16,185,129,0.18)", border: "rgba(16,185,129,0.55)", label: "高", badgeCls: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60" };
  if (c >= 0.7) return { bg: "rgba(245,158,11,0.18)", border: "rgba(245,158,11,0.55)", label: "中", badgeCls: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60" };
  return { bg: "rgba(239,68,68,0.18)", border: "rgba(239,68,68,0.55)", label: "低", badgeCls: "bg-red-50 text-red-700 ring-1 ring-red-200/60" };
}

function matchesConfidenceFilter(c: number, filter: "all" | "high" | "medium" | "low") {
  if (filter === "all") return true;
  if (filter === "high") return c >= 0.9;
  if (filter === "medium") return c >= 0.7 && c < 0.9;
  return c < 0.7;
}

const PAPER_SIZES: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: "A4" },
  A3: { w: 297, h: 420, label: "A3" },
  B4: { w: 257, h: 364, label: "B4" },
};

const BASE_PAPER_WIDTH_PX = 600;

// ─── Main Component (Canvas-only) ───────────────────────────────────────────

export default function ClusterEditor({ analysisResult, formStructure, onClustersChange, networks, onNetworksChange, onCarbonCopyChange }: Props) {
  const clusters = analysisResult.clusters;

  // Read shared state from context
  const state = useEditorState();
  const dispatch = useEditorDispatch();
  const {
    activeSheet,
    selectedId,
    selectedIds,
    filterType,
    filterConfidence,
    searchQuery,
    editorMode,
    showNetworkLines,
    showCarbonCopyLines,
    networkFromId,
    carbonCopyFromId,
    selectedNetworkId,
  } = state;

  // Local canvas state (not shared)
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number; clusterId: string } | null>(null);
  const [zoom, setZoom] = useState(1.0);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(3.0, Math.round((z + 0.1) * 10) / 10)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10)), []);
  const handleZoomReset = useCallback(() => setZoom(1.0), []);

  // Paper state
  const initialSheet = formStructure.sheets[0];
  const [paperSize, setPaperSize] = useState<"A4" | "A3" | "B4">(
    initialSheet?.pageSetup?.paperSize === "other" ? "A4" : (initialSheet?.pageSetup?.paperSize ?? "A4")
  );
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    initialSheet?.pageSetup?.orientation ?? "portrait"
  );

  // Update paper on sheet change
  useEffect(() => {
    const s = formStructure.sheets[activeSheet];
    if (s?.pageSetup) {
      setOrientation(s.pageSetup.orientation);
      if (s.pageSetup.paperSize !== "other") setPaperSize(s.pageSetup.paperSize);
    }
  }, [activeSheet, formStructure.sheets]);

  // Derived
  const sheet = formStructure.sheets[activeSheet];
  const sheetClusters = useMemo(() => clusters.filter((c) => c.sheetNo === activeSheet), [clusters, activeSheet]);

  const filteredClusters = useMemo(() => {
    return sheetClusters.filter((c) => {
      if (filterType !== "all" && c.typeName !== filterType) return false;
      if (!matchesConfidenceFilter(c.confidence, filterConfidence)) return false;
      if (searchQuery && !c.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      return true;
    });
  }, [sheetClusters, filterType, filterConfidence, searchQuery]);

  // Handlers
  const updateCluster = useCallback(
    (id: string, patch: Partial<ClusterDefinition>) => {
      onClustersChange(clusters.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    },
    [clusters, onClustersChange]
  );

  const updateClusters = useCallback(
    (patches: Map<string, Partial<ClusterDefinition>>) => {
      onClustersChange(clusters.map((c) => {
        const patch = patches.get(c.id);
        return patch ? { ...c, ...patch } : c;
      }));
    },
    [clusters, onClustersChange]
  );

  const deleteCluster = useCallback(
    (id: string) => {
      onClustersChange(clusters.filter((c) => c.id !== id));
      dispatch({ type: "DESELECT_ALL" });
    },
    [clusters, onClustersChange, dispatch]
  );

  const handleClusterClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();

      if (editorMode === "network" && onNetworksChange) {
        if (!networkFromId) {
          dispatch({ type: "SET_NETWORK_FROM_ID", id });
        } else if (networkFromId !== id) {
          onNetworksChange([...(networks ?? []), createNetwork(networkFromId, id)]);
          dispatch({ type: "SET_NETWORK_FROM_ID", id: null });
        }
        return;
      }

      if (editorMode === "carbonCopy" && onCarbonCopyChange) {
        if (!carbonCopyFromId) {
          dispatch({ type: "SET_CARBON_COPY_FROM_ID", id });
        } else if (carbonCopyFromId !== id) {
          const srcCluster = clusters.find((c) => c.id === carbonCopyFromId);
          if (srcCluster) {
            const existing = srcCluster.carbonCopy ?? [];
            const alreadyLinked = existing.some((t) => t.targetClusterId === id);
            if (!alreadyLinked) {
              const updated = clusters.map((c) =>
                c.id === carbonCopyFromId
                  ? { ...c, carbonCopy: [...existing, { targetClusterId: id, edit: 0 as const }] }
                  : c
              );
              onCarbonCopyChange(updated);
            }
          }
          dispatch({ type: "SET_CARBON_COPY_FROM_ID", id: null });
        }
        return;
      }

      const multi = e.shiftKey || e.metaKey || e.ctrlKey;
      dispatch({ type: "SELECT_CLUSTER", id, multi });
    },
    [editorMode, networkFromId, networks, onNetworksChange, carbonCopyFromId, clusters, onCarbonCopyChange, dispatch]
  );

  const handleContextMenu = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuPos({ x: e.clientX, y: e.clientY, clusterId: id });
    },
    []
  );

  useEffect(() => {
    if (!contextMenuPos) return;
    const handler = () => setContextMenuPos(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenuPos]);

  const handleRubberBandSelect = useCallback(
    (ids: Set<string>) => {
      dispatch({ type: "RUBBER_BAND_SELECT", ids });
    },
    [dispatch]
  );

  const handleBackgroundClick = useCallback(() => {
    dispatch({ type: "DESELECT_ALL" });
  }, [dispatch]);

  // Nudge (keyboard)
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
    [clusters, selectedIds, onClustersChange]
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      switch (e.key) {
        case "n": case "N": dispatch({ type: "SET_EDITOR_MODE", mode: "create" }); return;
        case "v": case "V": dispatch({ type: "SET_EDITOR_MODE", mode: "select" }); return;
        case "l": case "L": dispatch({ type: "SET_EDITOR_MODE", mode: "network" }); return;
        case "c": case "C": dispatch({ type: "SET_EDITOR_MODE", mode: "carbonCopy" }); return;
        case "Escape": dispatch({ type: "SET_EDITOR_MODE", mode: "select" }); return;
      }

      if (selectedIds.size === 0) return;
      const step = e.shiftKey ? 10 : 1;
      switch (e.key) {
        case "ArrowUp":    e.preventDefault(); handleNudge(0, -step); break;
        case "ArrowDown":  e.preventDefault(); handleNudge(0, step); break;
        case "ArrowLeft":  e.preventDefault(); handleNudge(-step, 0); break;
        case "ArrowRight": e.preventDefault(); handleNudge(step, 0); break;
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedIds, handleNudge, dispatch]);

  // Create mode
  const [pendingCreate, setPendingCreate] = useState<{
    region: { top: number; bottom: number; left: number; right: number };
    screenX: number;
    screenY: number;
  } | null>(null);

  const handleCreateDragEnd = useCallback(
    (region: { top: number; bottom: number; left: number; right: number; screenX: number; screenY: number }) => {
      setPendingCreate({ region, screenX: region.screenX, screenY: region.screenY });
    },
    []
  );

  const handleRequestAi = useCallback(async () => {
    if (!pendingCreate) throw new Error("No region");
    const { region } = pendingCreate;

    const regionCells = sheet.cells.filter((c) =>
      c.region.right > region.left && c.region.left < region.right &&
      c.region.bottom > region.top && c.region.top < region.bottom
    ).map((c) => ({
      address: c.address, row: c.row, col: c.col,
      value: c.value, formula: c.formula, isMerged: c.isMerged,
      region: c.region, style: c.style as Record<string, unknown>,
      dataValidation: c.dataValidation,
    }));

    const pad = 40;
    const contextCells = sheet.cells.filter((c) => {
      if (c.region.right > region.left && c.region.left < region.right &&
          c.region.bottom > region.top && c.region.top < region.bottom) return false;
      return c.value && (
        c.region.right > region.left - pad && c.region.left < region.right + pad &&
        c.region.bottom > region.top - pad && c.region.top < region.bottom + pad
      );
    }).map((c) => ({
      address: c.address, row: c.row, col: c.col,
      value: c.value, region: c.region,
    }));

    const res = await fetch("/api/ai-analyze-region", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sheet, regionCells, contextCells, drawnRegion: region }),
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(messageFromFailedResponse(text, res.status));
    }
    return parseJsonResponse<RegionAnalysisResult>(text);
  }, [pendingCreate, sheet]);

  const handleConfirmCreate = useCallback(
    (data: { name: string; typeName: string; type: number; inputParameters: string; readOnly: boolean; cellAddress: string; formula?: string }) => {
      if (!pendingCreate) return;
      const newCluster = {
        id: crypto.randomUUID(),
        name: data.name,
        type: data.type,
        typeName: data.typeName as ClusterDefinition["typeName"],
        sheetNo: activeSheet,
        cellAddress: data.cellAddress || "A1",
        region: pendingCreate.region,
        confidence: 1.0,
        readOnly: data.readOnly,
        inputParameters: data.inputParameters,
        excelOutputValue: data.cellAddress || "A1",
        formula: data.formula,
      };
      onClustersChange([...clusters, newCluster]);
      dispatch({ type: "SELECT_CLUSTER", id: newCluster.id, multi: false });
      setPendingCreate(null);
    },
    [pendingCreate, activeSheet, clusters, onClustersChange, dispatch]
  );

  const handleCancelCreate = useCallback(() => {
    setPendingCreate(null);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Canvas header: zoom + paper controls */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-slate-100 bg-slate-50/60 shrink-0">
        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
        </svg>
        <span className="text-[11px] font-medium text-slate-500">ビジュアルプレビュー</span>

        {/* Paper selector */}
        <div className="flex items-center gap-1 ml-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">用紙</span>
          {(["A4", "A3", "B4"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setPaperSize(s)}
              className={`rounded-lg px-2 py-0.5 text-[10px] font-medium transition-all duration-200 ${
                paperSize === s
                  ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 shadow-sm"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1 ml-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">向き</span>
          <button
            onClick={() => setOrientation("portrait")}
            className={`rounded-lg px-2 py-0.5 text-[10px] font-medium transition-all duration-200 flex items-center gap-0.5 ${
              orientation === "portrait"
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 shadow-sm"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-3 w-3" viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1" y="1" width="12" height="16" rx="1" />
            </svg>
            縦
          </button>
          <button
            onClick={() => setOrientation("landscape")}
            className={`rounded-lg px-2 py-0.5 text-[10px] font-medium transition-all duration-200 flex items-center gap-0.5 ${
              orientation === "landscape"
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 shadow-sm"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            <svg className="h-3 w-3" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <rect x="1" y="1" width="16" height="12" rx="1" />
            </svg>
            横
          </button>
        </div>

        <span className="ml-auto text-[10px] text-slate-400">
          {(() => {
            const sz = PAPER_SIZES[paperSize] ?? PAPER_SIZES.A4;
            const w = orientation === "portrait" ? sz.w : sz.h;
            const h = orientation === "portrait" ? sz.h : sz.w;
            return `${sz.label} ${orientation === "portrait" ? "縦" : "横"} ${w}×${h}mm`;
          })()}
        </span>

        {/* Zoom controls */}
        <div className="flex items-center gap-1 ml-3">
          <button
            onClick={handleZoomOut}
            disabled={zoom <= 0.5}
            className="rounded-lg p-1 text-slate-500 ring-1 ring-slate-200/60 cursor-pointer hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            title="ズームアウト"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M11 8H7m10 3a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
          <button
            onClick={handleZoomReset}
            className="rounded-lg px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200/60 cursor-pointer hover:bg-blue-50 hover:text-blue-600 transition-all duration-150 min-w-[40px] text-center"
            title="ズームリセット"
          >
            {Math.round(zoom * 100)}%
          </button>
          <button
            onClick={handleZoomIn}
            disabled={zoom >= 3.0}
            className="rounded-lg p-1 text-slate-500 ring-1 ring-slate-200/60 cursor-pointer hover:bg-blue-50 hover:text-blue-600 disabled:opacity-30 disabled:cursor-not-allowed transition-all duration-150"
            title="ズームイン"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M10 8v6m3-3H7m10 0a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div
        className="flex-1 overflow-auto bg-slate-100 p-2 flex justify-center"
        onClick={handleBackgroundClick}
        onWheel={(e) => {
          if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setZoom((z) => {
              const delta = e.deltaY > 0 ? -0.1 : 0.1;
              return Math.max(0.5, Math.min(3.0, Math.round((z + delta) * 10) / 10));
            });
          }
        }}
      >
        <VisualPreview
          sheet={sheet}
          clusters={filteredClusters}
          allClusters={analysisResult.clusters}
          selectedId={selectedId}
          selectedIds={selectedIds}
          onClusterClick={handleClusterClick}
          onContextMenu={handleContextMenu}
          onUpdateCluster={updateCluster}
          onBulkUpdateClusters={updateClusters}
          onRubberBandSelect={handleRubberBandSelect}
          paperSize={paperSize}
          orientation={orientation}
          pdfBase64={formStructure.pdfBase64}
          activeSheetIndex={activeSheet}
          zoom={zoom}
          editorMode={editorMode}
          onCreateDragEnd={handleCreateDragEnd}
          networks={networks}
          selectedNetworkId={selectedNetworkId}
          showNetworkLines={showNetworkLines}
          networkFromId={networkFromId}
          showCarbonCopyLines={showCarbonCopyLines}
          carbonCopyFromId={carbonCopyFromId}
        />
      </div>

      {/* Create cluster popover */}
      {pendingCreate && (
        <CreateClusterPopover
          screenX={pendingCreate.screenX}
          screenY={pendingCreate.screenY}
          onRequestAi={handleRequestAi}
          onConfirm={handleConfirmCreate}
          onCancel={handleCancelCreate}
        />
      )}

      {/* Context menu */}
      {contextMenuPos && (
        <ContextMenu
          x={contextMenuPos.x}
          y={contextMenuPos.y}
          onDelete={() => {
            deleteCluster(contextMenuPos.clusterId);
            setContextMenuPos(null);
          }}
          onSelect={() => {
            dispatch({ type: "SELECT_CLUSTER", id: contextMenuPos.clusterId, multi: false });
            setContextMenuPos(null);
          }}
          onClose={() => setContextMenuPos(null)}
        />
      )}
    </div>
  );
}

// ─── Resize handle types ─────────────────────────────────────────────────────

type ResizeEdge = "top" | "bottom" | "left" | "right";
type ResizeHandle = {
  edges: ResizeEdge[];
  cursor: string;
  position: React.CSSProperties;
};

const RESIZE_HANDLES: ResizeHandle[] = [
  { edges: ["top", "left"], cursor: "nw-resize", position: { top: -5, left: -5 } },
  { edges: ["top", "right"], cursor: "ne-resize", position: { top: -5, right: -5 } },
  { edges: ["bottom", "left"], cursor: "sw-resize", position: { bottom: -5, left: -5 } },
  { edges: ["bottom", "right"], cursor: "se-resize", position: { bottom: -5, right: -5 } },
  { edges: ["top"], cursor: "n-resize", position: { top: -5, left: "50%", marginLeft: -5 } },
  { edges: ["bottom"], cursor: "s-resize", position: { bottom: -5, left: "50%", marginLeft: -5 } },
  { edges: ["left"], cursor: "w-resize", position: { top: "50%", left: -5, marginTop: -5 } },
  { edges: ["right"], cursor: "e-resize", position: { top: "50%", right: -5, marginTop: -5 } },
];

const MIN_CLUSTER_SIZE_PX = 10;

function useScreenToExcelScale(
  tableScale: number,
  usePdfMode: boolean,
  sheet: SheetStructure,
  paperDims: { wPx: number; hPx: number; pxPerMm: number },
  zoom: number
) {
  return useMemo(() => {
    if (usePdfMode && sheet.printMeta) {
      const paPx = computePrintAreaPx(sheet, sheet.printMeta!);
      const content = computePdfContentArea(sheet.printMeta!);
      const pageW = sheet.printMeta!.pdfPageWidthPt;
      const pageH = sheet.printMeta!.pdfPageHeightPt;
      return {
        x: 1 / ((content.width / paPx.width / pageW) * paperDims.wPx * zoom),
        y: 1 / ((content.height / paPx.height / pageH) * paperDims.hPx * zoom),
      };
    }
    return {
      x: 1 / (tableScale * zoom),
      y: 1 / (tableScale * zoom),
    };
  }, [tableScale, usePdfMode, sheet, paperDims, zoom]);
}

function ResizeHandles({
  cluster, tableScale, usePdfMode, sheet, paperDims, zoom,
  onUpdateCluster, onBulkUpdateClusters, selectedIds, allClusters,
}: {
  cluster: ClusterDefinition;
  tableScale: number;
  usePdfMode: boolean;
  sheet: SheetStructure;
  paperDims: { wPx: number; hPx: number; pxPerMm: number };
  zoom: number;
  onUpdateCluster: (id: string, patch: Partial<ClusterDefinition>) => void;
  onBulkUpdateClusters: (patches: Map<string, Partial<ClusterDefinition>>) => void;
  selectedIds: Set<string>;
  allClusters: ClusterDefinition[];
}) {
  const [resizingEdges, setResizingEdges] = useState<ResizeEdge[] | null>(null);
  const scale = useScreenToExcelScale(tableScale, usePdfMode, sheet, paperDims, zoom);
  const isBulk = selectedIds.size > 1;

  const handleMouseDown = useCallback(
    (edges: ResizeEdge[], e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const isMove = edges.length === 4;

      const startRegions = isMove && isBulk
        ? new Map(allClusters.filter((c) => selectedIds.has(c.id)).map((c) => [c.id, { ...c.region }]))
        : new Map([[cluster.id, { ...cluster.region }]]);

      setResizingEdges(edges);

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) * scale.x;
        const dy = (ev.clientY - startY) * scale.y;

        if (isMove && isBulk) {
          const patches = new Map<string, Partial<ClusterDefinition>>();
          for (const [id, startRegion] of startRegions) {
            patches.set(id, {
              region: {
                top: startRegion.top + dy, bottom: startRegion.bottom + dy,
                left: startRegion.left + dx, right: startRegion.right + dx,
              },
            });
          }
          onBulkUpdateClusters(patches);
        } else {
          const startRegion = startRegions.get(cluster.id)!;
          const newRegion = { ...startRegion };

          if (isMove) {
            newRegion.top = startRegion.top + dy;
            newRegion.bottom = startRegion.bottom + dy;
            newRegion.left = startRegion.left + dx;
            newRegion.right = startRegion.right + dx;
          } else {
            for (const edge of edges) {
              switch (edge) {
                case "top": newRegion.top = startRegion.top + dy; break;
                case "bottom": newRegion.bottom = startRegion.bottom + dy; break;
                case "left": newRegion.left = startRegion.left + dx; break;
                case "right": newRegion.right = startRegion.right + dx; break;
              }
            }
            if (newRegion.right - newRegion.left < MIN_CLUSTER_SIZE_PX) {
              if (edges.includes("left")) newRegion.left = newRegion.right - MIN_CLUSTER_SIZE_PX;
              else newRegion.right = newRegion.left + MIN_CLUSTER_SIZE_PX;
            }
            if (newRegion.bottom - newRegion.top < MIN_CLUSTER_SIZE_PX) {
              if (edges.includes("top")) newRegion.top = newRegion.bottom - MIN_CLUSTER_SIZE_PX;
              else newRegion.bottom = newRegion.top + MIN_CLUSTER_SIZE_PX;
            }
          }
          onUpdateCluster(cluster.id, { region: newRegion });
        }
      };

      const handleMouseUp = () => {
        setResizingEdges(null);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };

      document.body.style.cursor = edges.length === 4
        ? "move"
        : edges.length === 2
          ? (edges.includes("top") ? (edges.includes("left") ? "nw-resize" : "ne-resize") : (edges.includes("left") ? "sw-resize" : "se-resize"))
          : edges[0] === "top" || edges[0] === "bottom" ? "ns-resize" : "ew-resize";
      document.body.style.userSelect = "none";

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [cluster, scale, isBulk, selectedIds, allClusters, onUpdateCluster, onBulkUpdateClusters]
  );

  const isCorner = (edges: ResizeEdge[]) => edges.length === 2;

  return (
    <>
      <div
        onMouseDown={(e) => handleMouseDown(["top", "bottom", "left", "right"], e)}
        className="absolute inset-1 z-30 cursor-move"
      />
      {!isBulk && RESIZE_HANDLES.map((handle, i) => (
        <div
          key={i}
          onMouseDown={(e) => handleMouseDown(handle.edges, e)}
          className="absolute z-40"
          style={{ ...handle.position, width: 10, height: 10, cursor: handle.cursor }}
        >
          <div
            className={`absolute inset-0 m-auto rounded-full bg-blue-500 ring-2 ring-white ${
              resizingEdges && resizingEdges.join() === handle.edges.join() ? "scale-125" : ""
            } transition-transform duration-100`}
            style={{ width: isCorner(handle.edges) ? 8 : 6, height: isCorner(handle.edges) ? 8 : 6 }}
          />
        </div>
      ))}
      {resizingEdges && (
        <div className="absolute inset-0 rounded bg-blue-500/5 pointer-events-none ring-2 ring-blue-400/40" />
      )}
    </>
  );
}

function GroupBoundingBox({
  clusters, selectedIds, tableScale, usePdfMode, sheet, paperDims, zoom, onBulkUpdateClusters,
}: {
  clusters: ClusterDefinition[];
  selectedIds: Set<string>;
  tableScale: number;
  usePdfMode: boolean;
  sheet: SheetStructure;
  paperDims: { wPx: number; hPx: number; pxPerMm: number };
  zoom: number;
  onBulkUpdateClusters: (patches: Map<string, Partial<ClusterDefinition>>) => void;
}) {
  const scale = useScreenToExcelScale(tableScale, usePdfMode, sheet, paperDims, zoom);

  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    let count = 0;
    for (const c of clusters) {
      if (!selectedIds.has(c.id)) continue;
      let t: number, l: number, r: number, b: number;
      if (usePdfMode && sheet.printMeta) {
        const mapped = mapClusterRegionToPdf(c.region, sheet, sheet.printMeta);
        if (!mapped) continue;
        t = mapped.top * paperDims.hPx; l = mapped.left * paperDims.wPx;
        r = mapped.right * paperDims.wPx; b = mapped.bottom * paperDims.hPx;
      } else {
        t = c.region.top * tableScale; l = c.region.left * tableScale;
        r = c.region.right * tableScale; b = c.region.bottom * tableScale;
      }
      minX = Math.min(minX, l); minY = Math.min(minY, t);
      maxX = Math.max(maxX, r); maxY = Math.max(maxY, b);
      count++;
    }
    if (count < 2) return null;
    return { left: minX, top: minY, width: maxX - minX, height: maxY - minY };
  }, [clusters, selectedIds, usePdfMode, sheet, paperDims, tableScale]);

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();
      const startX = e.clientX;
      const startY = e.clientY;
      const startRegions = new Map(
        clusters.filter((c) => selectedIds.has(c.id)).map((c) => [c.id, { ...c.region }])
      );
      const handleMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) * scale.x;
        const dy = (ev.clientY - startY) * scale.y;
        const patches = new Map<string, Partial<ClusterDefinition>>();
        for (const [id, startRegion] of startRegions) {
          patches.set(id, {
            region: {
              top: startRegion.top + dy, bottom: startRegion.bottom + dy,
              left: startRegion.left + dx, right: startRegion.right + dx,
            },
          });
        }
        onBulkUpdateClusters(patches);
      };
      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
      };
      document.body.style.cursor = "move";
      document.body.style.userSelect = "none";
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [clusters, selectedIds, scale, onBulkUpdateClusters]
  );

  if (!bounds) return null;
  const pad = 6;
  return (
    <div
      data-group-box
      onMouseDown={handleMouseDown}
      className="absolute z-40 cursor-move"
      style={{ left: bounds.left - pad, top: bounds.top - pad, width: bounds.width + pad * 2, height: bounds.height + pad * 2 }}
    >
      <div className="absolute inset-0 rounded border-2 border-dashed border-blue-400/70 bg-blue-50/10 pointer-events-none" />
      <div className="absolute -top-5 left-1/2 -translate-x-1/2 rounded-full bg-blue-500 px-2 py-0.5 text-[9px] font-bold text-white shadow-sm pointer-events-none whitespace-nowrap">
        {selectedIds.size} 件選択中
      </div>
    </div>
  );
}

// ─── Visual Preview ──────────────────────────────────────────────────────────

function VisualPreview({
  sheet, clusters, allClusters, selectedId, selectedIds,
  onClusterClick, onContextMenu, onUpdateCluster, onBulkUpdateClusters,
  onRubberBandSelect, paperSize, orientation, pdfBase64, activeSheetIndex,
  zoom = 1, editorMode = "select", onCreateDragEnd,
  networks, selectedNetworkId, showNetworkLines = true, networkFromId = null,
  showCarbonCopyLines = true, carbonCopyFromId = null,
}: {
  sheet: SheetStructure;
  clusters: ClusterDefinition[];
  allClusters: ClusterDefinition[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onClusterClick: (id: string, e: React.MouseEvent) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
  onUpdateCluster: (id: string, patch: Partial<ClusterDefinition>) => void;
  onBulkUpdateClusters: (patches: Map<string, Partial<ClusterDefinition>>) => void;
  onRubberBandSelect: (ids: Set<string>) => void;
  paperSize: "A4" | "A3" | "B4";
  orientation: "portrait" | "landscape";
  pdfBase64?: string;
  activeSheetIndex: number;
  zoom?: number;
  editorMode?: "select" | "create" | "network" | "carbonCopy";
  onCreateDragEnd?: (region: { top: number; bottom: number; left: number; right: number; screenX: number; screenY: number }) => void;
  networks?: NetworkDefinition[];
  selectedNetworkId?: string | null;
  showNetworkLines?: boolean;
  networkFromId?: string | null;
  showCarbonCopyLines?: boolean;
  carbonCopyFromId?: string | null;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const editorModeIsNetwork = editorMode === "network";
  const editorModeIsCarbonCopy = editorMode === "carbonCopy";

  const [networkMousePos, setNetworkMousePos] = useState<{ x: number; y: number } | null>(null);
  const [carbonCopyMousePos, setCarbonCopyMousePos] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    if (!editorModeIsNetwork || !networkFromId || !containerRef.current) {
      setNetworkMousePos(null);
      return;
    }
    const el = containerRef.current;
    let rafId = 0;
    const handler = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        setNetworkMousePos({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
      });
    };
    el.addEventListener("mousemove", handler);
    return () => { el.removeEventListener("mousemove", handler); cancelAnimationFrame(rafId); };
  }, [editorModeIsNetwork, networkFromId, zoom]);

  useEffect(() => {
    if (!editorModeIsCarbonCopy || !carbonCopyFromId || !containerRef.current) {
      setCarbonCopyMousePos(null);
      return;
    }
    const el = containerRef.current;
    let rafId = 0;
    const handler = (e: MouseEvent) => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const rect = el.getBoundingClientRect();
        setCarbonCopyMousePos({ x: (e.clientX - rect.left) / zoom, y: (e.clientY - rect.top) / zoom });
      });
    };
    el.addEventListener("mousemove", handler);
    return () => { el.removeEventListener("mousemove", handler); cancelAnimationFrame(rafId); };
  }, [editorModeIsCarbonCopy, carbonCopyFromId, zoom]);

  const usePdfMode = !!pdfBase64 && !!sheet.printMeta;

  const paperDims = useMemo(() => {
    const sz = PAPER_SIZES[paperSize] ?? PAPER_SIZES.A4;
    const wMm = orientation === "portrait" ? sz.w : sz.h;
    const hMm = orientation === "portrait" ? sz.h : sz.w;
    const pxPerMm = BASE_PAPER_WIDTH_PX / PAPER_SIZES.A4.w;
    return { wPx: wMm * pxPerMm, hPx: hMm * pxPerMm, pxPerMm };
  }, [paperSize, orientation]);

  const { tableScale, marginPx } = useMemo(() => {
    const margins = sheet.pageSetup?.margins ?? { top: 19.1, bottom: 19.1, left: 17.8, right: 17.8 };
    const mPx = {
      top: margins.top * paperDims.pxPerMm,
      bottom: margins.bottom * paperDims.pxPerMm,
      left: margins.left * paperDims.pxPerMm,
      right: margins.right * paperDims.pxPerMm,
    };
    if (sheet.totalWidth === 0 || sheet.totalHeight === 0) {
      return { tableScale: 1, marginPx: mPx };
    }
    const availW = paperDims.wPx - mPx.left - mPx.right;
    const availH = paperDims.hPx - mPx.top - mPx.bottom;
    const scaleX = availW / sheet.totalWidth;
    const scaleY = availH / sheet.totalHeight;
    return { tableScale: Math.min(scaleX, scaleY, 1), marginPx: mPx };
  }, [sheet, paperDims]);

  // PDF render
  const renderTaskRef = useRef<any>(null);
  useEffect(() => {
    if (!usePdfMode || !pdfBase64 || !canvasRef.current) return;
    let cancelled = false;

    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    (async () => {
      const pdfjsLib = await loadPdfJs();
      const data = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const pageNum = Math.min(activeSheetIndex + 1, pdf.numPages);
      const page = await pdf.getPage(pageNum);
      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const viewport = page.getViewport({ scale: 1 });
      const scaleX = paperDims.wPx / viewport.width;
      const scaleY = paperDims.hPx / viewport.height;
      const scale = Math.min(scaleX, scaleY);
      const scaledViewport = page.getViewport({ scale: scale * (window.devicePixelRatio || 1) });
      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${paperDims.wPx}px`;
      canvas.style.height = `${paperDims.hPx}px`;
      const task = page.render({ canvasContext: ctx, viewport: scaledViewport, canvas } as any);
      renderTaskRef.current = task;
      try {
        await task.promise;
      } catch (e: any) {
        if (e?.name === "RenderingCancelledException") return;
        throw e;
      }
      renderTaskRef.current = null;
    })();

    return () => {
      cancelled = true;
      if (renderTaskRef.current) {
        renderTaskRef.current.cancel();
        renderTaskRef.current = null;
      }
    };
  }, [usePdfMode, pdfBase64, activeSheetIndex, paperDims]);

  // HTML table cell grid
  const cellGrid = useMemo(() => {
    if (usePdfMode) return { grid: new Map<string, CellInfo>(), merged: new Set<string>() };
    const grid = new Map<string, CellInfo>();
    const merged = new Set<string>();
    for (const cell of sheet.cells) {
      grid.set(`${cell.row},${cell.col}`, cell);
      if (cell.isMerged && cell.mergeRange) {
        const mr = cell.mergeRange;
        for (let r = mr.startRow; r <= mr.endRow; r++) {
          for (let c = mr.startCol; c <= mr.endCol; c++) {
            if (r !== cell.row || c !== cell.col) merged.add(`${r},${c}`);
          }
        }
      }
    }
    return { grid, merged };
  }, [sheet.cells, usePdfMode]);

  // Rubber band selection
  const [rubberBand, setRubberBand] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);
  const justRubberBandedRef = useRef(false);

  const handleRubberBandStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return;
      if (editorMode === "create") return;
      const el = e.target as HTMLElement;
      if (el.closest("[data-cluster-id]") || el.closest("[data-group-box]")) return;
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      setRubberBand({ startX: x, startY: y, endX: x, endY: y });

      const handleMouseMove = (ev: MouseEvent) => {
        const mx = (ev.clientX - rect.left) / zoom;
        const my = (ev.clientY - rect.top) / zoom;
        setRubberBand((prev) => prev ? { ...prev, endX: mx, endY: my } : null);
      };
      const handleMouseUp = (ev: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        const mx = (ev.clientX - rect.left) / zoom;
        const my = (ev.clientY - rect.top) / zoom;
        const selLeft = Math.min(x, mx);
        const selRight = Math.max(x, mx);
        const selTop = Math.min(y, my);
        const selBottom = Math.max(y, my);
        if (selRight - selLeft > 5 || selBottom - selTop > 5) {
          const hitIds = new Set<string>();
          for (const c of clusters) {
            let cTop: number, cLeft: number, cRight: number, cBottom: number;
            if (usePdfMode && sheet.printMeta) {
              const mapped = mapClusterRegionToPdf(c.region, sheet, sheet.printMeta);
              if (!mapped) continue;
              cTop = mapped.top * paperDims.hPx; cLeft = mapped.left * paperDims.wPx;
              cRight = mapped.right * paperDims.wPx; cBottom = mapped.bottom * paperDims.hPx;
            } else {
              cTop = c.region.top * tableScale; cLeft = c.region.left * tableScale;
              cRight = c.region.right * tableScale; cBottom = c.region.bottom * tableScale;
            }
            if (cLeft < selRight && cRight > selLeft && cTop < selBottom && cBottom > selTop) {
              hitIds.add(c.id);
            }
          }
          if (hitIds.size > 0) {
            onRubberBandSelect(hitIds);
            justRubberBandedRef.current = true;
            setTimeout(() => { justRubberBandedRef.current = false; }, 0);
          }
        }
        setRubberBand(null);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [clusters, zoom, usePdfMode, sheet, paperDims, tableScale, onRubberBandSelect, editorMode]
  );

  // Create mode drag
  const [createDrag, setCreateDrag] = useState<{ startX: number; startY: number; endX: number; endY: number } | null>(null);

  const handleCreateDragStart = useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0 || editorMode !== "create") return;
      const el = e.target as HTMLElement;
      if (el.closest("[data-cluster-id]")) return;
      const containerEl = containerRef.current;
      if (!containerEl) return;
      const rect = containerEl.getBoundingClientRect();
      const x = (e.clientX - rect.left) / zoom;
      const y = (e.clientY - rect.top) / zoom;
      setCreateDrag({ startX: x, startY: y, endX: x, endY: y });

      const handleMouseMove = (ev: MouseEvent) => {
        const mx = (ev.clientX - rect.left) / zoom;
        const my = (ev.clientY - rect.top) / zoom;
        setCreateDrag((prev) => prev ? { ...prev, endX: mx, endY: my } : null);
      };
      const handleMouseUp = (ev: MouseEvent) => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
        const mx = (ev.clientX - rect.left) / zoom;
        const my = (ev.clientY - rect.top) / zoom;
        const left = Math.min(x, mx);
        const right = Math.max(x, mx);
        const top = Math.min(y, my);
        const bottom = Math.max(y, my);
        setCreateDrag(null);
        if (right - left < 20 || bottom - top < 20) return;

        let excelRegion: { top: number; left: number; right: number; bottom: number };
        if (usePdfMode && sheet.printMeta) {
          const paPx = computePrintAreaPx(sheet, sheet.printMeta);
          const content = computePdfContentArea(sheet.printMeta);
          const pageW = sheet.printMeta.pdfPageWidthPt;
          const pageH = sheet.printMeta.pdfPageHeightPt;
          const normLeft = left / paperDims.wPx;
          const normRight = right / paperDims.wPx;
          const normTop = top / paperDims.hPx;
          const normBottom = bottom / paperDims.hPx;
          const relLeft = (normLeft * pageW - content.left) / content.width;
          const relRight = (normRight * pageW - content.left) / content.width;
          const relTop = (normTop * pageH - content.top) / content.height;
          const relBottom = (normBottom * pageH - content.top) / content.height;
          excelRegion = {
            left: paPx.left + relLeft * paPx.width,
            right: paPx.left + relRight * paPx.width,
            top: paPx.top + relTop * paPx.height,
            bottom: paPx.top + relBottom * paPx.height,
          };
        } else {
          excelRegion = { top: top / tableScale, left: left / tableScale, right: right / tableScale, bottom: bottom / tableScale };
        }
        onCreateDragEnd?.({ ...excelRegion, screenX: ev.clientX, screenY: ev.clientY });
        justRubberBandedRef.current = true;
        setTimeout(() => { justRubberBandedRef.current = false; }, 0);
      };
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [editorMode, zoom, usePdfMode, sheet, paperDims, tableScale, onCreateDragEnd]
  );

  // Cluster overlay renderer
  const renderCluster = (cluster: ClusterDefinition) => {
    const isSelected = cluster.id === selectedId;
    const isInGroup = selectedIds.has(cluster.id);
    const isNetworkFrom = editorModeIsNetwork && cluster.id === networkFromId;
    const isCarbonCopyFrom = editorModeIsCarbonCopy && cluster.id === carbonCopyFromId;
    const cc = confidenceColor(cluster.confidence);

    let top: number, left: number, width: number, height: number;
    if (usePdfMode && sheet.printMeta) {
      const mapped = mapClusterRegionToPdf(cluster.region, sheet, sheet.printMeta);
      if (!mapped) return null;
      top = mapped.top * paperDims.hPx; left = mapped.left * paperDims.wPx;
      width = (mapped.right - mapped.left) * paperDims.wPx;
      height = (mapped.bottom - mapped.top) * paperDims.hPx;
    } else {
      top = cluster.region.top * tableScale; left = cluster.region.left * tableScale;
      width = (cluster.region.right - cluster.region.left) * tableScale;
      height = (cluster.region.bottom - cluster.region.top) * tableScale;
    }
    if (width < 1 || height < 1) return null;

    return (
      <div
        key={cluster.id}
        data-cluster-id={cluster.id}
        onClick={(e) => onClusterClick(cluster.id, e)}
        onContextMenu={(e) => onContextMenu(cluster.id, e)}
        className={`absolute transition-all duration-150 ${
          editorModeIsNetwork || editorModeIsCarbonCopy ? "cursor-cell" : "cursor-default"
        }`}
        style={{
          top, left, width, height,
          backgroundColor: isNetworkFrom ? "rgba(99,102,241,0.25)" : isCarbonCopyFrom ? "rgba(16,185,129,0.25)" : cc.bg,
          border: isNetworkFrom ? "2px solid rgb(99,102,241)"
            : isCarbonCopyFrom ? "2px solid rgb(16,185,129)"
            : isSelected ? "2px solid rgb(59,130,246)"
            : isInGroup ? "2px solid rgb(147,197,253)"
            : `1.5px solid ${cc.border}`,
          borderRadius: 3,
          zIndex: isNetworkFrom || isCarbonCopyFrom ? 40 : isSelected ? 30 : isInGroup ? 20 : 10,
          boxShadow: isNetworkFrom ? "0 0 0 4px rgba(99,102,241,0.3)"
            : isCarbonCopyFrom ? "0 0 0 4px rgba(16,185,129,0.3)"
            : isSelected ? "0 0 0 3px rgba(59,130,246,0.2)" : undefined,
        }}
        title={`${cluster.name} (${TYPE_LABELS[cluster.typeName]}) — ${Math.round(cluster.confidence * 100)}%`}
      >
        {width > 40 && height > 14 && (
          <span className="absolute inset-0 flex items-center justify-center text-center leading-none pointer-events-none select-none truncate px-0.5"
            style={{ fontSize: Math.min(10, height * 0.5, width * 0.12) }}>
            <span className="bg-white/80 rounded px-0.5 py-px text-slate-700 font-medium">
              {cluster.name.length > 12 ? cluster.name.slice(0, 11) + "..." : cluster.name}
            </span>
          </span>
        )}
        {isSelected && (
          <ResizeHandles
            cluster={cluster} tableScale={tableScale} usePdfMode={usePdfMode}
            sheet={sheet} paperDims={paperDims} zoom={zoom}
            onUpdateCluster={onUpdateCluster} onBulkUpdateClusters={onBulkUpdateClusters}
            selectedIds={selectedIds} allClusters={clusters}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{ width: paperDims.wPx * zoom, height: paperDims.hPx * zoom, flexShrink: 0 }}
      onClick={(e) => {
        if (justRubberBandedRef.current) e.stopPropagation();
      }}
    >
    <div
      ref={containerRef}
      onMouseDown={(e) => { handleRubberBandStart(e); handleCreateDragStart(e); }}
      className={`bg-white shadow-xl ring-1 ring-slate-200/80 flex-shrink-0 relative transition-all duration-300 ease-in-out ${
        editorMode === "create" ? "cursor-crosshair" : (editorModeIsNetwork || editorModeIsCarbonCopy) ? "cursor-cell" : ""
      }`}
      style={{
        width: paperDims.wPx, height: paperDims.hPx,
        transform: `scale(${zoom})`, transformOrigin: "top center",
      }}
    >
      {createDrag && (() => {
        const x = Math.min(createDrag.startX, createDrag.endX);
        const y = Math.min(createDrag.startY, createDrag.endY);
        const w = Math.abs(createDrag.endX - createDrag.startX);
        const h = Math.abs(createDrag.endY - createDrag.startY);
        return <div className="absolute pointer-events-none z-50 border-2 border-emerald-400 bg-emerald-100/20 rounded-sm" style={{ left: x, top: y, width: w, height: h }} />;
      })()}
      {rubberBand && (() => {
        const x = Math.min(rubberBand.startX, rubberBand.endX);
        const y = Math.min(rubberBand.startY, rubberBand.endY);
        const w = Math.abs(rubberBand.endX - rubberBand.startX);
        const h = Math.abs(rubberBand.endY - rubberBand.startY);
        return <div className="absolute pointer-events-none z-50 border-2 border-blue-400 bg-blue-100/20 rounded-sm" style={{ left: x, top: y, width: w, height: h }} />;
      })()}
      {usePdfMode ? (
        <>
          <canvas ref={canvasRef} className="absolute top-0 left-0" />
          {clusters.map(renderCluster)}
          <GroupBoundingBox
            clusters={clusters} selectedIds={selectedIds} tableScale={tableScale}
            usePdfMode={usePdfMode} sheet={sheet} paperDims={paperDims} zoom={zoom}
            onBulkUpdateClusters={onBulkUpdateClusters}
          />
        </>
      ) : (
        <>
          <div className="absolute overflow-hidden" style={{ top: marginPx.top, left: marginPx.left, right: marginPx.right, bottom: marginPx.bottom }}>
            <div className="absolute top-0 left-0 origin-top-left" style={{ transform: `scale(${tableScale})`, width: sheet.totalWidth, height: sheet.totalHeight }}>
              <table className="border-collapse text-[10px]" style={{ width: sheet.totalWidth }}>
                <tbody>
                  {Array.from({ length: sheet.rowCount }, (_, r) => (
                    <tr key={r}>
                      {Array.from({ length: sheet.colCount }, (_, c) => {
                        const key = `${r},${c}`;
                        if (cellGrid.merged.has(key)) return null;
                        const cell = cellGrid.grid.get(key);
                        const colSpan = cell?.mergeRange ? cell.mergeRange.endCol - cell.mergeRange.startCol + 1 : 1;
                        const rowSpan = cell?.mergeRange ? cell.mergeRange.endRow - cell.mergeRange.startRow + 1 : 1;
                        const width = sheet.colWidths[c] ?? 64;
                        const height = sheet.rowHeights[r] ?? 20;
                        return (
                          <td key={c} colSpan={colSpan > 1 ? colSpan : undefined} rowSpan={rowSpan > 1 ? rowSpan : undefined}
                            style={{
                              minWidth: width, height,
                              backgroundColor: cell?.style.bgColor ?? undefined,
                              color: cell?.style.fontColor ?? undefined,
                              fontWeight: cell?.style.bold ? "bold" : undefined,
                              fontSize: cell?.style.fontSize ? `${Math.min(cell.style.fontSize, 11)}px` : undefined,
                              textAlign: cell?.style.horizontalAlignment ?? "left",
                            }}
                            className="border border-slate-200/70 px-0.5 py-0 truncate leading-tight"
                          >{cell?.value ?? ""}</td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {clusters.map(renderCluster)}
            <GroupBoundingBox
              clusters={clusters} selectedIds={selectedIds} tableScale={tableScale}
              usePdfMode={usePdfMode} sheet={sheet} paperDims={paperDims} zoom={zoom}
              onBulkUpdateClusters={onBulkUpdateClusters}
            />
          </div>
        </>
      )}
      {/* Network & CC line overlays */}
      {(() => {
        function clusterCenter(c: ClusterDefinition): { x: number; y: number } | null {
          if (c.sheetNo !== activeSheetIndex) return null;
          if (usePdfMode && sheet.printMeta) {
            const mapped = mapClusterRegionToPdf(c.region, sheet, sheet.printMeta);
            if (!mapped) return null;
            return { x: ((mapped.left + mapped.right) / 2) * paperDims.wPx, y: ((mapped.top + mapped.bottom) / 2) * paperDims.hPx };
          }
          return {
            x: marginPx.left + ((c.region.left + c.region.right) / 2) * tableScale,
            y: marginPx.top + ((c.region.top + c.region.bottom) / 2) * tableScale,
          };
        }

        const svgs: React.ReactNode[] = [];

        if (showNetworkLines && networks && networks.length > 0) {
          const centerMap = new Map<string, { x: number; y: number }>();
          for (const c of allClusters) { const pt = clusterCenter(c); if (pt) centerMap.set(c.id, pt); }
          const lines = networks.flatMap((net, i) => {
            const from = centerMap.get(net.prevClusterId);
            const to = centerMap.get(net.nextClusterId);
            if (!from || !to) return [];
            const dx = to.x - from.x, dy = to.y - from.y;
            if (dx * dx + dy * dy < 1) return [];
            const isHi = net.id === selectedNetworkId;
            return [(<g key={`net-${i}`} opacity={isHi ? 1 : 0.65}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke={isHi ? "#818cf8" : "#6366f1"} strokeWidth={isHi ? 3 : 2} markerEnd={`url(#arrow-${isHi ? "hi" : "lo"})`} /></g>)];
          });
          if (lines.length > 0) {
            svgs.push(
              <svg key="net-lines" className="absolute inset-0 pointer-events-none" style={{ zIndex: 55 }} width={paperDims.wPx} height={paperDims.hPx} viewBox={`0 0 ${paperDims.wPx} ${paperDims.hPx}`}>
                <defs>
                  <marker id="arrow-lo" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#6366f1" /></marker>
                  <marker id="arrow-hi" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#818cf8" /></marker>
                </defs>
                {lines}
              </svg>
            );
          }
        }

        if (showCarbonCopyLines) {
          const centerMap = new Map<string, { x: number; y: number }>();
          for (const c of allClusters) { const pt = clusterCenter(c); if (pt) centerMap.set(c.id, pt); }
          const ccLines = allClusters.flatMap((src, i) => {
            if (!src.carbonCopy || src.carbonCopy.length === 0) return [];
            const from = centerMap.get(src.id);
            if (!from) return [];
            return src.carbonCopy.flatMap((target, j) => {
              const to = centerMap.get(target.targetClusterId);
              if (!to) return [];
              const dx = to.x - from.x, dy = to.y - from.y;
              if (dx * dx + dy * dy < 1) return [];
              return [(<g key={`cc-${i}-${j}`} opacity={0.65}><line x1={from.x} y1={from.y} x2={to.x} y2={to.y} stroke="#10b981" strokeWidth={2} markerEnd="url(#cc-arrow)" /></g>)];
            });
          });
          if (ccLines.length > 0) {
            svgs.push(
              <svg key="cc-lines" className="absolute inset-0 pointer-events-none" style={{ zIndex: 54 }} width={paperDims.wPx} height={paperDims.hPx} viewBox={`0 0 ${paperDims.wPx} ${paperDims.hPx}`}>
                <defs><marker id="cc-arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L8,3 z" fill="#10b981" /></marker></defs>
                {ccLines}
              </svg>
            );
          }
        }

        if (editorModeIsCarbonCopy && carbonCopyFromId && carbonCopyMousePos) {
          const fromCluster = allClusters.find((c) => c.id === carbonCopyFromId);
          const fromPt = fromCluster ? clusterCenter(fromCluster) : null;
          if (fromPt) {
            svgs.push(
              <svg key="cc-drag" className="absolute inset-0 pointer-events-none" style={{ zIndex: 60 }} width={paperDims.wPx} height={paperDims.hPx} viewBox={`0 0 ${paperDims.wPx} ${paperDims.hPx}`}>
                <line x1={fromPt.x} y1={fromPt.y} x2={carbonCopyMousePos.x} y2={carbonCopyMousePos.y} stroke="#34d399" strokeWidth={2} strokeDasharray="6 3" opacity={0.8} />
                <circle cx={fromPt.x} cy={fromPt.y} r={4} fill="#10b981" />
              </svg>
            );
          }
        }

        if (editorModeIsNetwork && networkFromId && networkMousePos) {
          const fromCluster = allClusters.find((c) => c.id === networkFromId);
          const fromPt = fromCluster ? clusterCenter(fromCluster) : null;
          if (fromPt) {
            svgs.push(
              <svg key="net-drag" className="absolute inset-0 pointer-events-none" style={{ zIndex: 60 }} width={paperDims.wPx} height={paperDims.hPx} viewBox={`0 0 ${paperDims.wPx} ${paperDims.hPx}`}>
                <line x1={fromPt.x} y1={fromPt.y} x2={networkMousePos.x} y2={networkMousePos.y} stroke="#818cf8" strokeWidth={2} strokeDasharray="6 3" opacity={0.8} />
                <circle cx={fromPt.x} cy={fromPt.y} r={4} fill="#6366f1" />
              </svg>
            );
          }
        }

        return svgs.length > 0 ? svgs : null;
      })()}
    </div>
    </div>
  );
}

// ─── Context Menu ────────────────────────────────────────────────────────────

function ContextMenu({
  x, y, onDelete, onSelect, onClose,
}: {
  x: number; y: number;
  onDelete: () => void; onSelect: () => void; onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = x + rect.width > window.innerWidth ? x - rect.width : x;
    const ny = y + rect.height > window.innerHeight ? y - rect.height : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  return (
    <div ref={ref} className="fixed z-50 min-w-[140px] rounded-xl bg-white shadow-xl ring-1 ring-slate-200/80 py-1 animate-fade-in-up" style={{ top: pos.y, left: pos.x }} onClick={(e) => e.stopPropagation()}>
      <button onClick={onSelect} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors">
        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" /></svg>
        選択
      </button>
      <div className="h-px bg-slate-100 my-0.5" />
      <button onClick={onDelete} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors">
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
        削除
      </button>
    </div>
  );
}
