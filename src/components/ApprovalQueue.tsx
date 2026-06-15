import { ApprovalRequest, Agent } from '@/src/types';
import { CheckCircle2, XCircle, AlertCircle, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import { Badge } from './Badge';

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  agents: Agent[];
  onDecide?: (id: string, decision: 'approved' | 'rejected' | 'needs-revision') => Promise<void>;
}

export function ApprovalQueue({ approvals, agents, onDecide }: ApprovalQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical':
        return 'bg-red-600';
      case 'high':
        return 'bg-orange-600';
      case 'medium':
        return 'bg-yellow-600';
      case 'low':
        return 'bg-green-600';
      default:
        return 'bg-slate-600';
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  return (
    <div className="w-80 bg-slate-800 rounded-lg p-4 flex flex-col overflow-hidden border border-slate-700">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
        Approval Queue ({pendingApprovals.length})
      </h2>

      <div className="space-y-3 flex-1 overflow-y-auto">
        {pendingApprovals.length === 0 ? (
          <div className="flex items-center justify-center h-full text-slate-500">
            <p>All approvals handled</p>
          </div>
        ) : (
          pendingApprovals.map((approval) => {
            const agent = agents.find((a) => a.id === approval.agentId);
            const isExpanded = expandedId === approval.id;

            return (
              <div
                key={approval.id}
                className="bg-slate-700 rounded-lg border border-slate-600 overflow-hidden"
              >
                <button
                  onClick={() =>
                    setExpandedId(isExpanded ? null : approval.id)
                  }
                  className="w-full text-left p-3 hover:bg-slate-600/50 transition-colors"
                >
                  <div className="flex items-start gap-3 justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <div
                        className={`w-3 h-3 rounded-full flex-shrink-0 mt-1 ${getRiskColor(approval.riskLevel)}`}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm text-slate-100 line-clamp-2">
                          {approval.action}
                        </h3>
                        {agent && (
                          <p className="text-xs text-slate-400 mt-1">{agent.name}</p>
                        )}
                      </div>
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 flex-shrink-0 text-slate-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    />
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-slate-600 p-3 space-y-3 bg-slate-700/50">
                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
                        Rationale
                      </h4>
                      <p className="text-sm text-slate-300">{approval.rationale}</p>
                    </div>

                    <div>
                      <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
                        Risk Level
                      </h4>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded ${getRiskColor(approval.riskLevel)} text-white`}>
                          {approval.riskLevel.toUpperCase()}
                        </span>
                      </div>
                    </div>

                    {approval.affectedSystems.length > 0 && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
                          Affected Systems
                        </h4>
                        <div className="space-y-1">
                          {approval.affectedSystems.map((system, i) => (
                            <p key={i} className="text-xs text-slate-400">
                              • {system}
                            </p>
                          ))}
                        </div>
                      </div>
                    )}

                    {approval.expectedOutcome && (
                      <div>
                        <h4 className="text-xs font-semibold text-slate-300 uppercase mb-2">
                          Expected Outcome
                        </h4>
                        <p className="text-sm text-slate-300">
                          {approval.expectedOutcome}
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <button
                        onClick={() => onDecide?.(approval.id, 'approved')}
                        className="flex-1 bg-green-600 hover:bg-green-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{approval.approveButton || 'Approve'}</span>
                      </button>
                      <button
                        onClick={() => onDecide?.(approval.id, 'rejected')}
                        className="flex-1 bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>{approval.rejectButton || 'Reject'}</span>
                      </button>
                    </div>

                    {approval.requestChangesButton && (
                      <button
                        onClick={() => onDecide?.(approval.id, 'needs-revision')}
                        className="w-full bg-yellow-600 hover:bg-yellow-700 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                      >
                        <AlertCircle className="w-4 h-4" />
                        <span>{approval.requestChangesButton}</span>
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
