'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

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
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={toggleExpanded}
        className="w-full px-3 py-2.5 flex items-center gap-2 border-b border-slate-700 hover:bg-slate-700/30 transition-colors"
      >
        <ChevronDown
          className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${
            collapsed ? '-rotate-90' : ''
          }`}
        />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Dashboard</span>
      </button>

      {!collapsed && (
        <div className="p-3 border-t border-slate-700 max-h-[40vh] overflow-y-auto bg-slate-900">
          {loading ? (
            <div className="text-xs text-slate-400">Loading dashboard…</div>
          ) : error ? (
            <div className="flex items-start gap-2 text-xs text-red-400">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span className="text-xs">{error}</span>
            </div>
          ) : content ? (
            <div className="text-[10px] leading-relaxed text-slate-300 space-y-0.5">
              {content
                .split('\n')
                .slice(0, 60)
                .map((line, i) => (
                  <div key={i} className="font-mono">{line || ' '}</div>
                ))}
              {content.split('\n').length > 60 && (
                <div className="text-slate-500 italic text-[9px]">
                  …({content.split('\n').length - 60} more lines)
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
