'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

function DashboardContent({ markdown }: { markdown: string }) {
  const content = useMemo(() => {
    const lines = markdown.split('\n');
    const result: { section: string; data: string[] }[] = [];
    let currentSection = '';
    let currentData: string[] = [];

    for (let i = 0; i < lines.length && i < 100; i++) {
      const line = lines[i];

      // Section headers (##)
      if (line.startsWith('## ')) {
        if (currentSection && currentData.length > 0) {
          result.push({ section: currentSection, data: currentData });
        }
        currentSection = line.replace('## ', '').trim();
        currentData = [];
      } else if (currentSection && line.trim() && !line.startsWith('|') && !line.startsWith('---') && !line.startsWith('#')) {
        // Extract meaningful lines
        if (line.includes(':') || line.match(/^[-*]/)) {
          currentData.push(line.trim());
        }
      }
    }

    if (currentSection && currentData.length > 0) {
      result.push({ section: currentSection, data: currentData });
    }

    return result;
  }, [markdown]);

  return (
    <div className="space-y-2">
      {content.length === 0 ? (
        <div className="text-[10px] text-slate-400 italic">Loading dashboard data…</div>
      ) : (
        content.slice(0, 3).map((section, idx) => (
          <div key={idx} className="space-y-1">
            <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 px-1">
              {section.section}
            </div>
            <div className="space-y-0.5 px-1">
              {section.data.slice(0, 3).map((line, i) => {
                const cleanLine = line.replace(/^[-*]\s+/, '').trim();
                // Split on colon for key-value pairs
                const [key, ...valueParts] = cleanLine.split(':');
                const value = valueParts.join(':').trim();

                return (
                  <div key={i} className="text-[9px] leading-tight">
                    {value ? (
                      <>
                        <span className="text-slate-400">{key}:</span>{' '}
                        <span className="text-slate-300 font-medium truncate">{value.slice(0, 40)}</span>
                      </>
                    ) : (
                      <span className="text-slate-300">{cleanLine.slice(0, 50)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function DashboardViewer() {
  const [content, setContent] = useState<string>('');
  const [collapsed, setCollapsed] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    if (content) return; // Already loaded
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error(`${res.status}: ${res.statusText}`);
      const text = await res.text();
      setContent(text);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = async () => {
    const newCollapsed = !collapsed;
    setCollapsed(newCollapsed);
    if (!newCollapsed && !content && !loading) {
      await loadDashboard();
    }
  };

  return (
    <div className="bg-gradient-to-b from-slate-800/80 to-slate-900/60 rounded-lg border border-slate-700/60 overflow-hidden shadow-lg">
      <button
        onClick={toggleExpanded}
        className="w-full px-3 py-2.5 flex items-center gap-2 border-b border-slate-700/40 hover:bg-slate-700/40 transition-colors group"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 text-slate-400 group-hover:text-blue-400 ${
            collapsed ? '-rotate-90' : ''
          }`}
        />
        <span className="text-xs font-bold text-slate-300 uppercase tracking-wider group-hover:text-blue-300 transition-colors">
          Dashboard
        </span>
      </button>

      {!collapsed && (
        <div className="p-3 border-t border-slate-700/40 max-h-[50vh] overflow-y-auto bg-slate-900/40 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-pulse flex items-center gap-2">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                <span className="text-xs text-slate-400">Loading…</span>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-start gap-2 p-2 rounded bg-red-900/20 border border-red-800/40">
              <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-red-400" />
              <span className="text-xs text-red-300">{error}</span>
            </div>
          ) : content ? (
            <DashboardContent markdown={content} />
          ) : null}
        </div>
      )}
    </div>
  );
}
