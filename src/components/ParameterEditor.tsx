"use client";

import { useState, useCallback, useMemo } from "react";
import {
  parseInputParameters,
  serializeInputParameters,
  PARAMETER_SCHEMAS,
  type ParamFieldDef,
} from "@/lib/input-parameters";

type Props = {
  typeName: string;
  inputParameters: string;
  onChange: (newParams: string) => void;
};

/**
 * クラスタ型に応じた inputParameters のビジュアルエディタ
 *
 * スキーマが定義されている型: フォーム UI で編集
 * スキーマがない型: 生テキスト編集のみ
 */
export default function ParameterEditor({ typeName, inputParameters, onChange }: Props) {
  const [rawMode, setRawMode] = useState(false);
  const schema = PARAMETER_SCHEMAS[typeName];
  const parsed = useMemo(() => parseInputParameters(inputParameters), [inputParameters]);

  const updateField = useCallback(
    (key: string, value: string) => {
      const updated = { ...parsed, [key]: value };
      onChange(serializeInputParameters(updated));
    },
    [parsed, onChange],
  );

  // スキーマなし or RAWモード
  if (!schema || rawMode) {
    return (
      <div className="flex flex-col gap-2">
        {schema && (
          <button
            onClick={() => setRawMode(false)}
            className="self-end text-[10px] text-blue-500 hover:text-blue-700 font-medium"
          >
            フォーム表示に戻す
          </button>
        )}
        <textarea
          value={inputParameters}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs font-mono text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-100 transition-all resize-y"
          placeholder="key1=value1;key2=value2"
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] text-slate-400 font-mono">{typeName}</span>
        <button
          onClick={() => setRawMode(true)}
          className="text-[10px] text-slate-400 hover:text-blue-500 font-medium"
        >
          生テキスト
        </button>
      </div>

      {schema.fields.map((field) => (
        <FieldEditor
          key={field.key}
          field={field}
          value={parsed[field.key] ?? field.defaultValue}
          onChange={(v) => updateField(field.key, v)}
        />
      ))}
    </div>
  );
}

// ─── 個別フィールドエディタ ─────────────────────────────────────────────────

function FieldEditor({
  field,
  value,
  onChange,
}: {
  field: ParamFieldDef;
  value: string;
  onChange: (v: string) => void;
}) {
  const inputCls =
    "w-full rounded border border-slate-200 bg-slate-50/50 px-2 py-1 text-[11px] text-slate-700 focus:border-blue-300 focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-100 transition-all";

  return (
    <div className="flex items-center gap-2 py-1 px-1 rounded hover:bg-slate-50/80 transition-colors">
      <label className="text-[10px] text-slate-500 w-24 shrink-0 truncate" title={field.key}>
        {field.label}
      </label>
      <div className="flex-1 min-w-0">
        {field.type === "boolean" ? (
          <BooleanField value={value} onChange={onChange} />
        ) : field.type === "enum" ? (
          <select value={value} onChange={(e) => onChange(e.target.value)} className={inputCls}>
            {(field.options ?? []).map((opt) => (
              <option key={opt} value={opt}>
                {opt || "(なし)"}
              </option>
            ))}
          </select>
        ) : field.type === "number" ? (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          />
        ) : (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={inputCls}
          />
        )}
      </div>
    </div>
  );
}

function BooleanField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isOn = value === "1" || value === "true";
  return (
    <button
      type="button"
      onClick={() => onChange(isOn ? "0" : "1")}
      className={`relative inline-flex h-4.5 w-8 items-center rounded-full transition-colors duration-200 ${
        isOn ? "bg-blue-500" : "bg-slate-200"
      }`}
    >
      <span
        className={`inline-block h-3 w-3 rounded-full bg-white shadow-sm transition-transform duration-200 ${
          isOn ? "translate-x-[16px]" : "translate-x-[2px]"
        }`}
      />
    </button>
  );
}
