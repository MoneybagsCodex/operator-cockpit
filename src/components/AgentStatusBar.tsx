'use client';

import { Agent } from '@/src/types';
import { Circle, Plus, X, Play, ShieldCheck, Loader2, Folder, RefreshCw } from 'lucide-react';
import { useState, useEffect } from 'react';
import { ThemeSwitcher } from './ThemeSwitcher';

interface AgentConfig {
  id: string;
  name: string;
  emoji?: string;
  workDir?: string;
  model?: string;
}

interface ProjectDir {
  name: string;
  path: string;
}

interface AgentStatusBarProps {
  agents: Agent[];
  connected?: boolean;
  usingMockData?: boolean;
  onLaunchTerminal?: (agentId: string, title: string) => void;
  onOpenProject?: (proj: ProjectDir) => void;
  onTrustAll?: () => void;
}

// Logo monogram + product name.
function Brand() {
  return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <div className="w-[26px] h-[26px] rounded-md bg-blue-600 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
        OC
      </div>
      <h1 className="text-xl font-bold text-slate-100">Operator Cockpit</h1>
    </div>
  );
}

export function AgentStatusBar({ agents, connected, usingMockData, onLaunchTerminal, onOpenProject, onTrustAll }: AgentStatusBarProps) {
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', emoji: '🤖', model: 'sonnet', prompt: '', workDir: '' });
  const [creating, setCreating] = useState(false);
  const [configs, setConfigs] = useState<AgentConfig[]>([]);
  const [projects, setProjects] = useState<ProjectDir[]>([]);
  const [launching, setLaunching] = useState<string | null>(null);
  const [trusting, setTrusting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [jiraTickets, setJiraTickets] = useState<Array<{ key: string; summary: string; url: string }>>([]);

  // Load Jira tickets the first time the New Agent form opens (for the linker dropdown)
  useEffect(() => {
    if (!showForm || jiraTickets.length) return;
    fetch('/api/jira/sprint')
      .then((r) => r.json())
      .then((d) => {
        const all = [...(d.inProgress ?? []), ...(d.sprint ?? []), ...(d.submitted ?? [])];
        const seen = new Set<string>();
        const list: Array<{ key: string; summary: string; url: string }> = [];
        for (const t of all) {
          if (!seen.has(t.key)) { seen.add(t.key); list.push({ key: t.key, summary: t.summary, url: t.url }); }
        }
        setJiraTickets(list);
      })
      .catch(() => {});
  }, [showForm, jiraTickets.length]);

  const handleTrustAll = () => {
    if (!onTrustAll || trusting) return;
    setTrusting(true);
    onTrustAll();
    // No completion signal from the PTYs; show progress briefly while they accept.
    setTimeout(() => setTrusting(false), 2500);
  };

  const handleSync = async () => {
    if (syncing) return;
    setSyncing(true);
    try {
      const res = await fetch('/api/sync-check');
      await res.json();
      // Trigger browser refresh to reload the sync-check banner
      window.location.reload();
    } catch (err) {
      console.error('Sync check failed:', err);
      setSyncing(false);
    }
  };

  useEffect(() => {
    setMounted(true);
    fetchConfigs();
    fetch('/api/projects')
      .then((r) => r.json())
      .then((d) => setProjects(d.projects || []))
      .catch(() => {});
  }, []);

  const fetchConfigs = () => {
    fetch('/api/agents')
      .then((r) => r.json())
      .then((d) => setConfigs(d.configs || []))
      .catch(() => {});
  };

  const launch = async (id: string, name: string) => {
    console.log('[AgentStatusBar] launch() called:', id, name, 'onLaunchTerminal?', !!onLaunchTerminal);
    // Open a live embedded terminal in the cockpit grid (full interactive claude).
    if (onLaunchTerminal) {
      console.log('[AgentStatusBar] Using onLaunchTerminal callback');
      onLaunchTerminal(id, name);
      return;
    }
    // Fallback: open an external PowerShell window if no embedded handler provided.
    console.log('[AgentStatusBar] No onLaunchTerminal callback, using fallback API');
    if (launching) return;
    setLaunching(id);
    try {
      await fetch(`/api/agents/${id}/start`, { method: 'POST' });
    } finally {
      setLaunching(null);
    }
  };

  const createAgent = async () => {
    if (!form.name.trim() || creating) return;
    setCreating(true);
    console.log('[AgentStatusBar] Creating agent:', form);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      console.log('[AgentStatusBar] API response status:', res.status);
      if (!res.ok) {
        const text = await res.text();
        console.error('[AgentStatusBar] API error response:', res.status, text);
        return;
      }
      const data = await res.json();
      console.log('[AgentStatusBar] API response body:', JSON.stringify(data));
      if (data.config) {
        const agentId = data.config.id;
        const agentName = data.config.name;
        console.log('[AgentStatusBar] Agent created successfully:', agentId, agentName);
        setForm({ name: '', emoji: '🤖', model: 'sonnet', prompt: '', workDir: '' });
        setShowForm(false);
        fetchConfigs();
        // Launch the agent terminal immediately after creation
        setTimeout(() => {
          console.log('[AgentStatusBar] Calling launch with:', agentId, agentName, 'callback?', !!onLaunchTerminal);
          launch(agentId, agentName);
        }, 300);
      } else {
        console.error('[AgentStatusBar] No config in response:', JSON.stringify(data));
      }
    } catch (err) {
      console.error('[AgentStatusBar] Exception during createAgent:', err instanceof Error ? err.message : String(err));
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working': return 'bg-green-500';
      case 'waiting': return 'bg-yellow-500';
      case 'blocked':  return 'bg-red-500';
      default:         return 'bg-slate-500';
    }
  };

  const formatTime = (date: Date) => {
    const diffMs = new Date().getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1)    return 'now';
    if (diffMins < 60)   return `${diffMins}m`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h`;
    return `${Math.floor(diffMins / 1440)}d`;
  };

  // Configs that don't have an active heartbeat
  const liveIds = new Set(agents.map((a) => a.id));
  const offlineConfigs = configs.filter((c) => !liveIds.has(c.id));

  if (!mounted) {
    return (
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-6">
          <Brand />
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
      <div className="flex items-center gap-4 flex-wrap">
        <Brand />

        {/* Project launchers — detected from ~/claude/projects. Click to open a
            live agent terminal in that folder. Active sessions live in the grid. */}
        <div className="flex-1 flex items-center gap-2 flex-wrap min-w-0">
          {projects.map((proj) => (
            <button
              key={proj.path}
              onClick={() => onOpenProject?.(proj)}
              title={`Open a live agent terminal in ${proj.path}`}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded bg-slate-700 hover:bg-green-700 text-slate-300 hover:text-white border border-slate-600 hover:border-green-600 transition-all"
            >
              <Folder className="w-3 h-3 flex-shrink-0" />
              {proj.name}
            </button>
          ))}
          {mounted && projects.length === 0 && (
            <span className="text-xs text-slate-600">No projects found under ~/claude/projects</span>
          )}
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {usingMockData && (
            <span className="text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/30 px-2 py-1 rounded">
              mock data
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${connected ? 'text-green-400' : 'text-slate-500'}`}>
            {connected ? '● live' : '○ connecting…'}
          </span>
          {onTrustAll && (
            <button
              onClick={handleTrustAll}
              disabled={trusting}
              title="Accept the claude startup trust prompt in all open terminals"
              className="flex items-center gap-1 text-xs bg-cyan-700/50 hover:bg-cyan-600 text-cyan-100 px-2 py-1 rounded transition-colors disabled:opacity-70"
            >
              {trusting ? <Loader2 className="w-3 h-3 animate-spin" /> : <ShieldCheck className="w-3 h-3" />}
              {trusting ? 'Trusting…' : 'Trust all'}
            </button>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            title="Run sync-check to verify knowledge base coherence"
            className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors disabled:opacity-70"
          >
            {syncing ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
            {syncing ? 'Syncing…' : 'Sync'}
          </button>
          <ThemeSwitcher />
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            <Plus className="w-3 h-3" /> New Agent
          </button>
          <span className="text-xs text-slate-500">
            {new Intl.DateTimeFormat('en-US', {
              hour: '2-digit', minute: '2-digit', second: '2-digit',
            }).format(new Date())}
          </span>
        </div>
      </div>

      {showForm && (
        <div className="border-t border-slate-700 px-4 py-3 bg-slate-800/80 flex items-end gap-3 flex-wrap">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Emoji"
              value={form.emoji}
              onChange={(e) => setForm((f) => ({ ...f, emoji: e.target.value }))}
              className="w-12 bg-slate-700 text-slate-100 px-2 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
            <input
              type="text"
              placeholder="Agent name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-40 bg-slate-700 text-slate-100 px-3 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder-slate-500"
            />
          </div>
          <select
            value={form.model}
            onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
            className="bg-slate-700 text-slate-100 px-2 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
          >
            <option value="sonnet">Claude Sonnet</option>
            <option value="opus">Claude Opus</option>
            <option value="haiku">Claude Haiku</option>
          </select>
          {jiraTickets.length > 0 && (
            <select
              defaultValue=""
              title="Link a Jira ticket — pre-fills the name and a task prompt"
              onChange={(e) => {
                const t = jiraTickets.find((x) => x.key === e.target.value);
                if (t) setForm((f) => ({
                  ...f,
                  name: t.key,
                  prompt: `Work on Jira ticket ${t.key} — "${t.summary}". Link: ${t.url}. Review it and outline a plan before making changes.`,
                }));
              }}
              className="max-w-52 bg-slate-700 text-slate-100 px-2 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
            >
              <option value="">Link Jira ticket…</option>
              {jiraTickets.map((t) => (
                <option key={t.key} value={t.key}>{t.key} — {t.summary.slice(0, 40)}</option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="System prompt (optional)"
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
            className="flex-1 min-w-48 bg-slate-700 text-slate-100 px-3 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder-slate-500"
          />
          <input
            type="text"
            placeholder="Working directory  e.g.  C:\projects\zd-writer"
            value={form.workDir}
            onChange={(e) => setForm((f) => ({ ...f, workDir: e.target.value }))}
            className="w-72 bg-slate-700 text-slate-100 px-3 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder-slate-500 font-mono text-xs"
          />
          <div className="flex gap-2">
            <button
              onClick={createAgent}
              disabled={!form.name.trim() || creating}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white text-sm px-3 py-1.5 rounded transition-colors"
            >
              {creating ? 'Creating…' : 'Create'}
            </button>
            <button
              onClick={() => setShowForm(false)}
              className="text-slate-400 hover:text-slate-200 p-1.5"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
