'use client';

import { Agent } from '@/src/types';
import { Circle, Plus, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface AgentStatusBarProps {
  agents: Agent[];
  connected?: boolean;
  usingMockData?: boolean;
}

export function AgentStatusBar({ agents, connected, usingMockData }: AgentStatusBarProps) {
  const [mounted, setMounted] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', emoji: '🤖', model: 'sonnet', prompt: '' });
  const [creating, setCreating] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const createAgent = async () => {
    if (!form.name.trim() || creating) return;
    setCreating(true);
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      setShowForm(false);
      setForm({ name: '', emoji: '🤖', model: 'sonnet', prompt: '' });
    } finally {
      setCreating(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'working':
        return 'bg-green-600';
      case 'waiting':
        return 'bg-yellow-600';
      case 'blocked':
        return 'bg-red-600';
      case 'idle':
        return 'bg-slate-600';
      default:
        return 'bg-gray-600';
    }
  };

  const formatTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`;
    return `${Math.floor(diffMins / 1440)}d ago`;
  };

  if (!mounted) {
    return (
      <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold text-slate-100">AI Operator Cockpit</h1>
          <div className="flex-1" />
          <div className="text-xs text-slate-500">--:--:--</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-3">
      <div className="flex items-center gap-6">
        <h1 className="text-xl font-bold text-slate-100">AI Operator Cockpit</h1>

        <div className="flex-1 flex items-center gap-4">
          {agents.map((agent) => (
            <div key={agent.id} className="flex items-center gap-2">
              <Circle
                className={`w-3 h-3 flex-shrink-0 ${getStatusColor(agent.status)}`}
                fill="currentColor"
              />
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-slate-200">{agent.name}</span>
                <span className="text-xs text-slate-500">{formatTime(agent.lastHeartbeat)}</span>
              </div>
              {agent.confidenceLevel && (
                <span className="text-xs text-slate-500">
                  {Math.round(agent.confidenceLevel * 100)}%
                </span>
              )}
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {usingMockData && (
            <span className="text-xs bg-yellow-600/20 text-yellow-400 border border-yellow-600/30 px-2 py-1 rounded">
              mock data
            </span>
          )}
          <span className={`text-xs px-2 py-1 rounded ${connected ? 'text-green-400' : 'text-slate-500'}`}>
            {connected ? '● live' : '○ connecting...'}
          </span>
          <button
            onClick={() => setShowForm((v) => !v)}
            className="flex items-center gap-1 text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 px-2 py-1 rounded transition-colors"
          >
            <Plus className="w-3 h-3" /> New Agent
          </button>
          <span className="text-xs text-slate-500">
            {new Intl.DateTimeFormat('en-US', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
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
            <option value="sonnet">Claude (sonnet)</option>
            <option value="deepseek">DeepSeek</option>
            <option value="llama">Llama 4</option>
            <option value="qwen">Qwen 3</option>
          </select>
          <input
            type="text"
            placeholder="System prompt (optional — defaults to generic assistant)"
            value={form.prompt}
            onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
            className="flex-1 min-w-64 bg-slate-700 text-slate-100 px-3 py-1.5 text-sm rounded focus:outline-none focus:ring-1 focus:ring-blue-600 placeholder-slate-500"
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
