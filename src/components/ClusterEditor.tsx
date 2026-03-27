"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import type {
  AnalysisResult,
  ClusterDefinition,
  ClusterTypeName,
  FormStructure,
  SheetStructure,
  CellInfo,
} from "@/lib/form-structure";
import { CLUSTER_TYPES } from "@/lib/form-structure";
import { mapClusterRegionToPdf, computePrintAreaPx, computePdfContentArea } from "@/lib/print-coord-mapper";
import ClusterToolbar from "./ClusterToolbar";

// ─── Props ───────────────────────────────────────────────────────────────────

type Props = {
  analysisResult: AnalysisResult;
  formStructure: FormStructure;
  onClustersChange: (clusters: ClusterDefinition[]) => void;
};

// ─── Type labels (Japanese) ──────────────────────────────────────────────────

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

const ALL_TYPE_NAMES: ClusterTypeName[] = [
  "KeyboardText",
  "Date",
  "Time",
  "InputNumeric",
  "Calculate",
  "Select",
  "Check",
  "Image",
  "Handwriting",
];

// ─── Confidence helpers ──────────────────────────────────────────────────────

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

// ─── Paper size definitions (mm) ─────────────────────────────────────────────

const PAPER_SIZES: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: "A4" },
  A3: { w: 297, h: 420, label: "A3" },
  B4: { w: 257, h: 364, label: "B4" },
};

