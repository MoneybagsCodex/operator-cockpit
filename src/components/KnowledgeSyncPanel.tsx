'use client';

import { useState, useEffect } from 'react';
import { ChevronDown, CheckCircle2, AlertCircle, Info } from 'lucide-react';

interface FileChange {
  type: 'changed' | 'added' | 'removed';
  before?: string;
  after?: string;
  text?: string;
}

interface FileSyncInfo {
  file: string;
  source: 'uncommitted' | 'commit' | 'none';
  commitMessage?: string;
  commitDate?: string;
  changes: FileChange[];
  truncated: boolean;
  summary?: string[]; // plain-English bullets from Haiku — preferred display when present
}

interface SyncCheckResult {
  timestamp: string;
  flags: string[];
  warnings: string[];
  errors: string[];
  fileChanges?: FileSyncInfo[];
}

interface Priority {
  rank: string;
  title: string;
  area: string;
  status: string;
}

interface DashboardData {
  priorities: Priority[];
  reminders: string[];
}

// One consolidated "Knowledge base sync" panel — replaces what used to be two
// separate, redundant pieces (a status badge and a details panel, both saying
// "synced" with no connection to each other). This shows: overall status,
// exactly what changed and where (real diff content, not just "file is old"),
// and the current priorities/reminders those files encode.
export function KnowledgeSyncPanel() {
  const [expanded, setExpanded] = useState(false);
  const [sync, setSync] = useState<SyncCheckResult | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/sync-check').then((r) => r.json()),
      fetch('/api/dashboard/details').then((r) => r.json()),
    ])
      .then(([syncData, dashData]) => {
        setSync(syncData);
        setDashboard(dashData);
      })
      .catch((err) => console.error('[KnowledgeSyncPanel] Failed to load:', err))
      .finally(() => setLoading(false));
  }, []);

  const hasIssues = !!sync && (sync.errors.length > 0 || sync.warnings.length > 0 || sync.flags.length > 0);
  const statusColor = !sync ? 'text-slate-500' : sync.errors.length > 0 ? 'text-red-400' : hasIssues ? 'text-amber-400' : 'text-green-400';
  const StatusIcon = !sync ? Info : sync.errors.length > 0 ? AlertCircle : hasIssues ? AlertCircle : CheckCircle2;

  return (
    <div className="w-full bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-700/50 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0">
          <StatusIcon className={`w-4 h-4 flex-shrink-0 ${statusColor}`} />
          <span className="text-sm font-semibold text-slate-300 truncate">Knowledge base sync</span>
          {!loading && (
            <span className={`text-xs flex-shrink-0 ${statusColor}`}>
              {hasIssues ? `${sync!.errors.length + sync!.warnings.length + sync!.flags.length} issue${sync!.errors.length + sync!.warnings.length + sync!.flags.length === 1 ? '' : 's'}` : 'in sync'}
            </span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-500 flex-shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-slate-700 px-4 py-3 space-y-3 bg-slate-800/50">
          {loading ? (
            <div className="text-xs text-slate-500">Loading…</div>
          ) : (
            <>
              {hasIssues && (
                <div className="space-y-1.5">
                  {sync!.errors.map((e, i) => (
                    <div key={`e${i}`} className="text-xs text-red-300 flex gap-1.5"><span>⚠</span><span>{e}</span></div>
                  ))}
                  {sync!.warnings.map((w, i) => (
                    <div key={`w${i}`} className="text-xs text-amber-300 flex gap-1.5"><span>⚠</span><span>{w}</span></div>
                  ))}
                  {sync!.flags.map((f, i) => (
                    <div key={`f${i}`} className="text-xs text-slate-400 flex gap-1.5"><span>·</span><span>{f}</span></div>
                  ))}
                </div>
              )}

              {/* What changed, and where — the actual point of this panel. */}
              {sync?.fileChanges?.map((fc) => (
                <div key={fc.file}>
                  <div className="flex items-center gap-2 mb-1">
                    <h4 className="text-xs font-semibold text-slate-300">{fc.file}</h4>
                    {fc.source === 'uncommitted' && (
                      <span className="text-[10px] uppercase tracking-wide text-amber-400">uncommitted</span>
                    )}
                    {fc.source === 'commit' && (
                      <span className="text-[10px] text-slate-500 truncate">
                        last commit {fc.commitDate} — {fc.commitMessage}
                      </span>
                    )}
                  </div>
                  {fc.changes.length === 0 ? (
                    <p className="text-xs text-slate-600 pl-1">No changes on record.</p>
                  ) : fc.summary && fc.summary.length > 0 ? (
                    <div className="space-y-1 pl-1">
                      {fc.summary.map((bullet, i) => (
                        <div key={i} className="text-xs text-slate-400 flex gap-1.5">
                          <span className="text-slate-500">•</span>
                          <span>{bullet}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-1 pl-1 font-mono">
                      {fc.changes.map((c, i) => (
                        <div key={i} className="text-[11px] leading-snug">
                          {c.type === 'changed' && (
                            <>
                              <div className="text-red-400/80 truncate">− {c.before}</div>
                              <div className="text-green-400/80 truncate">+ {c.after}</div>
                            </>
                          )}
                          {c.type === 'added' && <div className="text-green-400/80 truncate">+ {c.after}</div>}
                          {c.type === 'removed' && <div className="text-red-400/80 truncate">− {c.text}</div>}
                        </div>
                      ))}
                      {fc.truncated && <p className="text-[10px] text-slate-600">+ more changes not shown</p>}
                    </div>
                  )}
                </div>
              ))}

              {/* What the files currently say — supplementary context, not a duplicate. */}
              {dashboard && dashboard.priorities.length > 0 && (
                <div className="pt-2 border-t border-slate-700/50">
                  <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">Current Priorities</h4>
                  <div className="space-y-1.5">
                    {dashboard.priorities.map((p, i) => (
                      <div key={i} className="text-xs text-slate-400 flex gap-2">
                        <span className="text-slate-500">•</span>
                        <span>{p.title} <span className="text-slate-500">({p.status})</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {dashboard && dashboard.reminders.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">Key Reminders</h4>
                  <div className="space-y-1.5">
                    {dashboard.reminders.map((note, i) => (
                      <div key={i} className="text-xs text-slate-400 flex gap-2">
                        <span className="text-amber-500">⚡</span>
                        <span>{note}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {sync?.timestamp && (
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-xs text-slate-500">
                    Last checked: <span className="text-slate-400">{new Date(sync.timestamp).toLocaleTimeString()}</span>
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
