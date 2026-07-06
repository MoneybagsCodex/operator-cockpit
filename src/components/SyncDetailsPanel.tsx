'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, AlertCircle } from 'lucide-react';

interface Priority {
  rank: string;
  title: string;
  area: string;
  status: string;
}

interface DashboardData {
  priorities: Priority[];
  reminders: string[];
  lastUpdated: string;
}

export function SyncDetailsPanel() {
  const [expanded, setExpanded] = useState(false);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard/details')
      .then(res => res.json())
      .then(json => {
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error('[SyncDetailsPanel] Failed to fetch dashboard data:', err);
        setLoading(false);
      });
  }, []);

  const dashboardPriorities = data?.priorities || [];
  const memoryNotes = data?.reminders || [];

  return (
    <div className="w-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-semibold text-slate-300">Knowledge base sync</span>
        </div>
        <ChevronDown
          className={`w-4 h-4 text-slate-500 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </button>

      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-3 bg-slate-800/50">
          {loading ? (
            <div className="text-xs text-slate-500">Loading...</div>
          ) : (
            <>
              {/* Priorities Section */}
              {dashboardPriorities.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
                    Current Priorities
                  </h4>
                  <div className="space-y-1.5">
                    {dashboardPriorities.map((p, i) => (
                      <div key={i} className="text-xs text-slate-400 flex gap-2">
                        <span className="text-slate-500">•</span>
                        <span>
                          {p.title}{' '}
                          <span className="text-slate-500">({p.status})</span>
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Important Notes Section */}
              {memoryNotes.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
                    Key Reminders
                  </h4>
                  <div className="space-y-1.5">
                    {memoryNotes.map((note, i) => (
                      <div key={i} className="text-xs text-slate-400 flex gap-2">
                        <span className="text-amber-500">⚡</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Sync Status */}
              {data?.lastUpdated && (
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500">
                    Last synced: <span className="text-slate-400">{new Date(data.lastUpdated).toLocaleTimeString()}</span>
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
