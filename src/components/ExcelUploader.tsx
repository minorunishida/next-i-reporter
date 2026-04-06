"use client";

import { useCallback, useState } from "react";
import type { FormStructure, AnalysisResult } from "@/lib/form-structure";

type Props = {
  onParsed: (data: FormStructure) => void;
  onImported?: (data: AnalysisResult) => void;
};

export default function ExcelUploader({ onParsed, onImported }: Props) {
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const upload = useCallback(
    async (file: File) => {
      setLoading(true);
      setError(null);
      try {
        const isXml = file.name.endsWith(".xml");
        const formData = new FormData();
        formData.append("file", file);

        const endpoint = isXml ? "/api/import-xml" : "/api/parse-excel";
        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const body = await res.json();
          throw new Error(body.error ?? "解析に失敗しました");
        }

        if (isXml && onImported) {
          const data: AnalysisResult = await res.json();
          onImported(data);
        } else {
          const data: FormStructure = await res.json();
          onParsed(data);
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "エラーが発生しました");
      } finally {
        setLoading(false);
      }
    },
    [onParsed, onImported]
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
    <div className="flex flex-col items-center gap-5 w-full max-w-lg">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`
          group relative w-full rounded-lg border p-12
          flex flex-col items-center justify-center gap-4
          transition-all duration-200 cursor-pointer
          ${
            dragging
              ? "border-indigo-400 bg-indigo-50/50 ring-2 ring-indigo-100"
              : "border-slate-200 bg-white hover:border-indigo-300 hover:bg-indigo-50/30"
          }
        `}
      >
        {loading ? (
          <>
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-900 border-t-transparent" />
            <p className="text-sm text-slate-500">Excel を解析しています...</p>
          </>
        ) : (
          <>
            <svg className={`h-6 w-6 transition-colors duration-200 ${dragging ? "text-indigo-500" : "text-slate-400 group-hover:text-indigo-500"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
            </svg>
            <div className="text-center">
              <p className="text-sm text-slate-600">
                ファイルをドロップ、または<label className="text-indigo-600 hover:text-indigo-700 font-medium cursor-pointer"> ファイルを選択
                  <input
                    type="file"
                    accept=".xlsx,.xls,.xml"
                    onChange={handleFileInput}
                    className="hidden"
                  />
                </label>
              </p>
              <p className="mt-1.5 text-xs text-slate-400">
                対応形式: .xlsx, .xls, .xml (ConMas)
              </p>
            </div>
          </>
        )}
      </div>
      {error && (
        <div className="flex items-center gap-2 rounded-lg border-l-4 border-red-400 bg-red-50 px-4 py-2.5 text-sm text-red-600">
          <svg className="h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}
    </div>
  );
}
