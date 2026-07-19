'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, FolderOpen, Clock } from 'lucide-react';

interface SessionMeta {
  id: string;
  projectDir: string;
  projectLabel: string;
  filePath: string;
  lastModified: string;
  sizeBytes: number;
  preview: string;
  sessionName?: string;
  agentId?: string;
}

interface SessionBrowserProps {
  onOpen: (sessionId: string, label: string) => void;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diffMs / 60000);
  if (m < 1)    return 'just now';
  if (m < 60)   return `${m}m ago`;
  if (m < 1440) return `${Math.floor(m / 60)}h ago`;
  return `${Math.floor(m / 1440)}d ago`;
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export function SessionBrowser({ onOpen }: SessionBrowserProps) {
  const [expanded, setExpanded] = useState(false);
  const [sessions, setSessions] = useState<SessionMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('');

  const handleToggle = () => {
    console.log('[SessionBrowser] Toggle clicked, expanded:', expanded, '-> toggling');
    setExpanded(v => {
      console.log('[SessionBrowser] State updated to:', !v);
      return !v;
    });
  };

  useEffect(() => {
    console.log(`[SessionBrowser] Effect: expanded=${expanded}, sessions.length=${sessions.length}`);
    if (!expanded || sessions.length > 0) {
      if (sessions.length > 0) {
        console.log(`[SessionBrowser] Already loaded ${sessions.length} sessions, skipping fetch`);
      }
      return;
    }
    console.log('[SessionBrowser] Fetching sessions...');
    setLoading(true);
    fetch('/api/sessions')
      .then((r) => {
        console.log(`[SessionBrowser] API response status: ${r.status}`);
        return r.json();
      })
      .then((d) => {
        const loaded = d.sessions ?? [];
        console.log(`[SessionBrowser] ✓ Loaded ${loaded.length} sessions`);
        setSessions(loaded);
      })
      .catch((err) => {
        console.error('[SessionBrowser] Error loading sessions:', err);
      })
      .finally(() => setLoading(false));
  }, [expanded]);

  const filtered = filter.trim()
    ? sessions.filter(
        (s) =>
          (s.sessionName?.toLowerCase() ?? '').includes(filter.toLowerCase()) ||
          s.projectLabel.toLowerCase().includes(filter.toLowerCase()) ||
          s.preview.toLowerCase().includes(filter.toLowerCase())
      )
    : sessions;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      {/* Header */}
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <FolderOpen className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
            Past Sessions
          </span>
          {sessions.length > 0 && (
            <span className="text-xs text-slate-500">({sessions.length})</span>
          )}
        </div>
        {expanded
          ? <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
        }
      </button>

      {expanded && (
        <div className="border-t border-slate-700">
          {/* Filter */}
          <div className="px-3 py-2 border-b border-slate-700/50">
            <input
              type="text"
              placeholder="Filter sessions…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-slate-700 text-slate-200 text-xs px-2 py-1.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder-slate-500"
            />
          </div>

          {/* Session list */}
          <div className="max-h-80 overflow-y-auto">
            {loading ? (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">Loading…</div>
            ) : filtered.length === 0 ? (
              <div className="px-3 py-4 text-xs text-slate-500 text-center">
                {filter ? 'No matches' : 'No sessions found'}
              </div>
            ) : (
              filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => onOpen(s.id, s.sessionName || s.projectLabel)}
                  className="w-full text-left px-3 py-2.5 hover:bg-slate-700/60 border-b border-slate-700/30 last:border-0 transition-colors group"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <span className="text-xs font-medium text-slate-200 group-hover:text-white truncate block">
                        {s.sessionName || s.projectLabel}
                      </span>
                      {s.sessionName && (
                        <span className="text-xs text-slate-500 truncate block">
                          {s.projectLabel}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 flex-shrink-0 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(s.lastModified)}
                    </span>
                  </div>
                  {s.preview && (
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      {s.preview}
                    </p>
                  )}
                  <span className="text-xs text-slate-600 mt-0.5 block">
                    {formatSize(s.sizeBytes)}
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
