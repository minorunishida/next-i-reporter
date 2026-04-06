"use client";

import { parseSelectValues, serializeSelectValues } from "@/lib/network-utils";
import type { ValueLink } from "@/lib/form-structure";

type Props = {
  valueLinks: ValueLink[];
  parentItems: string[];
  childItems: string[];
  onChange: (valueLinks: ValueLink[]) => void;
};

export function ValueLinkEditor({ valueLinks, parentItems, childItems, onChange }: Props) {
  function addLink() {
    onChange([
      ...valueLinks,
      { parentValue: parentItems[0] ?? "", selectValues: "" },
    ]);
  }

  function removeLink(idx: number) {
    onChange(valueLinks.filter((_, i) => i !== idx));
  }

  function updateLink(idx: number, patch: Partial<ValueLink>) {
    onChange(valueLinks.map((vl, i) => (i === idx ? { ...vl, ...patch } : vl)));
  }

  function toggleChildItem(linkIdx: number, item: string, checked: boolean) {
    const current = parseSelectValues(valueLinks[linkIdx].selectValues);
    const next = checked ? [...current, item] : current.filter((v) => v !== item);
    updateLink(linkIdx, { selectValues: serializeSelectValues(next) });
  }

  return (
    <div className="space-y-3">
      {valueLinks.map((vl, i) => {
        const selectedItems = parseSelectValues(vl.selectValues);
        return (
          <div key={i} className="border border-gray-200 rounded p-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16 shrink-0">親の値</span>
              {parentItems.length > 0 ? (
                <select
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                  value={vl.parentValue}
                  onChange={(e) => updateLink(i, { parentValue: e.target.value })}
                >
                  {parentItems.map((item) => (
                    <option key={item} value={item}>{item}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                  value={vl.parentValue}
                  onChange={(e) => updateLink(i, { parentValue: e.target.value })}
                  placeholder="親の値"
                />
              )}
              <button
                onClick={() => removeLink(i)}
                className="text-red-400 hover:text-red-600 text-xs px-1"
                title="削除"
              >
                ✕
              </button>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs text-gray-500 w-16 shrink-0 pt-1">子の値</span>
              {childItems.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {childItems.map((item) => (
                    <label key={item} className="flex items-center gap-1 text-sm cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedItems.includes(item)}
                        onChange={(e) => toggleChildItem(i, item, e.target.checked)}
                        className="accent-indigo-500"
                      />
                      {item}
                    </label>
                  ))}
                </div>
              ) : (
                <input
                  className="flex-1 text-sm border border-gray-300 rounded px-2 py-1"
                  value={vl.selectValues}
                  onChange={(e) => updateLink(i, { selectValues: e.target.value })}
                  placeholder="カンマ区切り（値内の,は,,）"
                />
              )}
            </div>
          </div>
        );
      })}
      <button
        onClick={addLink}
        className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
      >
        <span className="text-base leading-none">+</span> 値連動を追加
      </button>
    </div>
  );
}
