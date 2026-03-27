"use client";

import { useCallback, useState } from "react";
import type { FormStructure } from "@/lib/form-structure";

type Props = {
  onParsed: (data: FormStructure) => void;
};

export default function ExcelUploader({ onParsed }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch("/api/parse-excel", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "解析に失敗しました");
        }
        const data: FormStructure = await res.json();
        onParsed(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    },
    [onParsed]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) upload(file);
    },
    [upload]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) upload(file);
    },
    [upload]
  );

  return (
    <div className="flex flex-col items-center gap-6 w-full max-w-lg">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          group relative w-full rounded-2xl border-2 border-dashed p-14
          flex flex-col items-center justify-center gap-5
          transition-all duration-300 cursor-pointer
          ${
            dragging
              ? "border-blue-400 bg-blue-50/80 shadow-lg shadow-blue-100 scale-[1.01]"
              : "border-slate-200 bg-white/60 hover:border-blue-300 hover:bg-white hover:shadow-lg hover:shadow-slate-100"
          }
        `}
      >
        {loading ? (
          <>
            <div className="relative">
              <div className="h-14 w-14 animate-spin rounded-full border-[3px] border-blue-500 border-t-transparent" />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-8 w-8 rounded-full bg-blue-50" />
              </div>
            </div>
            <p className="text-sm font-medium text-slate-500">Excel を解析しています...</p>
          </>
        ) : (
          <>
            <div className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
              dragging
                ? "bg-blue-100 shadow-inner"
                : "bg-gradient-to-br from-slate-50 to-slate-100 group-hover:from-blue-50 group-hover:to-indigo-50 shadow-sm"
            }`}>
              <svg className={`h-7 w-7 transition-colors duration-300 ${dragging ? "text-blue-500" : "text-slate-400 group-hover:text-blue-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-slate-600">
                Excel ファイルをここにドラッグ&ドロップ
              </p>
              <p className="mt-1 text-xs text-slate-400">または</p>
            </div>
            <label className="rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md shadow-blue-200 hover:from-blue-600 hover:to-indigo-700 hover:shadow-lg hover:shadow-blue-200 hover:-translate-y-0.5 active:translate-y-0 cursor-pointer transition-all duration-200">
              ファイルを選択
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileInput}
                className="hidden"
              />
            </label>
            <p className="text-[11px] text-slate-400">
              対応形式: .xlsx, .xls
            </p>
          </>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2.5 text-sm text-red-600 ring-1 ring-red-100">
          <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
