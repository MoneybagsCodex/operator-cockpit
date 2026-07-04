'use client';

import { useEffect, useState, useCallback } from 'react';
import { RefreshCw, ChevronDown, ExternalLink, Bot } from 'lucide-react';

interface SprintTicket {
  key: string;
  summary: string;
  status: string;
  statusCategory: string;
  priority: string;
  issueType: string;
  projectKey: string;
  points: number | null;
  url: string;
}

interface JiraData {
  inProgress: SprintTicket[];
  sprint: SprintTicket[];
  submitted: SprintTicket[];
  sprintLabel: string | null;
}

const STATUS_CHIP: Record<string, string> = {
  indeterminate: 'bg-blue-600/20 text-blue-300 border border-blue-600/30',
  new:           'bg-slate-600/20 text-slate-400 border border-slate-600/40',
  done:          'bg-green-600/15 text-green-400 border border-green-600/30',
};

// Priority shown as a colored dot (a fill, readable on any scheme) + neutral label.
const PRIORITY_LABEL: Record<string, { dot: string }> = {
  Highest: { dot: 'bg-red-500' },
  High:    { dot: 'bg-orange-500' },
  Medium:  { dot: 'bg-yellow-500' },
  Low:     { dot: 'bg-slate-400' },
  Lowest:  { dot: 'bg-slate-500' },
};

function TicketCard({ ticket, onSpinAgent, linkColor }: { ticket: SprintTicket; onSpinAgent?: (t: SprintTicket) => void; linkColor?: string }) {
  const chip = STATUS_CHIP[ticket.statusCategory] ?? STATUS_CHIP['new'];
  const pri  = PRIORITY_LABEL[ticket.priority] ?? PRIORITY_LABEL['Medium'];

  return (
    <div
      className="group flex flex-col gap-1 bg-slate-700/40 border border-slate-700 rounded-md px-3 py-2
                 hover:border-blue-500/60 transition-all min-w-0"
      style={linkColor ? { boxShadow: `inset 4px 0 0 ${linkColor}`, borderColor: linkColor } : undefined}
      title={linkColor ? `A live agent is open for ${ticket.key}` : undefined}
    >
      <div className="flex items-center gap-2 min-w-0">
        {linkColor && <span className="w-2 h-2 rounded-full shrink-0" style={{ background: linkColor }} />}
        <span className="font-mono text-[11px] font-bold text-blue-400 shrink-0">{ticket.key}</span>
        <span className="text-[12px] text-slate-200 truncate flex-1 font-medium">{ticket.summary}</span>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${chip}`}>{ticket.status}</span>
        <span className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <span className={`w-1.5 h-1.5 rounded-full ${pri.dot}`} /> {ticket.priority}
        </span>
        {ticket.points != null && (
          <span className="text-[11px] text-slate-500">{ticket.points} pts</span>
        )}
        {/* Actions */}
        <div className="ml-auto flex items-center gap-1">
          <a
            href={ticket.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in Jira"
            className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded text-slate-400 hover:text-slate-100 hover:bg-slate-700 transition-colors"
          >
            <ExternalLink className="w-3 h-3" /> Open
          </a>
          {onSpinAgent && (
            <button
              onClick={() => onSpinAgent(ticket)}
              title={`Spin up a Claude agent to work on ${ticket.key}`}
              className="flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded bg-cyan-700/50 text-cyan-100 hover:bg-cyan-600 transition-colors"
            >
              <Bot className="w-3 h-3" /> Agent
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function ColSection({ label, tickets, empty, onSpinAgent, linkColors }: { label: string; tickets: SprintTicket[]; empty: string; onSpinAgent?: (t: SprintTicket) => void; linkColors?: Record<string, string> }) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-1.5 flex items-center gap-1.5">
        {label}
        <span className="text-slate-600">{tickets.length}</span>
      </div>
      {tickets.length === 0 ? (
        <span className="text-[11px] text-slate-600">{empty}</span>
      ) : (
        <div className="flex flex-col gap-1.5">
          {tickets.map((t) => <TicketCard key={t.key} ticket={t} onSpinAgent={onSpinAgent} linkColor={linkColors?.[t.key]} />)}
        </div>
      )}
    </div>
  );
}

export function SprintTickets({ onSpinAgent, linkColors }: { onSpinAgent?: (t: SprintTicket) => void; linkColors?: Record<string, string> }) {
  const [data, setData]         = useState<JiraData>({ inProgress: [], sprint: [], submitted: [], sprintLabel: null });
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(localStorage.getItem('cockpit-jira-collapsed') === '1');
  }, []);

  const toggleCollapse = () => {
    setCollapsed((v) => {
      const next = !v;
      localStorage.setItem('cockpit-jira-collapsed', next ? '1' : '0');
      return next;
    });
  };

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/jira/sprint');
      const json = await res.json() as { inProgress?: SprintTicket[]; sprint?: SprintTicket[]; submitted?: SprintTicket[]; sprintLabel?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? 'Failed to fetch');
      setData({
        inProgress: json.inProgress ?? [],
        sprint: json.sprint ?? [],
        submitted: json.submitted ?? [],
        sprintLabel: json.sprintLabel ?? null,
      });
      setLastFetched(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const iv = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(iv);
  }, [load]);

  const totalCount = data.inProgress.length + data.sprint.length + data.submitted.length;
  // "Sprint-7/6" → "7/6"
  const sprintShort = data.sprintLabel ? data.sprintLabel.replace(/^sprint-/i, '') : null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex-shrink-0">
      {/* Header — always visible */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={toggleCollapse}
          className="flex items-center gap-2 min-w-0 text-slate-300 hover:text-slate-100 transition-colors"
        >
          <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform duration-200 ${collapsed ? '-rotate-90' : ''}`} />
          <span className="text-xs font-semibold uppercase tracking-wider">Jira</span>
          {!loading && totalCount > 0 && <span className="text-[11px] text-slate-500">{totalCount}</span>}
        </button>
        <button
          onClick={load}
          disabled={loading}
          title={lastFetched ? `Updated ${lastFetched.toLocaleTimeString()}` : 'Refresh'}
          className="ml-auto text-slate-600 hover:text-slate-400 transition-colors flex-shrink-0"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {!collapsed && (
        <div className="border-t border-slate-700">
          {error ? (
            <div className="px-3 py-2 text-[11px] text-red-400">
              {error.includes('JIRA_EMAIL') ? 'Add JIRA_EMAIL + JIRA_TOKEN to .env.local'
                : error.includes('expired') ? '⚠ Jira token expired — refresh JIRA_TOKEN in .env.local'
                : error}
            </div>
          ) : (
            <div className="px-3 py-2.5 max-h-[42vh] overflow-y-auto flex flex-col gap-3">
              <ColSection
                label="In Progress"
                tickets={data.inProgress}
                empty={loading ? 'Loading…' : 'Nothing in progress'}
                onSpinAgent={onSpinAgent}
                linkColors={linkColors}
              />
              <ColSection
                label={sprintShort ? `Sprint ${sprintShort}` : 'Sprint'}
                tickets={data.sprint}
                empty={loading ? 'Loading…' : 'No current sprint tickets'}
                onSpinAgent={onSpinAgent}
                linkColors={linkColors}
              />
              <ColSection
                label="Submitted"
                tickets={data.submitted}
                empty={loading ? 'Loading…' : 'No submitted tickets'}
                onSpinAgent={onSpinAgent}
                linkColors={linkColors}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
