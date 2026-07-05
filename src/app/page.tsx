'use client';

import { mockDashboardState } from '@/src/data/mock';
import { ChatThread } from '@/src/components/ChatThread';
import { ApprovalQueue } from '@/src/components/ApprovalQueue';
import { AgentStatusBar } from '@/src/components/AgentStatusBar';
import { SprintTickets } from '@/src/components/SprintTickets';
import { SessionBrowser } from '@/src/components/SessionBrowser';
import { TerminalPanel } from '@/src/components/TerminalPanel';
import { BootSplash } from '@/src/components/BootSplash';
import { SyncCheckBanner } from '@/src/components/SyncCheckBanner';
import { useLiveState } from '@/src/hooks/useLiveState';
import { useState, useCallback, useEffect, useRef, useMemo } from 'react';

// Brand series colors used to visually link a Jira ticket to its spun agent.
const LINK_COLORS = ['#1F5EFF', '#6202FF', '#2FE9DB', '#FB8F2C', '#87A8FF', '#E0483C'];

interface TerminalPanelState {
  id: string;       // unique panel id
  rawId: string;    // underlying session/agent id (for custom names)
  title: string;
  wsUrl: string;    // ws://…/terminal?mode=…&agent|session=…
}

// Bridge WebSocket base (terminals connect directly to the bridge, not Next.js)
const BRIDGE_WS = process.env.NEXT_PUBLIC_BRIDGE_WS || 'ws://127.0.0.1:3002';

// Most live sessions open at once
const MAX_SESSIONS = 6;

// localStorage key holding the open terminal windows so they survive a refresh.
const TERMINALS_KEY = 'cockpit-terminals';

// Pull the stable session id embedded in a terminal's ws URL (the reattach linchpin).
function sidOf(wsUrl: string): string {
  try { return new URL(wsUrl).searchParams.get('sid') ?? ''; } catch { return ''; }
}