const BASE_PAPER_WIDTH_PX = 600;

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ClusterEditor({ analysisResult, formStructure, onClustersChange }: Props) {
  const clusters = analysisResult.clusters;

  // --- Local state ---
  const [activeSheet, setActiveSheet] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<ClusterTypeName | "all">("all");
  const [filterConfidence, setFilterConfidence] = useState<"all" | "high" | "medium" | "low">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [contextMenuPos, setContextMenuPos] = useState<{ x: number; y: number; clusterId: string } | null>(null);
  const [zoom, setZoom] = useState(1.0);

  const handleZoomIn = useCallback(() => setZoom((z) => Math.min(3.0, Math.round((z + 0.1) * 10) / 10)), []);
  const handleZoomOut = useCallback(() => setZoom((z) => Math.max(0.5, Math.round((z - 0.1) * 10) / 10)), []);
  const handleZoomReset = useCallback(() => setZoom(1.0), []);

  // --- Paper state ---
  const initialSheet = formStructure.sheets[0];
  const [paperSize, setPaperSize] = useState<"A4" | "A3" | "B4">(
    initialSheet?.pageSetup?.paperSize === "other" ? "A4" : (initialSheet?.pageSetup?.paperSize ?? "A4")
  );
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    initialSheet?.pageSetup?.orientation ?? "portrait"
  );

  // --- Derived ---
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

  const selectedCluster = useMemo(() => clusters.find((c) => c.id === selectedId) ?? null, [clusters, selectedId]);

  // --- Handlers ---
  const updateCluster = useCallback(
    (id: string, patch: Partial<ClusterDefinition>) => {
      const next = clusters.map((c) => (c.id === id ? { ...c, ...patch } : c));
      onClustersChange(next);
    },
    [clusters, onClustersChange]
  );

  const deleteCluster = useCallback(
    (id: string) => {
      onClustersChange(clusters.filter((c) => c.id !== id));
      if (selectedId === id) setSelectedId(null);
      setSelectedIds((prev) => { const s = new Set(prev); s.delete(id); return s; });
    },
    [clusters, onClustersChange, selectedId]
  );

  const handleBulkDelete = useCallback(() => {
    if (selectedIds.size === 0) return;
    onClustersChange(clusters.filter((c) => !selectedIds.has(c.id)));
    if (selectedId && selectedIds.has(selectedId)) setSelectedId(null);
    setSelectedIds(new Set());
  }, [clusters, onClustersChange, selectedId, selectedIds]);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(filteredClusters.map((c) => c.id)));
  }, [filteredClusters]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleClusterClick = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      setSelectedId(id);
      // Shift or Ctrl/Cmd for multi-select
      if (e.shiftKey || e.metaKey || e.ctrlKey) {
        setSelectedIds((prev) => {
          const s = new Set(prev);
          if (s.has(id)) s.delete(id);
          else s.add(id);
          return s;
        });
      } else {
        setSelectedIds(new Set([id]));
      }
    },
    []
  );

  const handleContextMenu = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenuPos({ x: e.clientX, y: e.clientY, clusterId: id });
    },
    []
  );

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenuPos) return;
    const handler = () => setContextMenuPos(null);
    window.addEventListener("click", handler);
    return () => window.removeEventListener("click", handler);
  }, [contextMenuPos]);

  // Deselect on background click
  const handleBackgroundClick = useCallback(() => {
    setSelectedId(null);
    setSelectedIds(new Set());
  }, []);

  return (
    <div className="flex flex-col gap-4 animate-fade-in-up">
      {/* Toolbar */}
      <ClusterToolbar
        clusters={sheetClusters}
        selectedIds={selectedIds}
        filterType={filterType}
        filterConfidence={filterConfidence}
        searchQuery={searchQuery}
        onFilterTypeChange={setFilterType}
        onFilterConfidenceChange={setFilterConfidence}
        onSearchChange={setSearchQuery}
        onSelectAll={handleSelectAll}
        onDeselectAll={handleDeselectAll}
        onBulkDelete={handleBulkDelete}
      />

      {/* Sheet tabs */}
      {formStructure.sheets.length > 1 && (
        <div className="flex gap-1">
          {formStructure.sheets.map((s, i) => {
            const count = clusters.filter((c) => c.sheetNo === i).length;
            return (
              <button
                key={s.name}
                onClick={() => {
                  setActiveSheet(i);
                  setSelectedId(null);
                  setSelectedIds(new Set());
                  const s2 = formStructure.sheets[i];
                  if (s2?.pageSetup) {
                    setOrientation(s2.pageSetup.orientation);
                    if (s2.pageSetup.paperSize !== "other") setPaperSize(s2.pageSetup.paperSize);
                  }
                }}
                className={`relative rounded-t-xl px-4 py-2 text-xs font-medium transition-all duration-200 ${
                  i === activeSheet
                    ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/60 -mb-px z-10"
                    : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
                }`}
              >
                <span>{s.name}</span>
                <span className={`ml-1.5 inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[9px] font-semibold ${
                  i === activeSheet ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-400"
                }`}>
                  {count}
                </span>
                {i === activeSheet && (
                  <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blue-500" />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* Split pane */}
      <div className="flex gap-4 min-h-[500px]">
        {/* LEFT: Visual preview */}
        <div className="flex-1 min-w-0 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
            </svg>
            <span className="text-[11px] font-medium text-slate-500">ビジュアルプレビュー</span>
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={handleZoomOut}
                disabled={zoom <= 0.5}
                className="rounded-lg px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-150"
                title="ズームアウト"
              >
                −
              </button>
              <button
                onClick={handleZoomReset}
                className="rounded-lg px-1.5 py-0.5 text-[10px] font-medium text-slate-500 hover:bg-slate-100 transition-all duration-150 min-w-[38px] text-center"
                title="ズームリセット"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                onClick={handleZoomIn}
                disabled={zoom >= 3.0}
                className="rounded-lg px-1.5 py-0.5 text-[11px] font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition-all duration-150"
                title="ズームイン"
              >
                +
              </button>
            </div>
          </div>
          {/* Paper selector */}
          <div className="flex items-center gap-3 px-4 py-2 border-b border-slate-100 flex-wrap">
            <div className="flex items-center gap-1">
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
            <div className="flex items-center gap-1">
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
          </div>
          <div
            className="flex-1 overflow-auto bg-slate-100 p-4 flex justify-center"
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
              selectedId={selectedId}
              selectedIds={selectedIds}
              onClusterClick={handleClusterClick}
              onContextMenu={handleContextMenu}
              onUpdateCluster={updateCluster}
              paperSize={paperSize}
              orientation={orientation}
              pdfBase64={formStructure.pdfBase64}
              activeSheetIndex={activeSheet}
              zoom={zoom}
            />
          </div>
        </div>

        {/* RIGHT: Property panel */}
        <div className="w-80 shrink-0 rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60 overflow-hidden flex flex-col">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-100 bg-slate-50/60">
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <span className="text-[11px] font-medium text-slate-500">プロパティ</span>
          </div>
          <div className="flex-1 overflow-auto">
            {selectedCluster ? (
              <PropertyPanel
                cluster={selectedCluster}
                onUpdate={(patch) => updateCluster(selectedCluster.id, patch)}
                onDelete={() => deleteCluster(selectedCluster.id)}
              />
            ) : (
              <EmptyPropertyPanel selectedCount={selectedIds.size} />
            )}
          </div>
        </div>
      </div>

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
            setSelectedId(contextMenuPos.clusterId);
            setSelectedIds(new Set([contextMenuPos.clusterId]));
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
  // Corner handles
  { edges: ["top", "left"], cursor: "nw-resize", position: { top: -5, left: -5 } },
  { edges: ["top", "right"], cursor: "ne-resize", position: { top: -5, right: -5 } },
  { edges: ["bottom", "left"], cursor: "sw-resize", position: { bottom: -5, left: -5 } },
  { edges: ["bottom", "right"], cursor: "se-resize", position: { bottom: -5, right: -5 } },
  // Edge handles
  { edges: ["top"], cursor: "n-resize", position: { top: -5, left: "50%", marginLeft: -5 } },
  { edges: ["bottom"], cursor: "s-resize", position: { bottom: -5, left: "50%", marginLeft: -5 } },
  { edges: ["left"], cursor: "w-resize", position: { top: "50%", left: -5, marginTop: -5 } },
  { edges: ["right"], cursor: "e-resize", position: { top: "50%", right: -5, marginTop: -5 } },
];

const MIN_CLUSTER_SIZE_PX = 10;

function ResizeHandles({
  cluster,
  tableScale,
  usePdfMode,
  sheet,
  paperDims,
  zoom,
  onUpdateCluster,
}: {
  cluster: ClusterDefinition;
  tableScale: number;
  usePdfMode: boolean;
  sheet: SheetStructure;
  paperDims: { wPx: number; hPx: number; pxPerMm: number };
  zoom: number;
  onUpdateCluster: (id: string, patch: Partial<ClusterDefinition>) => void;
}) {
  const [resizingEdges, setResizingEdges] = useState<ResizeEdge[] | null>(null);

  const handleMouseDown = useCallback(
    (edges: ResizeEdge[], e: React.MouseEvent) => {
      e.stopPropagation();
      e.preventDefault();

      const startX = e.clientX;
      const startY = e.clientY;
      const startRegion = { ...cluster.region };

      setResizingEdges(edges);

      // Compute the conversion factor: screen px -> Excel px
      // In table mode: excelDelta = screenDelta / (tableScale * zoom)
      // In PDF mode: need to reverse the PDF mapping
      let scaleScreenToExcelX: number;
      let scaleScreenToExcelY: number;

      if (usePdfMode && sheet.printMeta) {
        // Import dynamically avoided -- use inline reverse mapping
        // From mapClusterRegionToPdf:
        //   pdfNorm = (content.left + relX * content.width) / pageW
        //   screenPx = pdfNorm * paperDims.wPx
        // Where relX = (excelPx - paPx.left) / paPx.width
        // So: screenPx = ((content.left + ((excelPx - paPx.left) / paPx.width) * content.width) / pageW) * paperDims.wPx
        // d(screenPx)/d(excelPx) = (content.width / paPx.width / pageW) * paperDims.wPx
        // Therefore: excelDelta = screenDelta / ((content.width / paPx.width / pageW) * paperDims.wPx * zoom)
        const paPx = computePrintAreaPx(sheet, sheet.printMeta!);
        const content = computePdfContentArea(sheet.printMeta!);
        const pageW = sheet.printMeta!.pdfPageWidthPt;
        const pageH = sheet.printMeta!.pdfPageHeightPt;

        scaleScreenToExcelX = 1 / ((content.width / paPx.width / pageW) * paperDims.wPx * zoom);
        scaleScreenToExcelY = 1 / ((content.height / paPx.height / pageH) * paperDims.hPx * zoom);
      } else {
        scaleScreenToExcelX = 1 / (tableScale * zoom);
        scaleScreenToExcelY = 1 / (tableScale * zoom);
      }

      const handleMouseMove = (ev: MouseEvent) => {
        const dx = (ev.clientX - startX) * scaleScreenToExcelX;
        const dy = (ev.clientY - startY) * scaleScreenToExcelY;

        const newRegion = { ...startRegion };

        for (const edge of edges) {
          switch (edge) {
            case "top":
              newRegion.top = startRegion.top + dy;
              break;
            case "bottom":
              newRegion.bottom = startRegion.bottom + dy;
              break;
            case "left":
              newRegion.left = startRegion.left + dx;
              break;
            case "right":
              newRegion.right = startRegion.right + dx;
              break;
          }
        }

        // Enforce minimum size
        if (newRegion.right - newRegion.left < MIN_CLUSTER_SIZE_PX) {
          if (edges.includes("left")) {
            newRegion.left = newRegion.right - MIN_CLUSTER_SIZE_PX;
          } else {
            newRegion.right = newRegion.left + MIN_CLUSTER_SIZE_PX;
          }
        }
        if (newRegion.bottom - newRegion.top < MIN_CLUSTER_SIZE_PX) {
          if (edges.includes("top")) {
            newRegion.top = newRegion.bottom - MIN_CLUSTER_SIZE_PX;
          } else {
            newRegion.bottom = newRegion.top + MIN_CLUSTER_SIZE_PX;
          }
        }

        onUpdateCluster(cluster.id, { region: newRegion });
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
    [cluster, tableScale, usePdfMode, sheet, paperDims, zoom, onUpdateCluster]
  );

  const isCorner = (edges: ResizeEdge[]) => edges.length === 2;

  return (
    <>
      {/* Move handle — covers the cluster interior */}
      <div
        onMouseDown={(e) => handleMouseDown(["top", "bottom", "left", "right"], e)}
        className="absolute inset-1 z-30 cursor-move"
      />
      {/* Resize handles — corners and edges */}
      {RESIZE_HANDLES.map((handle, i) => (
        <div
          key={i}
          onMouseDown={(e) => handleMouseDown(handle.edges, e)}
          className="absolute z-40"
          style={{
            ...handle.position,
            width: 10,
            height: 10,
            cursor: handle.cursor,
          }}
        >
          <div
            className={`absolute inset-0 m-auto rounded-full bg-blue-500 ring-2 ring-white ${
              resizingEdges && resizingEdges.join() === handle.edges.join()
                ? "scale-125"
                : ""
            } transition-transform duration-100`}
            style={{
              width: isCorner(handle.edges) ? 8 : 6,
              height: isCorner(handle.edges) ? 8 : 6,
            }}
          />
        </div>
      ))}
      {resizingEdges && (
        <div className="absolute inset-0 rounded bg-blue-500/5 pointer-events-none ring-2 ring-blue-400/40" />
      )}
    </>
  );
}

// ─── Visual Preview ──────────────────────────────────────────────────────────

function VisualPreview({
  sheet,
  clusters,
  selectedId,
  selectedIds,
  onClusterClick,
  onContextMenu,
  onUpdateCluster,
  paperSize,
  orientation,
  pdfBase64,
  activeSheetIndex,
  zoom = 1,
}: {
  sheet: SheetStructure;
  clusters: ClusterDefinition[];
  selectedId: string | null;
  selectedIds: Set<string>;
  onClusterClick: (id: string, e: React.MouseEvent) => void;
  onContextMenu: (id: string, e: React.MouseEvent) => void;
  onUpdateCluster: (id: string, patch: Partial<ClusterDefinition>) => void;
  paperSize: "A4" | "A3" | "B4";
  orientation: "portrait" | "landscape";
  pdfBase64?: string;
  activeSheetIndex: number;
  zoom?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const usePdfMode = !!pdfBase64 && !!sheet.printMeta;

  // Paper dimensions in px
  const paperDims = useMemo(() => {
    const sz = PAPER_SIZES[paperSize] ?? PAPER_SIZES.A4;
    const wMm = orientation === "portrait" ? sz.w : sz.h;
    const hMm = orientation === "portrait" ? sz.h : sz.w;
    const pxPerMm = BASE_PAPER_WIDTH_PX / PAPER_SIZES.A4.w;
    return { wPx: wMm * pxPerMm, hPx: hMm * pxPerMm, pxPerMm };
  }, [paperSize, orientation]);

  // Table scale (for fallback HTML mode)
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

  // Render PDF page to canvas
  const renderTaskRef = useRef<any>(null);
  useEffect(() => {
    if (!usePdfMode || !pdfBase64 || !canvasRef.current) return;
    let cancelled = false;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

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

  // Build cell grid (for fallback HTML mode)
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
            if (r !== cell.row || c !== cell.col) {
              merged.add(`${r},${c}`);
            }
          }
        }
      }
    }
    return { grid, merged };
  }, [sheet.cells, usePdfMode]);

  // Drag-to-move state

  // Cluster overlay renderer (shared between both modes)
  const renderCluster = (cluster: ClusterDefinition) => {
    const isSelected = cluster.id === selectedId;
    const isInGroup = selectedIds.has(cluster.id);
    const cc = confidenceColor(cluster.confidence);

    let top: number, left: number, width: number, height: number;

    if (usePdfMode && sheet.printMeta) {
      const mapped = mapClusterRegionToPdf(cluster.region, sheet, sheet.printMeta);
      if (!mapped) return null;
      top = mapped.top * paperDims.hPx;
      left = mapped.left * paperDims.wPx;
      width = (mapped.right - mapped.left) * paperDims.wPx;
      height = (mapped.bottom - mapped.top) * paperDims.hPx;
    } else {
      top = cluster.region.top * tableScale;
      left = cluster.region.left * tableScale;
      width = (cluster.region.right - cluster.region.left) * tableScale;
      height = (cluster.region.bottom - cluster.region.top) * tableScale;
    }

    if (width < 1 || height < 1) return null;

    return (
      <div
        key={cluster.id}
        onClick={(e) => onClusterClick(cluster.id, e)}
        onContextMenu={(e) => onContextMenu(cluster.id, e)}
        className="absolute cursor-default transition-all duration-150"
        style={{
          top,
          left,
          width,
          height,
          backgroundColor: cc.bg,
          border: isSelected
            ? "2px solid rgb(59,130,246)"
            : isInGroup
              ? "2px solid rgb(147,197,253)"
              : `1.5px solid ${cc.border}`,
          borderRadius: 3,
          zIndex: isSelected ? 30 : isInGroup ? 20 : 10,
          boxShadow: isSelected
            ? "0 0 0 3px rgba(59,130,246,0.2)"
              : undefined,
        }}
        title={`${cluster.name} (${TYPE_LABELS[cluster.typeName]}) — ${Math.round(cluster.confidence * 100)}%`}
      >
        {width > 40 && height > 14 && (
          <span
            className="absolute inset-0 flex items-center justify-center text-center leading-none pointer-events-none select-none truncate px-0.5"
            style={{ fontSize: Math.min(10, height * 0.5, width * 0.12) }}
          >
            <span className="bg-white/80 rounded px-0.5 py-px text-slate-700 font-medium">
              {cluster.name.length > 12 ? cluster.name.slice(0, 11) + "..." : cluster.name}
            </span>
          </span>
        )}
        {isSelected && (
          <ResizeHandles
            cluster={cluster}
            tableScale={tableScale}
            usePdfMode={usePdfMode}
            sheet={sheet}
            paperDims={paperDims}
            zoom={zoom}
            onUpdateCluster={onUpdateCluster}
          />
        )}
      </div>
    );
  };

  return (
    <div
      style={{
        width: paperDims.wPx * zoom,
        height: paperDims.hPx * zoom,
        flexShrink: 0,
      }}
    >
    <div
      ref={containerRef}
      className="bg-white shadow-xl ring-1 ring-slate-200/80 flex-shrink-0 relative transition-all duration-300 ease-in-out"
      style={{
        width: paperDims.wPx,
        height: paperDims.hPx,
        transform: `scale(${zoom})`,
        transformOrigin: "top center",
      }}
    >
      {usePdfMode ? (
        <>
          {/* PDF background */}
          <canvas ref={canvasRef} className="absolute top-0 left-0" />
          {/* Cluster overlays — positioned relative to the full PDF page */}
          {clusters.map(renderCluster)}
        </>
      ) : (
        <>
          {/* Fallback: HTML table mode */}
          <div
            className="absolute overflow-hidden"
            style={{
              top: marginPx.top,
              left: marginPx.left,
              right: marginPx.right,
              bottom: marginPx.bottom,
            }}
          >
            <div
              className="absolute top-0 left-0 origin-top-left"
              style={{
                transform: `scale(${tableScale})`,
                width: sheet.totalWidth,
                height: sheet.totalHeight,
              }}
            >
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
                          <td
                            key={c}
                            colSpan={colSpan > 1 ? colSpan : undefined}
                            rowSpan={rowSpan > 1 ? rowSpan : undefined}
                            style={{
                              minWidth: width,
                              height,
                              backgroundColor: cell?.style.bgColor ?? undefined,
                              color: cell?.style.fontColor ?? undefined,
                              fontWeight: cell?.style.bold ? "bold" : undefined,
                              fontSize: cell?.style.fontSize ? `${Math.min(cell.style.fontSize, 11)}px` : undefined,
                              textAlign: cell?.style.horizontalAlignment ?? "left",
                            }}
                            className="border border-slate-200/70 px-0.5 py-0 truncate leading-tight"
                          >
                            {cell?.value ?? ""}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {clusters.map(renderCluster)}
          </div>
        </>
      )}
    </div>
    </div>
  );
}

// ─── Property Panel ──────────────────────────────────────────────────────────

function PropertyPanel({
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
          <span className="text-[10px] font-mono text-slate-400">{cluster.cellAddress}</span>
          <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ${cc.badgeCls}`}>
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
            onUpdate({ typeName, type: CLUSTER_TYPES[typeName] });
          }}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-sm text-slate-800 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all"
        >
          {ALL_TYPE_NAMES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
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
                cluster.readOnly ? "translate-x-[18px]" : "translate-x-[3px]"
              }`}
            />
          </button>
        </div>
        <p className="mt-1 text-[10px] text-slate-400">
          {cluster.readOnly ? "ユーザーは値を変更できません" : "ユーザーが値を入力できます"}
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

      {/* Region info */}
      <div className="px-4 py-3">
        <label className="block text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">
          領域 (px)
        </label>
        <div className="grid grid-cols-2 gap-2">
          {(["top", "bottom", "left", "right"] as const).map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <span className="text-[10px] text-slate-400 w-10">{key}</span>
              <span className="text-[11px] font-mono text-slate-600">{Math.round(cluster.region[key])}</span>
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
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          このクラスタを削除
        </button>
      </div>
    </div>
  );
}

// ─── Empty Property Panel ────────────────────────────────────────────────────

function EmptyPropertyPanel({ selectedCount }: { selectedCount: number }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 px-6 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-slate-50 ring-1 ring-slate-200/60">
        <svg className="h-5 w-5 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
        </svg>
      </div>
      <div>
        <p className="text-xs font-medium text-slate-500">クラスタを選択してください</p>
        <p className="mt-1 text-[10px] text-slate-400">
          左のプレビューでクラスタをクリックするとプロパティを編集できます
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

// ─── Context Menu ────────────────────────────────────────────────────────────

function ContextMenu({
  x,
  y,
  onDelete,
  onSelect,
  onClose,
}: {
  x: number;
  y: number;
  onDelete: () => void;
  onSelect: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Adjust position if near viewport edge
  const [pos, setPos] = useState({ x, y });
  useEffect(() => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const nx = x + rect.width > window.innerWidth ? x - rect.width : x;
    const ny = y + rect.height > window.innerHeight ? y - rect.height : y;
    setPos({ x: nx, y: ny });
  }, [x, y]);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] rounded-xl bg-white shadow-xl ring-1 ring-slate-200/80 py-1 animate-fade-in-up"
      style={{ top: pos.y, left: pos.x }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onSelect}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50 transition-colors"
      >
        <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5" />
        </svg>
        選択
      </button>
      <div className="h-px bg-slate-100 my-0.5" />
      <button
        onClick={onDelete}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors"
      >
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
        削除
      </button>
    </div>
  );
}
