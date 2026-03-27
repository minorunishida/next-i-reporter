"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { FormStructure, CellInfo, SheetStructure } from "@/lib/form-structure";

// --- 用紙サイズ定義 (mm) ---

const PAPER_SIZES: Record<string, { w: number; h: number; label: string }> = {
  A4: { w: 210, h: 297, label: "A4" },
  A3: { w: 297, h: 420, label: "A3" },
  B4: { w: 257, h: 364, label: "B4" },
};

/** A4 縦の表示幅 (px) を基準にスケール */
const BASE_PAPER_WIDTH_PX = 600;

type Props = {
  formStructure: FormStructure;
};

export default function FormPreview({ formStructure }: Props) {
  const [activeSheet, setActiveSheet] = useState(0);
  const sheet = formStructure.sheets[activeSheet];

  // ページ設定から初期値を取得
  const detectedPaper = sheet.pageSetup?.paperSize ?? "A4";
  const detectedOrientation = sheet.pageSetup?.orientation ?? "portrait";

  const [paperSize, setPaperSize] = useState<"A4" | "A3" | "B4">(
    detectedPaper === "other" ? "A4" : detectedPaper
  );
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(detectedOrientation);

  // シート切り替え時にページ設定を反映
  const handleSheetChange = (i: number) => {
    setActiveSheet(i);
    const s = formStructure.sheets[i];
    if (s.pageSetup) {
      setOrientation(s.pageSetup.orientation);
      if (s.pageSetup.paperSize !== "other") {
        setPaperSize(s.pageSetup.paperSize);
      }
    }
  };

  // 用紙の表示サイズ (px) を計算
  const paperDimensions = useMemo(() => {
    const size = PAPER_SIZES[paperSize] ?? PAPER_SIZES.A4;
    const wMm = orientation === "portrait" ? size.w : size.h;
    const hMm = orientation === "portrait" ? size.h : size.w;
    // A4 縦の幅を基準にスケール計算
    const scale = BASE_PAPER_WIDTH_PX / (PAPER_SIZES.A4.w); // px per mm
    const wPx = wMm * scale;
    const hPx = hMm * scale;
    return { wPx, hPx, wMm, hMm };
  }, [paperSize, orientation]);

  // テーブルのスケール係数を計算
  const tableScale = useMemo(() => {
    if (sheet.totalWidth === 0 || sheet.totalHeight === 0) return 1;
    const margins = sheet.pageSetup?.margins ?? { top: 19.1, bottom: 19.1, left: 17.8, right: 17.8 };
    const pxPerMm = BASE_PAPER_WIDTH_PX / PAPER_SIZES.A4.w;
    const marginLeftPx = margins.left * pxPerMm;
    const marginRightPx = margins.right * pxPerMm;
    const marginTopPx = margins.top * pxPerMm;
    const marginBottomPx = margins.bottom * pxPerMm;
    const availableW = paperDimensions.wPx - marginLeftPx - marginRightPx;
    const availableH = paperDimensions.hPx - marginTopPx - marginBottomPx;
    const scaleX = availableW / sheet.totalWidth;
    const scaleY = availableH / sheet.totalHeight;
    return Math.min(scaleX, scaleY, 1); // 100% 以上にはしない
  }, [sheet, paperDimensions]);

  const orientationLabel = orientation === "portrait" ? "縦" : "横";
  const sizeLabel = `${PAPER_SIZES[paperSize]?.label ?? paperSize} ${orientationLabel} ${paperDimensions.wMm}×${paperDimensions.hMm}mm`;

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200/60">
      {/* File name + sheet tabs */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50">
            <svg className="h-4 w-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-800">{formStructure.fileName}</h3>
            <p className="text-[11px] text-slate-400">{sheet.cells.length} セル検出</p>
          </div>
        </div>
      </div>

      {/* Sheet tabs */}
      {formStructure.sheets.length > 1 && (
        <div className="flex gap-1 border-b border-slate-100 pb-0">
          {formStructure.sheets.map((s, i) => (
            <button
              key={s.name}
              onClick={() => handleSheetChange(i)}
              className={`relative rounded-t-lg px-4 py-2 text-xs font-medium transition-all duration-200 ${
                i === activeSheet
                  ? "bg-white text-blue-600 shadow-sm ring-1 ring-slate-200/60 ring-b-0 -mb-px z-10"
                  : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
              }`}
            >
              {s.name}
              {i === activeSheet && (
                <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-full bg-blue-500" />
              )}
            </button>
          ))}
        </div>
      )}

      {/* Paper size selector */}
      <PaperSelector
        paperSize={paperSize}
        orientation={orientation}
        onPaperSizeChange={setPaperSize}
        onOrientationChange={setOrientation}
        sizeLabel={sizeLabel}
      />

      {/* Paper preview */}
      <div className="rounded-xl bg-slate-100 p-6 flex justify-center overflow-hidden">
        {formStructure.pdfBase64 ? (
          <PdfPagePreview
            pdfBase64={formStructure.pdfBase64}
            pageIndex={activeSheet}
            wPx={paperDimensions.wPx}
            hPx={paperDimensions.hPx}
          />
        ) : (
          <div
            className="bg-white shadow-xl ring-1 ring-slate-200/80 overflow-hidden transition-all duration-300 ease-in-out flex-shrink-0 relative"
            style={{
              width: paperDimensions.wPx,
              height: paperDimensions.hPx,
              maxWidth: "100%",
            }}
          >
            <div
              className="relative overflow-hidden"
              style={{
                width: "100%",
                height: "100%",
                padding: (() => {
                  const margins = sheet.pageSetup?.margins ?? { top: 19.1, bottom: 19.1, left: 17.8, right: 17.8 };
                  const pxPerMm = BASE_PAPER_WIDTH_PX / PAPER_SIZES.A4.w;
                  return `${margins.top * pxPerMm}px ${margins.right * pxPerMm}px ${margins.bottom * pxPerMm}px ${margins.left * pxPerMm}px`;
                })(),
              }}
            >
              <div
                className="origin-top-left"
                style={{
                  transform: `scale(${tableScale})`,
                  transformOrigin: "top left",
                  width: sheet.totalWidth,
                  height: sheet.totalHeight,
                  maxWidth: "none",
                }}
              >
                <SheetTable sheet={sheet} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cell stats */}
      <CellStats sheet={sheet} />
    </div>
  );
}

// --- Paper Size Selector ---

function PaperSelector({
  paperSize,
  orientation,
  onPaperSizeChange,
  onOrientationChange,
  sizeLabel,
}: {
  paperSize: "A4" | "A3" | "B4";
  orientation: "portrait" | "landscape";
  onPaperSizeChange: (size: "A4" | "A3" | "B4") => void;
  onOrientationChange: (o: "portrait" | "landscape") => void;
  sizeLabel: string;
}) {
  const sizes: Array<"A4" | "A3" | "B4"> = ["A4", "A3", "B4"];

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Paper size buttons */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
          用紙
        </span>
        {sizes.map((s) => (
          <button
            key={s}
            onClick={() => onPaperSizeChange(s)}
            className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200 ${
              paperSize === s
                ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 shadow-sm"
                : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Orientation toggle */}
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mr-1">
          向き
        </span>
        <button
          onClick={() => onOrientationChange("portrait")}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200 flex items-center gap-1 ${
            orientation === "portrait"
              ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 shadow-sm"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 14 18" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="1" y="1" width="12" height="16" rx="1" />
          </svg>
          縦
        </button>
        <button
          onClick={() => onOrientationChange("landscape")}
          className={`rounded-lg px-2.5 py-1 text-[11px] font-medium transition-all duration-200 flex items-center gap-1 ${
            orientation === "landscape"
              ? "bg-blue-50 text-blue-700 ring-1 ring-blue-200/60 shadow-sm"
              : "text-slate-400 hover:text-slate-600 hover:bg-slate-50"
          }`}
        >
          <svg className="h-3.5 w-3.5" viewBox="0 0 18 14" fill="none" stroke="currentColor" strokeWidth={1.5}>
            <rect x="1" y="1" width="16" height="12" rx="1" />
          </svg>
          横
        </button>
      </div>

      {/* Dimensions label */}
      <span className="ml-auto text-[11px] text-slate-400">
        {sizeLabel}
      </span>
    </div>
  );
}

// --- PDF Page Preview ---

function PdfPagePreview({ pdfBase64, pageIndex, wPx, hPx }: { pdfBase64: string; pageIndex: number; wPx: number; hPx: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const renderTaskRef = useRef<any>(null);

  useEffect(() => {
    let cancelled = false;
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
      renderTaskRef.current = null;
    }

    (async () => {
      const pdfjsLib = await import("pdfjs-dist");
      pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

      const data = Uint8Array.from(atob(pdfBase64), (c) => c.charCodeAt(0));
      const pdf = await pdfjsLib.getDocument({ data }).promise;
      const pageNum = Math.min(pageIndex + 1, pdf.numPages);
      const page = await pdf.getPage(pageNum);

      if (cancelled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      const viewport = page.getViewport({ scale: 1 });
      const scaleX = wPx / viewport.width;
      const scaleY = hPx / viewport.height;
      const scale = Math.min(scaleX, scaleY);
      const dpr = window.devicePixelRatio || 1;
      const scaledViewport = page.getViewport({ scale: scale * dpr });

      canvas.width = scaledViewport.width;
      canvas.height = scaledViewport.height;
      canvas.style.width = `${wPx}px`;
      canvas.style.height = `${hPx}px`;

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
  }, [pdfBase64, pageIndex, wPx, hPx]);

  return (
    <canvas
      ref={canvasRef}
      className="shadow-xl ring-1 ring-slate-200/80 flex-shrink-0"
      style={{ width: wPx, height: hPx }}
    />
  );
}

// --- Sheet Table ---

function SheetTable({ sheet }: { sheet: SheetStructure }) {
  // セルを row,col のグリッドに配置
  const cellGrid = new Map<string, CellInfo>();
  const mergedCells = new Set<string>(); // 結合子セル (スキップ用)

  for (const cell of sheet.cells) {
    cellGrid.set(`${cell.row},${cell.col}`, cell);
    if (cell.isMerged && cell.mergeRange) {
      const mr = cell.mergeRange;
      for (let r = mr.startRow; r <= mr.endRow; r++) {
        for (let c = mr.startCol; c <= mr.endCol; c++) {
          if (r !== cell.row || c !== cell.col) {
            mergedCells.add(`${r},${c}`);
          }
        }
      }
    }
  }

  return (
    <table className="border-collapse text-xs">
      <tbody>
        {Array.from({ length: sheet.rowCount }, (_, r) => (
          <tr key={r}>
            {Array.from({ length: sheet.colCount }, (_, c) => {
              const key = `${r},${c}`;
              if (mergedCells.has(key)) return null;

              const cell = cellGrid.get(key);
              const colSpan =
                cell?.mergeRange
                  ? cell.mergeRange.endCol - cell.mergeRange.startCol + 1
                  : 1;
              const rowSpan =
                cell?.mergeRange
                  ? cell.mergeRange.endRow - cell.mergeRange.startRow + 1
                  : 1;

              const width = sheet.colWidths[c] ?? 64;
              const height = sheet.rowHeights[r] ?? 20;

              const isEmpty = !cell?.value && !cell?.formula;

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
                    fontSize: cell?.style.fontSize
                      ? `${Math.min(cell.style.fontSize, 14)}px`
                      : undefined,
                    textAlign: cell?.style.horizontalAlignment ?? "left",
                  }}
                  className={`border border-slate-200 px-1 py-0.5 truncate ${
                    isEmpty ? "bg-amber-50/30" : ""
                  } ${cell?.formula ? "bg-blue-50/40" : ""}`}
                  title={
                    cell
                      ? `${cell.address}${cell.formula ? ` = ${cell.formula}` : ""}${
                          cell.value ? `: ${cell.value}` : ""
                        }`
                      : undefined
                  }
                >
                  {cell?.value ?? ""}
                </td>
              );
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// --- Cell Stats ---

function CellStats({ sheet }: { sheet: SheetStructure }) {
  const withValue = sheet.cells.filter((c) => c.value).length;
  const empty = sheet.cells.filter((c) => !c.value && !c.formula).length;
  const withFormula = sheet.cells.filter((c) => c.formula).length;
  const merged = sheet.cells.filter((c) => c.isMerged).length;

  const stats = [
    { label: "値あり", value: withValue, color: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" },
    { label: "空白", value: empty, color: "bg-slate-50 text-slate-500 ring-slate-200/60" },
    { label: "数式", value: withFormula, color: "bg-blue-50 text-blue-700 ring-blue-200/60" },
    { label: "結合", value: merged, color: "bg-violet-50 text-violet-700 ring-violet-200/60" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      {stats.map((s) => (
        <span
          key={s.label}
          className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[11px] font-medium ring-1 ${s.color}`}
        >
          {s.label}
          <span className="font-semibold">{s.value}</span>
        </span>
      ))}
      <span className="ml-auto text-[11px] text-slate-400">
        {Math.round(sheet.totalWidth)} x {Math.round(sheet.totalHeight)} px
      </span>
    </div>
  );
}
