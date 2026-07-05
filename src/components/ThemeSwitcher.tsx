'use client';

import { useEffect, useState } from 'react';
import { Palette } from 'lucide-react';

// Color schemes. id is the data-scheme value; swatch is the accent.
const SCHEMES = [
  { id: 'daylight', name: 'Daylight', swatch: '#1F5EFF', dark: false },
  { id: 'dark',     name: 'Dark',     swatch: '#2FE9DB', dark: true },
  { id: 'midnight', name: 'Midnight', swatch: '#2FE9DB', dark: true },
  { id: 'nebula',   name: 'Nebula',   swatch: '#2FE9DB', dark: true },
  { id: 'haze',     name: 'Haze',     swatch: '#6202FF', dark: false },
  { id: 'linen',    name: 'Linen',    swatch: '#FB8F2C', dark: false },
  { id: 'mist',     name: 'Mist',     swatch: '#1F5EFF', dark: false },
  { id: 'ember',    name: 'Ember',    swatch: '#FB8F2C', dark: false },
  { id: 'crimson',  name: 'Crimson',  swatch: '#DC2626', dark: true },
] as const;

type SchemeId = (typeof SCHEMES)[number]['id'];

const STORAGE_KEY = 'cockpit-scheme';
const DEFAULT: SchemeId = 'mist';

export function applyStoredTheme() {
  if (typeof document === 'undefined') return;
  const saved = localStorage.getItem(STORAGE_KEY) || DEFAULT;
  document.documentElement.setAttribute('data-scheme', saved);
}

export function ThemeSwitcher() {
  const [scheme, setScheme] = useState<SchemeId>(DEFAULT);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const saved = (localStorage.getItem(STORAGE_KEY) as SchemeId) || DEFAULT;
    setScheme(saved);
    document.documentElement.setAttribute('data-scheme', saved);
  }, []);

  const pick = (id: SchemeId) => {
    setScheme(id);
    localStorage.setItem(STORAGE_KEY, id);
    document.documentElement.setAttribute('data-scheme', id);
    setOpen(false);
  };

  const active = SCHEMES.find((s) => s.id === scheme) ?? SCHEMES[0];

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Color scheme"
        className="flex items-center gap-1.5 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
      >
        <Palette className="w-3 h-3" />
        <span
          className="w-2.5 h-2.5 rounded-full border border-black/10"
          style={{ background: active.swatch }}
        />
        {active.name}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute right-0 mt-1 z-20 w-44 bg-slate-800 border border-slate-700 rounded-lg shadow-xl overflow-hidden py-1">
            {SCHEMES.map((s) => (
              <button
                key={s.id}
                onClick={() => pick(s.id)}
                className={`w-full text-left px-3 py-1.5 text-xs transition-colors hover:bg-slate-700 flex items-center gap-2 ${
                  s.id === scheme ? 'text-slate-100 font-semibold' : 'text-slate-300'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/10 flex-shrink-0"
                  style={{ background: s.swatch }}
                />
                {s.name}
                {s.id === scheme && <span className="ml-auto text-[10px] text-slate-400">●</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
