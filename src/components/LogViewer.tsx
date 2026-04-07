"use client";

import { useState, useEffect, useRef, useCallback } from "react";

type LogLevel = "debug" | "info" | "warn" | "error";

type LogEntry = {
  timestamp: string;
  level: LogLevel;
  module: string;
  message: string;
  data?: Record<string, unknown>;
};

const LEVEL_COLORS: Record<LogLevel, { bg: string; text: string }> = {
  debug: { bg: "bg-slate-100", text: "text-slate-500" },
  info: { bg: "bg-blue-50", text: "text-blue-600" },
  warn: { bg: "bg-amber-50", text: "text-amber-600" },
  error: { bg: "bg-red-50", text: "text-red-600" },
};

export function LogViewer() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [dates, setDates] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [selectedModule, setSelectedModule] = useState<string>("");
  const [search, setSearch] = useState<string>("");
  const [autoScroll, setAutoScroll] = useState(true);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchLogs = useCallback(async () => {
    const params = new URLSearchParams();
    if (selectedDate) params.set("date", selectedDate);
    if (selectedLevel) params.set("level", selectedLevel);
    if (selectedModule) params.set("module", selectedModule);
    if (search) params.set("search", search);
    params.set("limit", "500");

    try {
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) return;
      const data = await res.json();
      setEntries(data.entries ?? []);
      setDates(data.dates ?? []);
      setModules(data.modules ?? []);
    } catch {
      // ignore fetch errors
    }
  }, [selectedDate, selectedLevel, selectedModule, search]);

  // Initial fetch + polling
  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [fetchLogs]);

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, autoScroll]);

  const formatTime = (ts: string) => {
    try {
      const d = new Date(ts);
      return d.toLocaleTimeString("ja-JP", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        fractionalSecondDigits: 3,
      });
    } catch {
      return ts;
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="px-3 py-2 border-b border-slate-100 flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <select
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-[10px] text-slate-700"
          >
            <option value="">今日</option>
            {dates.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
          <select
            value={selectedLevel}
            onChange={(e) => setSelectedLevel(e.target.value)}
            className="rounded border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-[10px] text-slate-700"
          >
            <option value="">全レベル</option>
            <option value="debug">debug</option>
            <option value="info">info</option>
            <option value="warn">warn</option>
            <option value="error">error</option>
          </select>
          <select
            value={selectedModule}
            onChange={(e) => setSelectedModule(e.target.value)}
            className="rounded border border-slate-200 bg-slate-50/50 px-1.5 py-1 text-[10px] text-slate-700"
          >
            <option value="">全モジュール</option>
            {modules.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="検索..."
            className="flex-1 rounded border border-slate-200 bg-slate-50/50 px-2 py-1 text-[10px] text-slate-700 placeholder:text-slate-400"
          />
          <label className="flex items-center gap-1 text-[10px] text-slate-500 cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
              className="rounded border-slate-300"
            />
            自動スクロール
          </label>
        </div>
      </div>

      {/* Log entries */}
      <div ref={scrollRef} className="flex-1 overflow-auto font-mono text-[10px]">
        {entries.length === 0 && (
          <div className="flex items-center justify-center h-full text-slate-400 text-xs">
            ログがありません
          </div>
        )}
        {entries.map((entry, i) => {
          const colors = LEVEL_COLORS[entry.level] ?? LEVEL_COLORS.info;
          const isExpanded = expandedIdx === i;
          const hasData = entry.data && Object.keys(entry.data).length > 0;

          return (
            <div
              key={i}
              className={`flex flex-col border-b border-slate-50 hover:bg-slate-50/50 ${
                entry.level === "error" ? "bg-red-50/30" : entry.level === "warn" ? "bg-amber-50/20" : ""
              }`}
            >
              <div
                className="flex items-start gap-1 px-2 py-0.5 cursor-pointer"
                onClick={() => hasData && setExpandedIdx(isExpanded ? null : i)}
              >
                <span className="text-slate-400 shrink-0 w-[70px]">
                  {formatTime(entry.timestamp)}
                </span>
                <span
                  className={`shrink-0 rounded px-1 py-0 text-[9px] font-semibold ${colors.bg} ${colors.text}`}
                >
                  {entry.level.toUpperCase().padEnd(5)}
                </span>
                <span className="shrink-0 text-indigo-500 w-[100px] truncate">
                  {entry.module}
                </span>
                <span className="text-slate-700 flex-1 break-all">
                  {entry.message}
                </span>
                {hasData && (
                  <span className="shrink-0 text-slate-300">
                    {isExpanded ? "▼" : "▶"}
                  </span>
                )}
              </div>
              {isExpanded && hasData && (
                <div className="px-2 pb-1 ml-[72px]">
                  <pre className="text-[9px] text-slate-500 bg-slate-50 rounded p-1.5 overflow-x-auto whitespace-pre-wrap">
                    {JSON.stringify(entry.data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      <div className="shrink-0 px-3 py-1 border-t border-slate-100 bg-slate-50/60 text-[9px] text-slate-400">
        {entries.length} エントリ
      </div>
    </div>
  );
}
