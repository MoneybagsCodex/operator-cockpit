'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';
import { marked } from 'marked';

function DashboardContent({ markdown }: { markdown: string }) {
  const html = useMemo(() => {
    // Take only first ~30 lines for sidebar display
    const lines = markdown.split('\n').slice(0, 50).join('\n');
    return marked(lines);
  }, [markdown]);

  return (
    <div className="prose prose-invert prose-sm max-w-none text-slate-300">
      <style>{`
        .prose-dashboard h1 { @apply text-sm font-bold text-slate-100 mt-2 mb-1; }
        .prose-dashboard h2 { @apply text-xs font-bold text-slate-200 mt-1.5 mb-0.5; }
        .prose-dashboard h3 { @apply text-xs font-semibold text-slate-300 mt-1 mb-0.5; }
        .prose-dashboard p { @apply text-xs text-slate-400 my-1; }
        .prose-dashboard ul { @apply text-xs text-slate-400 my-1 ml-3; }
        .prose-dashboard li { @apply my-0.5; }
        .prose-dashboard table { @apply text-[10px] my-1; }
        .prose-dashboard th { @apply bg-slate-800 text-slate-200 px-1 py-0.5; }
        .prose-dashboard td { @apply border border-slate-700 px-1 py-0.5; }
        .prose-dashboard code { @apply bg-slate-800 px-1 text-slate-300 font-mono text-[9px]; }
        .prose-dashboard strong { @apply text-slate-200; }
        .prose-dashboard em { @apply text-slate-300 italic; }
      `}</style>
      <div
        className="prose-dashboard text-xs leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
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
        <div className="p-3 border-t border-slate-700 max-h-[45vh] overflow-y-auto bg-slate-900">
          {loading ? (
            <div className="text-xs text-slate-400">Loading dashboard…</div>
          ) : error ? (
            <div className="flex items-start gap-2 text-xs text-red-400">
              <AlertCircle className="w-3 h-3 flex-shrink-0 mt-0.5" />
              <span className="text-xs">{error}</span>
            </div>
          ) : content ? (
            <DashboardContent markdown={content} />
          ) : null}
        </div>
      )}
    </div>
  );
}