export default function Dashboard() {
  const { events, approvals, agents, projects, chat, connected, usingMockData, decide } = useLiveState();
  const [closedProjects, setClosedProjects] = useState<Set<string>>(new Set());
  const [terminalPanels, setTerminalPanels] = useState<TerminalPanelState[]>([]);
  const [hydrated, setHydrated] = useState(false); // true once persisted panels are restored
  const [trustSignal, setTrustSignal] = useState(0);
  const [capNotice, setCapNotice] = useState(false);
  const trustAll = useCallback(() => setTrustSignal((n) => n + 1), []);

  // Auto-dismiss the "max sessions" notice
  useEffect(() => {
    if (!capNotice) return;
    const t = setTimeout(() => setCapNotice(false), 4000);
    return () => clearTimeout(t);
  }, [capNotice]);

  // Custom session names (persist across reloads), keyed by session id
  const [sessionNames, setSessionNames] = useState<Record<string, string>>({});
  useEffect(() => {
    try { setSessionNames(JSON.parse(localStorage.getItem('cockpit-session-names') || '{}')); } catch { /* ignore */ }
  }, []);
  const renameSession = useCallback((sessionId: string, name: string) => {
    setSessionNames((prev) => {
      const next = { ...prev, [sessionId]: name };
      try { localStorage.setItem('cockpit-session-names', JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  // Open a live embedded terminal — either a fresh agent session or resume an existing one.
  // Optional `prompt` seeds a launch-mode agent with an initial task. Hard cap of MAX_SESSIONS.
  const openTerminal = useCallback((opts: { mode: 'launch' | 'resume'; id: string; title: string; prompt?: string; cwd?: string }) => {
    const panelId = `term-${opts.mode}-${opts.id}`;
    const label = encodeURIComponent(opts.title);
    setTerminalPanels((prev) => {
      if (prev.some((t) => t.id === panelId)) return prev; // already open
      if (prev.length >= MAX_SESSIONS) {
        queueMicrotask(() => setCapNotice(true)); // at cap — refuse, notify
        return prev;
      }
      // Every panel carries a STABLE session id (`sid`). For resume, it's the
      // existing conversation's id; for launch, a fresh uuid we pin so the agent
      // can always be re-attached/resumed after a disconnect (no lost context).
      const sid = opts.mode === 'resume' ? opts.id : crypto.randomUUID();
      const q = opts.mode === 'resume'
        ? `mode=resume&sid=${encodeURIComponent(sid)}&label=${label}`
        : `mode=launch&sid=${encodeURIComponent(sid)}&agent=${encodeURIComponent(opts.id)}&label=${label}` +
          (opts.cwd ? `&cwd=${encodeURIComponent(opts.cwd)}` : '') +
          (opts.prompt ? `&prompt=${encodeURIComponent(opts.prompt)}` : '');
      return [...prev, { id: panelId, rawId: opts.id, title: opts.title, wsUrl: `${BRIDGE_WS}/terminal?${q}` }];
    });
  }, []);

  // Launch a fresh agent terminal in a chosen local project folder
  const openProject = useCallback((proj: { name: string; path: string }) => {
    openTerminal({ mode: 'launch', id: `proj-${proj.name}`, title: proj.name, cwd: proj.path });
  }, [openTerminal]);

  // Spin a fresh agent terminal to work on a specific Jira ticket. Fetches the
  // ticket's description + comments into a brief file and points the agent at it.
  const spinAgentForTicket = useCallback(async (t: { key: string; summary: string; url: string }) => {
    let prompt = `You're working on Jira ticket ${t.key} — "${t.summary}". Link: ${t.url}. Review it and outline a plan before making changes.`;
    try {
      const res = await fetch(`/api/jira/ticket/${encodeURIComponent(t.key)}`);
      const data = await res.json();
      if (data.ok && data.path) {
        prompt = `You're working on Jira ticket ${t.key} — "${t.summary}". The full description and ${data.commentCount} comment(s) are saved at: ${data.path}. Read that file first to review the full context, then outline a plan before making changes. Link: ${t.url}.`;
      }
    } catch { /* token missing/expired → fall back to summary-only prompt */ }
    openTerminal({ mode: 'launch', id: `jira-${t.key}`, title: `${t.key}: ${t.summary}`, prompt });
  }, [openTerminal]);

  const closeTerminal = useCallback((panelId: string) => {
    setTerminalPanels((prev) => prev.filter((t) => t.id !== panelId));
  }, []);

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  const hasRealProjects = projects.length > 0;
  const displayProjects = (hasRealProjects ? projects : mockDashboardState.projects)
    .filter((p) => !closedProjects.has(p.id));
  const displayAgents = agents.length > 0 ? agents : mockDashboardState.agents;

  const getChatMessages = (projectId: string) => {
    const live = chat[projectId];
    if (live && live.length > 0) return live;
    if (!hasRealProjects) return mockDashboardState.chatMessages.filter((m) => m.projectId === projectId);
    return [];
  };

  // Open a past session as a LIVE resumed terminal (used by the Session Browser)
  const openSessionLive = useCallback((sessionId: string, label: string) => {
    openTerminal({ mode: 'resume', id: sessionId, title: sessionNames[sessionId] ?? label });
  }, [openTerminal, sessionNames]);

  // --- Persistence: keep the set of open terminals across a browser refresh ---
  // Without this, terminalPanels resets to [] on every reload and fresh-launched
  // agents disappear. We restore the exact panels (same stable `sid`s) so each
  // TerminalPanel reconnects and the bridge re-attaches its still-alive PTY.
  const restoredRef = useRef(false);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(TERMINALS_KEY) || '[]') as TerminalPanelState[];
      if (Array.isArray(saved) && saved.length > 0) {
        setTerminalPanels(saved.slice(0, MAX_SESSIONS));
        restoredRef.current = true; // we restored panels → skip the 6h auto-open (avoids dupes)
      }
    } catch { /* corrupt/empty → fall through to auto-open */ }
    setHydrated(true);
  }, []);

  // Persist whenever the open set changes (but only after hydration, so we never
  // clobber the saved list with the initial empty state before restore runs).
  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(TERMINALS_KEY, JSON.stringify(terminalPanels)); } catch { /* ignore */ }
  }, [terminalPanels, hydrated]);

  // On load, auto-open recent active conversations (last 6h) as LIVE terminals —
  // DISABLED: old sessions may hang when resuming, users should manually launch fresh terminals
  // ONLY when nothing was restored from localStorage (a genuine cold start).
  const autoOpenedRef = useRef(false);
  useEffect(() => {
    if (!hydrated) return;            // wait until the restore decision is made
    if (autoOpenedRef.current) return;
    autoOpenedRef.current = true;
    if (restoredRef.current) return;  // restored panels already cover the open set
    // Auto-open disabled: old sessions may hang on resume; users should manually launch
    // (async () => {
    //   try {
    //     const res = await fetch('/api/sessions');
    //     const data = await res.json();
    //     const sessions: Array<{ id: string; projectLabel: string; lastModified: string; preview: string }> =
    //       data.sessions ?? [];
    //     const cutoff = Date.now() - 6 * 60 * 60 * 1000;
    //     const recent = sessions
    //       .filter((s) => new Date(s.lastModified).getTime() > cutoff)
    //       .slice(0, MAX_SESSIONS);
    //     for (const s of recent) {
    //       const label = s.preview?.trim()
    //         ? `${s.preview.slice(0, 38)}${s.preview.length > 38 ? '…' : ''}`
    //         : `${s.projectLabel} ${s.id.slice(0, 6)}`;
    //       openTerminal({ mode: 'resume', id: s.id, title: label });
    //     }
    //   } catch {
    //     /* no sessions endpoint or none recent — fine */
    //   }
    // })();
  }, [openTerminal, hydrated]);

  const totalPanels = terminalPanels.length;

  // Color-link each open Jira agent (terminal id `jira-<KEY>`) to its ticket card.
  const jiraLinkColors = useMemo(() => {
    const map: Record<string, string> = {};
    let i = 0;
    for (const tp of terminalPanels) {
      if (tp.rawId.startsWith('jira-')) {
        map[tp.rawId.slice('jira-'.length)] = LINK_COLORS[i % LINK_COLORS.length];
        i++;
      }
    }
    return map;
  }, [terminalPanels]);

  return (
    <>
      <BootSplash name="Operator Cockpit" />
      {/* Approvals appear only in the sidebar Approval Queue tile — no full-screen popup. */}
      <div className="flex flex-col h-screen bg-slate-900">
        <AgentStatusBar
          agents={displayAgents}
          connected={connected}
          usingMockData={usingMockData}
          onLaunchTerminal={(id, title) => openTerminal({ mode: 'launch', id, title })}
          onOpenProject={openProject}
          onTrustAll={terminalPanels.length > 0 ? trustAll : undefined}
        />

        <div className="flex flex-1 overflow-hidden gap-4 p-4 min-h-0">
          {/* Sidebar */}
          <div className="w-80 flex-shrink-0 min-h-0 flex flex-col gap-3 overflow-y-auto">
            <SyncCheckBanner />
            {capNotice && (
              <div className="bg-amber-500/15 border border-amber-500/40 text-amber-300 text-xs rounded-lg px-3 py-2">
                Max {MAX_SESSIONS} sessions open. Close one (×) before opening another.
              </div>
            )}
            <ApprovalQueue approvals={approvals} agents={displayAgents} onDecide={decide} />
            <SprintTickets onSpinAgent={spinAgentForTicket} linkColors={jiraLinkColors} />
            <SessionBrowser onOpen={openSessionLive} />
          </div>

          {/* Chat grid — each panel gets a readable minimum height; grid scrolls when there are many */}
          <div
            className={`flex-1 min-h-0 grid gap-3 overflow-y-auto pr-1 ${
              totalPanels <= 1 ? 'grid-cols-1' :
              totalPanels <= 2 ? 'grid-cols-2' :
              'grid-cols-2 xl:grid-cols-3'
            }`}
            style={{ gridAutoRows: 'minmax(340px, 1fr)' }}
          >
            {/* Live embedded terminal sessions (newest first). The grid shows only
                these — one window per live session, capped at MAX_SESSIONS. */}
            {terminalPanels.map((tp) => (
              <TerminalPanel
                key={tp.id}
                title={sessionNames[tp.rawId] ?? tp.title}
                wsUrl={tp.wsUrl}
                trustSignal={trustSignal}
                linkColor={tp.rawId.startsWith('jira-') ? jiraLinkColors[tp.rawId.slice('jira-'.length)] : undefined}
                onRename={(name) => renameSession(tp.rawId, name)}
                onClose={() => closeTerminal(tp.id)}
              />
            ))}

            {terminalPanels.length === 0 && (
              <div className="col-span-full flex items-center justify-center text-slate-500 text-sm">
                No live sessions. Open one from Past Sessions, the ▶ agent buttons, or a Jira ticket.
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
