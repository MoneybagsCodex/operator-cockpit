'use client';

import { ModelOption } from '@/src/hooks/useAvailableModels';
import { ChevronDown } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';

interface ModelPickerProps {
  value: string;
  models: ModelOption[];
  onChange: (value: string) => void;
  className?: string;
}

export function ModelPicker({ value, models, onChange, className }: ModelPickerProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const getLabel = (): string => {
    for (const m of models) {
      if (m.submodels) {
        const sub = m.submodels.find((s) => s.value === value);
        if (sub) return `${m.label} · ${sub.label}`;
      }
      if (m.value === value) return m.label;
    }
    return value;
  };

  const select = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 ${className ?? 'bg-slate-700 text-slate-300 text-xs px-1.5 py-1 rounded border border-slate-600 hover:bg-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600'}`}
        title="Switch model"
      >
        <span>{getLabel()}</span>
        <ChevronDown className="w-3 h-3 opacity-60 flex-shrink-0" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-600 rounded shadow-xl z-50 min-w-36 py-1">
          {models.map((m) => {
            if (m.submodels) {
              const activeSub = m.submodels.find((s) => s.value === value);
              return (
                <div key={m.label}>
                  <div className="px-2.5 pt-1.5 pb-0.5 text-xs text-slate-500 font-semibold uppercase tracking-wider flex items-center gap-1">
                    {m.label}
                  </div>
                  {m.submodels.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => select(s.value)}
                      className={`w-full text-left px-4 py-1 text-xs hover:bg-slate-700 transition-colors ${
                        activeSub?.value === s.value ? 'text-blue-400 font-medium' : 'text-slate-300'
                      }`}
                    >
                      {s.label}
                    </button>
                  ))}
                  <div className="border-t border-slate-700 my-1" />
                </div>
              );
            }
            return (
              <button
                key={m.value}
                onClick={() => select(m.value)}
                className={`w-full text-left px-2.5 py-1 text-xs hover:bg-slate-700 transition-colors ${
                  m.value === value ? 'text-blue-400 font-medium' : 'text-slate-300'
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
