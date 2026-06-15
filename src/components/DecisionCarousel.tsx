'use client';

import { ApprovalRequest, Agent, ChatMessage, AgentEvent } from '@/src/types';
import { ChevronLeft, ChevronRight, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useState, useEffect } from 'react';

interface DecisionCarouselProps {
  approvals: ApprovalRequest[];
  agents: Agent[];
  chatMessages?: ChatMessage[];
  events?: AgentEvent[];
  autoAdvance?: boolean;
  autoAdvanceDelay?: number;
  onDecide?: (id: string, decision: 'approved' | 'rejected' | 'needs-revision', notes?: string) => Promise<void>;
}

export function DecisionCarousel({
  approvals,
  agents,
  chatMessages = [],
  events = [],
  autoAdvance = true,
  autoAdvanceDelay = 8000,
  onDecide,
}: DecisionCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [deciding, setDeciding] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!autoAdvance || !mounted) return;

    const timer = setTimeout(() => {
      setCurrentIndex((prev) => (prev + 1) % approvals.length);
    }, autoAdvanceDelay);

    return () => clearTimeout(timer);
  }, [currentIndex, autoAdvance, autoAdvanceDelay, approvals.length, mounted]);

  if (!mounted || approvals.length === 0) {
    return null;
  }

  const currentApproval = approvals[Math.min(currentIndex, approvals.length - 1)];
  const agent = agents.find((a) => a.id === currentApproval.agentId);

  // Build the conversation thread for this approval's project
  const projectMessages = chatMessages.filter((m) => m.projectId === currentApproval.projectId);
  const projectEvents = events.filter((e) => e.projectId === currentApproval.projectId);

  // Merge messages and events into a single timeline, sorted by time
  const thread = [
    ...projectMessages.map((m) => ({ type: 'message' as const, ts: new Date(m.timestamp).getTime(), data: m })),
    ...projectEvents.map((e) => ({ type: 'event' as const, ts: new Date(e.timestamp).getTime(), data: e })),
  ].sort((a, b) => a.ts - b.ts);

  const handleDecide = async (decision: 'approved' | 'rejected' | 'needs-revision') => {
    if (!onDecide || deciding) return;
    setDeciding(true);
    try {
      await onDecide(currentApproval.id, decision);
      // Advance to next or reset
      if (approvals.length > 1) {
        setCurrentIndex((prev) => Math.min(prev, approvals.length - 2));
      }
    } finally {
      setDeciding(false);
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical':
        return 'bg-red-600 text-white';
      case 'high':
        return 'bg-orange-600 text-white';
      case 'medium':
        return 'bg-yellow-600 text-white';
      case 'low':
        return 'bg-green-600 text-white';
      default:
        return 'bg-slate-600 text-white';
    }
  };

  const getRiskBgColor = (risk: string) => {
    switch (risk) {
      case 'critical':
        return 'bg-red-600/10 border-red-600/30';
      case 'high':
        return 'bg-orange-600/10 border-orange-600/30';
      case 'medium':
        return 'bg-yellow-600/10 border-yellow-600/30';
      case 'low':
        return 'bg-green-600/10 border-green-600/30';
      default:
        return 'bg-slate-600/10 border-slate-600/30';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[9999] p-4 backdrop-blur-sm">
      <div className={`bg-slate-800 rounded-lg border border-slate-600 max-w-2xl w-full ${getRiskBgColor(currentApproval.riskLevel)}`}>
        {/* Header */}
        <div className="border-b border-slate-600 px-6 py-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-slate-100">{currentApproval.action}</h2>
              {agent && (
                <p className="text-sm text-slate-400 mt-1">
                  Decision from <span className="font-semibold">{agent.name}</span>
                </p>
              )}
            </div>
            <span className={`text-xs font-bold px-3 py-1 rounded ${getRiskColor(currentApproval.riskLevel)}`}>
              {currentApproval.riskLevel.toUpperCase()}
            </span>
          </div>

          {/* Progress */}
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span>
              Decision {currentIndex + 1} of {approvals.length}
            </span>
            <div className="flex gap-1">
              {approvals.map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 w-1.5 rounded-full ${
                    i === currentIndex ? 'bg-blue-500' : 'bg-slate-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Content: split into conversation (left) + decision details (right) */}
        <div className="flex divide-x divide-slate-700 max-h-[28rem] overflow-hidden">

          {/* Left: conversation thread that led here */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-3 pb-2 border-b border-slate-700">
              <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Conversation — {currentApproval.projectId.replace(/-/g, ' ')}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
              {thread.length === 0 ? (
                <p className="text-xs text-slate-500 italic">No conversation history yet.</p>
              ) : (
                thread.map((item) => {
                  if (item.type === 'message') {
                    const msg = item.data as ChatMessage;
                    const isUser = msg.sender === 'user';
                    return (
                      <div key={msg.id} className={`flex gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                        {!isUser && (
                          <div className="w-6 h-6 rounded bg-cyan-700 flex-shrink-0 flex items-center justify-center text-xs font-bold text-white mt-0.5">
                            {(msg.agentName || 'A').charAt(0)}
                          </div>
                        )}
                        <div className={`max-w-[75%] px-3 py-2 rounded-lg text-xs leading-relaxed ${
                          isUser ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-200'
                        }`}>
                          {!isUser && msg.agentName && (
                            <div className="text-[10px] font-semibold text-slate-400 mb-1">{msg.agentName}</div>
                          )}
                          {msg.message}
                        </div>
                      </div>
                    );
                  }

                  // Event pill
                  const evt = item.data as AgentEvent;
                  const isTrigger = evt.id === currentApproval.triggeringEventId;
                  return (
                    <div key={evt.id} className={`rounded px-3 py-2 text-xs border ${
                      isTrigger
                        ? 'bg-yellow-600/20 border-yellow-600/50 text-yellow-200'
                        : 'bg-slate-700/40 border-slate-600/50 text-slate-400'
                    }`}>
                      {isTrigger && <div className="text-[10px] font-bold text-yellow-400 mb-0.5">↑ This triggered the approval request</div>}
                      <span className="font-semibold">{evt.title}</span>
                      {evt.description && <div className="text-[10px] mt-0.5 opacity-75">{evt.description}</div>}
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: decision details */}
          <div className="w-64 flex-shrink-0 overflow-y-auto px-4 py-3 space-y-4">
            <div>
              <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Rationale</h3>
              <p className="text-xs text-slate-200 leading-relaxed">{currentApproval.rationale}</p>
            </div>

            {currentApproval.affectedSystems.length > 0 && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Affected</h3>
                <div className="space-y-1">
                  {currentApproval.affectedSystems.map((s, i) => (
                    <div key={i} className="bg-slate-700/60 rounded px-2 py-1 text-xs text-slate-300">{s}</div>
                  ))}
                </div>
              </div>
            )}

            {currentApproval.expectedOutcome && (
              <div>
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">Outcome</h3>
                <p className="text-xs text-slate-200 leading-relaxed">{currentApproval.expectedOutcome}</p>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="border-t border-slate-600 px-6 py-4 space-y-3">
          <div className="flex gap-3">
            <button
              disabled={deciding}
              onClick={() => handleDecide('approved')}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              {deciding ? 'Saving...' : (currentApproval.approveButton || 'Approve')}
            </button>
            <button
              disabled={deciding}
              onClick={() => handleDecide('rejected')}
              className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <XCircle className="w-5 h-5" />
              {currentApproval.rejectButton || 'Reject'}
            </button>
          </div>

          {currentApproval.requestChangesButton && (
            <button
              disabled={deciding}
              onClick={() => handleDecide('needs-revision')}
              className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white px-4 py-3 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
            >
              <AlertCircle className="w-5 h-5" />
              {currentApproval.requestChangesButton}
            </button>
          )}

          {/* Navigation */}
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setCurrentIndex((prev) => (prev - 1 + approvals.length) % approvals.length)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <ChevronLeft className="w-5 h-5" />
              Previous
            </button>
            <button
              onClick={() => setCurrentIndex((prev) => (prev + 1) % approvals.length)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Next
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
