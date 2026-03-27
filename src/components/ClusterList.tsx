"use client";

import type { AnalysisResult, ClusterDefinition } from "@/lib/form-structure";

type Props = {
  result: AnalysisResult;
};

function confidenceBadge(c: number) {
  if (c >= 0.9) return { label: "高", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60" };
  if (c >= 0.7) return { label: "中", className: "bg-amber-50 text-amber-700 ring-1 ring-amber-200/60" };
  return { label: "低", className: "bg-red-50 text-red-700 ring-1 ring-red-200/60" };
}

function typeLabel(typeName: string) {
  const map: Record<string, string> = {
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
  return map[typeName] ?? typeName;
}

function ClusterRow({ cluster }: { cluster: ClusterDefinition }) {
  const badge = confidenceBadge(cluster.confidence);

  return (
    <tr className="border-b border-slate-100 transition-colors hover:bg-slate-50/80">
      <td className="px-4 py-3 text-xs font-mono text-slate-400">
        {cluster.cellAddress}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-slate-800">{cluster.name}</td>
      <td className="px-4 py-3">
        <span className="inline-flex items-center rounded-lg bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 ring-1 ring-blue-200/60">
          {typeLabel(cluster.typeName)}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-slate-500 max-w-[200px] truncate">
        {cluster.value || (cluster.formula ? `=${cluster.formula}` : "—")}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-xs font-semibold ${badge.className}`}
        >
          {badge.label} {Math.round(cluster.confidence * 100)}%
        </span>
      </td>
      <td className="px-4 py-3">
        <span className={`inline-flex items-center gap-1 text-xs font-medium ${
          cluster.readOnly ? "text-slate-400" : "text-blue-600"
        }`}>
          {cluster.readOnly ? (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              読取専用
            </>
          ) : (
            <>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              入力可
            </>
          )}
        </span>
      </td>
    </tr>
  );
}

export default function ClusterList({ result }: Props) {
  const { clusters, summary } = result;

  const summaryCards = [
    { label: "クラスタ検出", value: summary.totalClusters, unit: "件", color: "from-slate-500 to-slate-600", bg: "bg-slate-50" },
    { label: "高信頼", value: summary.highConfidence, unit: "", color: "from-emerald-500 to-emerald-600", bg: "bg-emerald-50" },
    { label: "要確認", value: summary.mediumConfidence, unit: "", color: "from-amber-500 to-amber-600", bg: "bg-amber-50" },
    { label: "低信頼", value: summary.lowConfidence, unit: "", color: "from-red-500 to-red-600", bg: "bg-red-50" },
  ];

  return (
    <div className="flex flex-col gap-5">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {summaryCards.map((card) => (
          <div
            key={card.label}
            className={`rounded-xl ${card.bg} p-4 ring-1 ring-slate-200/40`}
          >
            <p className="text-[11px] font-medium text-slate-500">{card.label}</p>
            <p className={`mt-1 text-2xl font-bold bg-gradient-to-r ${card.color} bg-clip-text text-transparent`}>
              {card.value}
              {card.unit && <span className="text-sm font-medium ml-0.5">{card.unit}</span>}
            </p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200/60">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/80">
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                セル
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                名前
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                型
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                値/数式
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                信頼度
              </th>
              <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                状態
              </th>
            </tr>
          </thead>
          <tbody>
            {clusters.map((cluster) => (
              <ClusterRow key={cluster.id} cluster={cluster} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
