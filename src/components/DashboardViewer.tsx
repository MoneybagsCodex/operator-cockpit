'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

function DashboardContent({ markdown }: { markdown: string }) {
  // Extract priority tasks section and render as cards
  const priorityTasks = useMemo(() => {
    const lines = markdown.split('\n');
    const taskLines: string[] = [];
    let inTasks = false;

    for (const line of lines) {
      if (line.includes('Priority Tasks')) {
        inTasks = true;
        continue;
      }
      if (inTasks && line.startsWith('##')) {
        break;
      }
      if (inTasks && line.trim() && !line.startsWith('|') && !line.startsWith('---')) {
        taskLines.push(line);
      }
    }

    return taskLines.slice(0, 10);
  }, [markdown]);

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="text-[10px] font-bold uppercase tracking-widest text-blue-400 mb-2">
        Quick Tasks
      </div>

      {/* Task cards */}
      <div className="space-y-1.5">
        {priorityTasks
          .filter(line => line.trim() && !line.startsWith('#'))
          .slice(0, 5)
          .map((task, i) => {
            const cleanTask = task.replace(/^[-*]\s+/, '').trim();
            if (!cleanTask) return null;
            return (
              <div
                key={i}
                className="group flex items-start gap-2 px-2 py-1.5 rounded bg-slate-800/50 border border-slate-700/50 hover:border-blue-500/30 hover:bg-slate-800 transition-all"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0 mt-1.5" />
                <p className="text-[10px] text-slate-300 leading-tight flex-1 break-words line-clamp-2">
                  {cleanTask.length > 60 ? `${cleanTask.slice(0, 60)}…` : cleanTask}
                </p>
              </div>
            );
          })}
      </div>

      {/* Last updated */}
      <div className="text-[9px] text-slate-500 italic pt-1 border-t border-slate-700/50">
        See full dashboard for complete priority list
      </div>
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
