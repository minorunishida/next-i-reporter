"use client";

import type { ReactNode } from "react";

export type RailIcon = {
  id: string;
  icon: ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
};

type Props = {
  side: "left" | "right";
  expanded: boolean;
  onToggle: () => void;
  railIcons: RailIcon[];
  onRailIconClick?: (id: string) => void;
  title?: string;
  children: ReactNode;
};

export function SidePanel({
  side,
  expanded,
  onToggle,
  railIcons,
  onRailIconClick,
  title,
  children,
}: Props) {
  return (
    <div
      className={`flex h-full ${side === "right" ? "flex-row-reverse" : "flex-row"}`}
    >
      {/* Rail - always visible */}
      <div className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-slate-200/60 bg-slate-50/80 py-2">
        {/* Toggle button */}
        <button
          onClick={onToggle}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 transition-colors"
          title={expanded ? "パネルを閉じる" : "パネルを開く"}
        >
          <svg
            className={`h-4 w-4 transition-transform duration-200 ${
              expanded
                ? side === "left"
                  ? ""
                  : "rotate-180"
                : side === "left"
                  ? "rotate-180"
                  : ""
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>

        <div className="my-1 h-px w-6 bg-slate-200/60" />

        {/* Icon buttons */}
        {railIcons.map((item) => (
          <button
            key={item.id}
            onClick={() => onRailIconClick?.(item.id)}
            className={`relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${
              item.active
                ? "bg-blue-50 text-blue-600 ring-1 ring-blue-200/60"
                : "text-slate-400 hover:bg-slate-200/60 hover:text-slate-600"
            }`}
            title={item.label}
          >
            {item.icon}
            {item.badge != null && item.badge > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-[0.875rem] items-center justify-center rounded-full bg-blue-500 px-0.5 text-[8px] font-bold text-white">
                {item.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Expanded panel content */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          expanded ? "w-[272px] opacity-100" : "w-0 opacity-0"
        }`}
      >
        <div className="flex h-full w-[272px] flex-col bg-white">
          {/* Panel header */}
          {title && (
            <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50/60 px-3 py-2">
              <span className="text-[11px] font-semibold text-slate-600">
                {title}
              </span>
            </div>
          )}

          {/* Panel content */}
          <div className="flex-1 overflow-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
