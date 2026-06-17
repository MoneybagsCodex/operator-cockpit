'use client';

import { Project, Agent, ChatMessage, AgentEvent } from '@/src/types';
import { Send, X } from 'lucide-react';
import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatThreadProps {
  project?: Project;
  agent?: Agent;
  messages: ChatMessage[];
  events: AgentEvent[];
  highlighted?: boolean;
  onClose?: () => void;
}

export function ChatThread({ project, agent, messages, events, highlighted, onClose }: ChatThreadProps) {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const send = async () => {
    const msg = input.trim();
    if (!msg || !agent || sending) return;
    setSending(true);
    setInput('');
    try {
      await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: agent.id, message: msg }),
      });
    } finally {
      setSending(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const allActivity = [
    ...messages.map((m) => ({
      id: m.id,
      type: 'message' as const,
      timestamp: m.timestamp,
      data: m,
    })),
    ...events.map((e) => ({
      id: e.id,
      type: 'event' as const,
      timestamp: e.timestamp,
      data: e,
    })),
  ].sort((a, b) => {
    const ta = a.timestamp instanceof Date ? a.timestamp.getTime() : new Date(a.timestamp as unknown as string).getTime();
    const tb = b.timestamp instanceof Date ? b.timestamp.getTime() : new Date(b.timestamp as unknown as string).getTime();
    return ta - tb;
  });

  const formatTime = (date: Date | string) => {
    const d = date instanceof Date ? date : new Date(date as string);
    if (isNaN(d.getTime())) return '--:--';
    return new Intl.DateTimeFormat('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  };

  if (!project) {
    return (
      <div className="flex-1 bg-slate-800 rounded-lg border border-slate-700 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-400">Select a project to view conversation</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 bg-slate-800 rounded-lg border flex flex-col overflow-hidden transition-colors ${highlighted ? 'border-yellow-500/50 shadow-lg shadow-yellow-900/20' : 'border-slate-700'}`}>
      {highlighted && (
        <div className="bg-yellow-600/20 border-b border-yellow-600/40 px-3 py-1.5 text-xs text-yellow-300 flex items-center gap-2">
          <span className="animate-pulse">●</span>
          Awaiting your decision
        </div>
      )}
      {/* Header */}
      <div className="border-b border-slate-700 p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-100 truncate">{project.name}</h3>
          {agent && <p className="text-xs text-slate-400">{agent.name}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0">
          {agent && (
            <>
              <select
                value={agent.trustLevel || 'monitor'}
                onChange={async (e) => {
                  await fetch('/api/agents/trust', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: agent.id, trustLevel: e.target.value }),
                  });
                }}
                className="bg-slate-700 text-slate-300 text-xs px-1.5 py-1 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                title="Trust level — controls what this agent auto-approves"
              >
                <option value="monitor">👁 Monitor</option>
                <option value="assistant">🤝 Assistant</option>
                <option value="autonomous">⚡ Autonomous</option>
                <option value="full-auto">🚀 Full auto</option>
              </select>
              <select
                value={agent.model || 'sonnet'}
                onChange={async (e) => {
                  await fetch('/api/agents/model', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ agentId: agent.id, model: e.target.value }),
                  });
                }}
                className="bg-slate-700 text-slate-300 text-xs px-1.5 py-1 rounded border border-slate-600 focus:outline-none focus:ring-1 focus:ring-blue-600"
                title="Switch model for this agent"
              >
                <option value="sonnet">Sonnet</option>
                <option value="deepseek">DeepSeek</option>
                <option value="llama">Llama</option>
                <option value="qwen">Qwen</option>
                <option value="kimi">Kimi K</option>
                <option value="mistral">Mistral</option>
              </select>
            </>
          )}
          {onClose && (
            <button
              onClick={onClose}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Close panel"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Chat Thread */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {allActivity.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            No activity yet
          </div>
        ) : (
          allActivity.map((item) => {
            if (item.type === 'message') {
              const msg = item.data as ChatMessage;
              return (
                <div
                  key={item.id}
                  className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'agent' && agent && (
                    <div className="w-8 h-8 rounded bg-cyan-600 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white">
                      {agent.name.charAt(0)}
                    </div>
                  )}

                  <div
                    className={`flex flex-col gap-2 max-w-md ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2 rounded-lg ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-700 text-slate-100'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="text-sm">{msg.message}</p>
                      ) : (
                        <div className="text-sm prose prose-sm prose-invert max-w-none
                          [&>p]:mb-2 [&>p:last-child]:mb-0
                          [&>ul]:mb-2 [&>ul]:pl-4 [&>ul>li]:list-disc
                          [&>ol]:mb-2 [&>ol]:pl-4 [&>ol>li]:list-decimal
                          [&>h1]:text-base [&>h1]:font-bold [&>h1]:mb-1
                          [&>h2]:text-sm [&>h2]:font-semibold [&>h2]:mb-1
                          [&>h3]:text-sm [&>h3]:font-semibold [&>h3]:mb-1
                          [&>pre]:bg-slate-900 [&>pre]:rounded [&>pre]:p-2 [&>pre]:mb-2 [&>pre]:overflow-x-auto
                          [&_code]:bg-slate-900 [&_code]:rounded [&_code]:px-1 [&_code]:text-cyan-300
                          [&>pre>code]:bg-transparent [&>pre>code]:p-0 [&>pre>code]:text-cyan-300
                          [&>blockquote]:border-l-2 [&>blockquote]:border-slate-500 [&>blockquote]:pl-3 [&>blockquote]:italic [&>blockquote]:text-slate-400
                          [&>hr]:border-slate-600">
                          <ReactMarkdown>{msg.message}</ReactMarkdown>
                        </div>
                      )}
                    </div>

                    {msg.contextChips && msg.contextChips.length > 0 && (
                      <div className="flex gap-2 flex-wrap">
                        {msg.contextChips.map((chip, i) => (
                          <span
                            key={i}
                            className={`text-xs px-2 py-1 rounded ${chip.color || 'bg-slate-600'} text-white`}
                          >
                            {chip.value}
                          </span>
                        ))}
                      </div>
                    )}

                    {mounted && (
                      <span className="text-xs text-slate-500">
                        {formatTime(msg.timestamp)}
                      </span>
                    )}
                  </div>
                </div>
              );
            }

            const event = item.data as AgentEvent;
            return (
              <div key={item.id} className="bg-slate-700/50 rounded-lg p-3 border border-slate-600">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h4 className="font-semibold text-slate-100 text-sm">{event.title}</h4>
                    <p className="text-xs text-slate-400 mt-1">{event.description}</p>
                  </div>
                  <span
                    className={`text-xs font-semibold px-2 py-1 rounded whitespace-nowrap ml-2 ${
                      event.urgency === 'critical'
                        ? 'bg-red-600 text-white'
                        : event.urgency === 'high'
                          ? 'bg-orange-600 text-white'
                          : 'bg-slate-600 text-slate-300'
                    }`}
                  >
                    {event.urgency}
                  </span>
                </div>
                {mounted && (
                  <span className="text-xs text-slate-500">{formatTime(event.timestamp)}</span>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Input Area */}
      <div className="border-t border-slate-700 p-2 bg-slate-800/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={agent ? `Message ${agent.name}…` : 'Reply…'}
            disabled={!agent || sending}
            className="flex-1 bg-slate-700 text-slate-100 px-3 py-1.5 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-slate-500 disabled:opacity-50"
          />
          <button
            onClick={send}
            disabled={!agent || !input.trim() || sending}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-1.5 rounded transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
