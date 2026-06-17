'use client';

import { ApprovalRequest, Agent, LearnedThreshold } from '@/src/types';
import { CheckCircle2, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  agents: Agent[];
  preferences?: LearnedThreshold[];
  onDecide?: (id: string, decision: 'approved' | 'rejected' | 'needs-revision') => Promise<void>;
}

export function ApprovalQueue({ approvals, agents, preferences = [], onDecide }: ApprovalQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deciding, setDeciding] = useState<Set<string>>(new Set());

  // One pending approval per agent — most recent wins
  const pendingByAgent = approvals
    .filter((a) => a.status === 'pending')
    .reduce<Record<string, ApprovalRequest>>((acc, a) => {
      const existing = acc[a.agentId];
      if (!existing || new Date(a.createdAt) > new Date(existing.createdAt)) {
        acc[a.agentId] = a;
      }
      return acc;
    }, {});
  const pending = Object.values(pendingByAgent);

  const decide = async (id: string, decision: 'approved' | 'rejected' | 'needs-revision') => {
    if (deciding.has(id)) return;
    setDeciding((prev) => new Set([...prev, id]));
    try {
      await onDecide?.(id, decision);
      if (expandedId === id) setExpandedId(null);
    } finally {
      setDeciding((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  };

  const approveAll = async () => {
    await Promise.all(pending.map((a) => decide(a.id, 'approved')));
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return 'bg-red-600';
      case 'high': return 'bg-orange-600';
      case 'medium': return 'bg-yellow-600';
      case 'low': return 'bg-green-600';
      default: return 'bg-slate-600';
    }
  };

  return (
    <div className="w-80 bg-slate-800 rounded-lg p-4 flex flex-col overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Approvals {pending.length > 0 && `(${pending.length})`}
        </h2>
        {pending.length > 1 && (
          <button
            onClick={approveAll}
            className="text-xs bg-green-600 hover:bg-green-700 text-white px-2.5 py-1 rounded transition-colors font-semibold"
          >
            Approve All
          </button>
        )}
      </div>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {pending.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500 text-sm">
            All clear
          </div>
        ) : (
          pending.map((approval) => {
            const agent = agents.find((a) => a.id === approval.agentId);
            const isExpanded = expandedId === approval.id;
            const isDeciding = deciding.has(approval.id);

            return (
              <div
                key={approval.id}
                className="bg-slate-700 rounded-lg border border-slate-600 overflow-hidden"
              >
                {/* Collapsed header — always visible */}
                <div className="p-3">
                  <div className="flex items-start gap-2 mb-2.5">
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${getRiskColor(approval.riskLevel)}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-slate-100 font-medium leading-snug line-clamp-2">
                        {approval.action}
                      </p>
                      {agent && (
                        <div className="flex items-center gap-2 mt-0.5">
                          <p className="text-xs text-slate-400">{agent.name}</p>
                          {(() => {
                            const p = preferences.find(
                              (p) => p.agentId === approval.agentId && p.riskLevel === approval.riskLevel
                            );
                            if (!p || p.approvals + p.rejections + p.revisions < 2) return null;
                            const pct = Math.round(p.confidence * 100);
                            return (
                              <span className={`text-xs px-1 py-0.5 rounded ${p.confidence >= 0.85 ? 'bg-green-900/50 text-green-400' : p.confidence >= 0.5 ? 'bg-yellow-900/50 text-yellow-400' : 'bg-red-900/50 text-red-400'}`}>
                                {pct}% approve rate
                              </span>
                            );
                          })()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Action buttons always visible */}
                  <div className="flex gap-2">
                    <button
                      onClick={() => decide(approval.id, 'approved')}
                      disabled={isDeciding}
                      className="flex-1 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {approval.approveButton || 'Approve'}
                    </button>
                    <button
                      onClick={() => decide(approval.id, 'rejected')}
                      disabled={isDeciding}
                      className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white px-2 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {approval.rejectButton || 'Reject'}
                    </button>
                    <button
                      onClick={() => setExpandedId(isExpanded ? null : approval.id)}
                      className="text-slate-400 hover:text-slate-200 p-1.5 rounded hover:bg-slate-600 transition-colors"
                      title="Show details"
                    >
                      <ChevronDown className={`w-4 h-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-slate-600 p-3 space-y-3 bg-slate-700/50 text-sm">
                    <div>
                      <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Rationale</p>
                      <p className="text-slate-300">{approval.rationale}</p>
                    </div>

                    {approval.affectedSystems.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Affected</p>
                        <p className="text-slate-400 text-xs">{approval.affectedSystems.join(', ')}</p>
                      </div>
                    )}

                    {approval.expectedOutcome && (
                      <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase mb-1">Outcome</p>
                        <p className="text-slate-300">{approval.expectedOutcome}</p>
                      </div>
                    )}

                    {approval.requestChangesButton && (
                      <button
                        onClick={() => decide(approval.id, 'needs-revision')}
                        disabled={isDeciding}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 disabled:opacity-40 text-white px-3 py-1.5 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1"
                      >
                        <AlertCircle className="w-3.5 h-3.5" />
                        {approval.requestChangesButton}
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
