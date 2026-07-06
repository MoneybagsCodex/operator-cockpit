'use client';

import { Project, Agent, ChatMessage, AgentEvent, ApprovalRiskLevel } from '@/src/types';
import { Send, X, TerminalSquare, Pencil, Check } from 'lucide-react';
import { useState, useEffect, useMemo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatThreadProps {
  project?: Project;
  agent?: Agent;
  messages: ChatMessage[];
  events: AgentEvent[];
  highlighted?: boolean;
  readOnly?: boolean;
  /** When provided, send() calls this instead of POSTing to /api/chat (used for resumable session panels). */
  onSend?: (message: string) => Promise<void>;
  /** When provided, shows a "Go live" button that opens a real interactive terminal for this conversation. */
  onGoLive?: () => void;
  /** When provided, the panel title becomes editable and this is called with the new name. */
  onRename?: (newName: string) => void;
  onDecide?: (id: string, decision: 'approved' | 'rejected' | 'needs-revision', notes?: string) => Promise<void>;
  onClose?: () => void;
}

const RISK_COLOR: Record<string, string> = {
  critical: 'bg-red-600',
  high: 'bg-orange-600',
  medium: 'bg-yellow-600',
  low: 'bg-green-600',
};

function riskColor(risk: ApprovalRiskLevel | string) {
  return RISK_COLOR[risk] ?? 'bg-slate-600';
}

export function ChatThread({ project, agent, messages, events, highlighted, readOnly, onSend, onGoLive, onRename, onDecide, onClose }: ChatThreadProps) {
  const [mounted, setMounted] = useState(false);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const startRename = () => { setTitleDraft(project?.name ?? ''); setEditingTitle(true); };
  const saveRename = () => {
    const next = titleDraft.trim();
    if (next && onRename) onRename(next);
    setEditingTitle(false);
  };

  useEffect(() => {
    setMounted(true);
  }, []);

  const send = async () => {
    const msg = input.trim();
    if (!msg || sending) return;
    if (!onSend && !agent) return;
    setSending(true);
    setSendError(null);
    setInput('');
    try {
      if (onSend) {
        await onSend(msg);
      } else {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: agent!.id, message: msg }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setSendError(data.error || `Error ${res.status}`);
        }
      }
    } catch (e) {
      setSendError(e instanceof Error ? e.message : 'Failed to send');
    } finally {
      setSending(false);
    }
  };

  const canSend = !!onSend || !!agent;

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  // Approval IDs that already have a decision message — used to hide action buttons
  const resolvedApprovalIds = useMemo(() => new Set(
    messages
      .filter((m) => m.type === 'approval-decision' && m.approvalId)
      .map((m) => m.approvalId as string)
  ), [messages]);

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

  // Keep the newest message in view when messages arrive or the agent starts/stops working
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [allActivity.length, sending]);

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
    <div className={`min-h-0 bg-slate-800 rounded-lg border flex flex-col overflow-hidden transition-colors ${highlighted ? 'border-yellow-500/50 shadow-lg shadow-yellow-900/20' : 'border-slate-700'}`}>
      {highlighted && (
        <div className="bg-yellow-600/20 border-b border-yellow-600/40 px-3 py-1.5 text-xs text-yellow-300 flex items-center gap-2">
          <span className="animate-pulse">●</span>
          Awaiting your decision
        </div>
      )}
      {/* Header */}
      <div className="border-b border-slate-700 p-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          {editingTitle ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={saveRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); saveRename(); }
                if (e.key === 'Escape') setEditingTitle(false);
              }}
              className="w-full bg-slate-700 text-slate-100 text-base font-semibold px-1.5 py-0.5 rounded focus:outline-none focus:ring-1 focus:ring-blue-600"
            />
          ) : (
            <h3
              className={`text-base font-semibold text-slate-100 truncate flex items-center gap-1.5 ${onRename ? 'group/title cursor-text' : ''}`}
              onDoubleClick={onRename ? startRename : undefined}
              title={onRename ? 'Double-click to rename' : undefined}
            >
              {project.name}
            </h3>
          )}
          {agent && <p className="text-xs text-slate-400">{agent.name}</p>}
        </div>
        <div className="flex items-center gap-1.5 flex-shrink-0 mt-0.5">
          {onRename && !editingTitle && (
            <button
              onClick={startRename}
              className="text-slate-500 hover:text-slate-300 transition-colors"
              title="Rename"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          {editingTitle && (
            <button
              onClick={saveRename}
              className="text-green-400 hover:text-green-300 transition-colors"
              title="Save name"
            >
              <Check className="w-4 h-4" />
            </button>
          )}
          {onGoLive && (
            <button
              onClick={onGoLive}
              className="flex items-center gap-1 text-[11px] px-2 py-1 rounded bg-cyan-700/40 hover:bg-cyan-600 text-cyan-200 hover:text-white border border-cyan-700/50 transition-colors"
              title="Open a live interactive terminal for this conversation (slash commands, MCP, streaming)"
            >
              <TerminalSquare className="w-3 h-3" /> Go live
            </button>
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {allActivity.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            No activity yet
          </div>
        ) : (
          allActivity.map((item) => {
            if (item.type === 'message') {
              const msg = item.data as ChatMessage;

              // Approvals live only in the sidebar Approval Queue — never render
              // approval cards inline in chat (avoids stale/duplicate cards).
              if (msg.type === 'approval-request' || msg.type === 'approval-decision') {
                return null;
              }

              // ── Approval decision (dead code - filtered above) ──
              if (false && msg.type === 'approval-decision') {
                const isApproved = msg.approvalDecision === 'approved';
                const isRejected = msg.approvalDecision === 'rejected';
                return (
                  <div
                    key={item.id}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${
                      isApproved
                        ? 'bg-green-900/30 border border-green-700/40 text-green-300'
                        : isRejected
                        ? 'bg-red-900/30 border border-red-700/40 text-red-300'
                        : 'bg-yellow-900/30 border border-yellow-700/40 text-yellow-300'
                    }`}
                  >
                    <span className="font-semibold flex-shrink-0">
                      {isApproved ? '✓ Approved' : isRejected ? '✗ Rejected' : '↩ Needs Revision'}
                    </span>
                    <span className="text-slate-400">—</span>
                    <span className="truncate">{msg.approvalAction}</span>
                    {msg.approvalNotes && (
                      <span className="text-slate-400 ml-1 truncate">· {msg.approvalNotes}</span>
                    )}
                    {mounted && (
                      <span className="text-slate-500 ml-auto flex-shrink-0">{formatTime(msg.timestamp)}</span>
                    )}
                  </div>
                );
              }

              // ── Regular message ────────────────────────────────────────────
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
                    className={`flex flex-col gap-2 min-w-0 max-w-[85%] ${
                      msg.sender === 'user' ? 'items-end' : 'items-start'
                    }`}
                  >
                    <div
                      className={`px-4 py-2 rounded-lg max-w-full overflow-hidden ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white'
                          : msg.sender === 'system'
                          ? 'bg-slate-700/60 text-slate-400 text-xs italic'
                          : 'bg-slate-700 text-slate-100'
                      }`}
                    >
                      {msg.sender === 'user' ? (
                        <p className="text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                      ) : (
                        <div className="text-sm prose prose-sm prose-invert max-w-none break-words
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

      {/* Working indicator — live agents only */}
      {!readOnly && agent?.status === 'working' && (
        <div className="px-3 pb-2 flex items-center gap-2">
          <div className="w-8 h-5 rounded bg-cyan-600/30 flex-shrink-0 flex items-center justify-center">
            <span className="text-xs text-cyan-400">{agent.name.charAt(0)}</span>
          </div>
          <div className="flex items-center gap-1 bg-slate-700 rounded-full px-3 py-1.5">
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
              style={{ animationDelay: '0ms' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
              style={{ animationDelay: '150ms' }}
            />
            <span
              className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-bounce"
              style={{ animationDelay: '300ms' }}
            />
          </div>
          <span className="text-xs text-slate-500">
            {agent.currentTask ? agent.currentTask : 'working…'}
          </span>
        </div>
      )}

      {/* Input Area */}
      {readOnly && !onSend ? (
        <div className="border-t border-slate-700 px-3 py-2 bg-slate-800/50 flex items-center gap-2">
          <span className="text-xs text-slate-500 italic">History view — read only</span>
        </div>
      ) : (
        <div className="border-t border-slate-700 p-2 bg-slate-800/50">
          {onSend && (
            <p className="text-[11px] text-slate-500 mb-1.5 px-1">
              ↻ Resumes this conversation. Don&apos;t also drive it from its own terminal at the same time.
            </p>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => { setInput(e.target.value); setSendError(null); }}
              onKeyDown={onKeyDown}
              placeholder={sending ? 'Claude is working…' : agent ? `Message ${agent.name}…` : 'Continue this conversation…'}
              disabled={!canSend || sending}
              className="flex-1 bg-slate-700 text-slate-100 px-3 py-1.5 text-sm rounded focus:outline-none focus:ring-2 focus:ring-blue-600 placeholder-slate-500 disabled:opacity-50"
            />
            <button
              onClick={send}
              disabled={!canSend || !input.trim() || sending}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white p-1.5 rounded transition-colors"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>
          {sendError && (
            <p className="text-xs text-red-400 mt-1.5 px-1">{sendError}</p>
          )}
        </div>
      )}
    </div>
  );
}
