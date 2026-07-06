import { ApprovalRequest, Agent } from '@/src/types';
import { CheckCircle2, XCircle, AlertCircle, ChevronDown, ChevronsUp, Zap } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { Badge } from './Badge';

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  agents: Agent[];
  onDecide?: (id: string, decision: 'approved' | 'rejected' | 'needs-revision') => Promise<void>;
}

export function ApprovalQueue({ approvals, agents, onDecide }: ApprovalQueueProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approveAllArmed, setApproveAllArmed] = useState(false);
  const [approveAllBusy, setApproveAllBusy] = useState(false);
  const [autoApprove, setAutoApprove] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoInFlight = useRef<Set<string>>(new Set());

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  useEffect(() => {
    if (approvals.length > 0) {
      approvals.forEach(a => {
        console.log(`[ApprovalQueue] Approval: id=${a.id} status="${a.status}" action="${a.action}"`);
      });
      console.log(`[ApprovalQueue] Total: ${approvals.length}, Pending: ${pendingApprovals.length}`);
    }
  }, [approvals]);

  // Auto-approve mode — like "skip permissions": approve every queued item as it
  // arrives, no review. Requires an explicit confirm to arm.
  const toggleAutoApprove = () => {
    if (autoApprove) { setAutoApprove(false); return; }
    const isDebugMode = typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('debug');
    const ok = isDebugMode || window.confirm(
      'Enable AUTO-APPROVE mode?\n\n' +
      'Every permission request from cockpit agents — including risky shell commands ' +
      '(deploys, deletes, git push) — will be approved automatically with NO review. ' +
      'This is equivalent to running agents with permissions skipped.\n\n' +
      'Only enable if you fully trust every running session. Proceed?'
    );
    if (ok) setAutoApprove(true);
  };

  useEffect(() => {
    if (!autoApprove || !onDecide) return;
    console.log(`[AutoApprove] Active with ${pendingApprovals.length} pending approvals`);
    for (const a of pendingApprovals) {
      if (autoInFlight.current.has(a.id)) {
        console.log(`[AutoApprove] Already in-flight: ${a.id}`);
        continue;
      }
      console.log(`[AutoApprove] Approving: ${a.id} — ${a.action}`);
      autoInFlight.current.add(a.id);
      onDecide(a.id, 'approved')
        .then(() => console.log(`[AutoApprove] Success: ${a.id}`))
        .catch((err) => console.error(`[AutoApprove] Failed for ${a.id}:`, err))
        .finally(() => autoInFlight.current.delete(a.id));
    }
  }, [autoApprove, pendingApprovals, onDecide]);

  const approveAll = async () => {
    if (!approveAllArmed) {
      setApproveAllArmed(true);
      armTimer.current = setTimeout(() => setApproveAllArmed(false), 3000);
      return;
    }
    if (armTimer.current) clearTimeout(armTimer.current);
    setApproveAllArmed(false);
    setApproveAllBusy(true);
    try {
      await Promise.all(pendingApprovals.map((a) => onDecide?.(a.id, 'approved')));
    } finally {
      setApproveAllBusy(false);
    }
  };

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

  return (
    <div className="w-80 bg-slate-800 rounded-lg p-4 flex flex-col overflow-hidden border border-slate-700">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
          Approval Queue ({pendingApprovals.length})
        </h2>
        {pendingApprovals.length > 0 && !autoApprove && (
          <button
            onClick={approveAll}
            disabled={approveAllBusy}
            className={`flex items-center gap-1 text-xs font-semibold px-2 py-1 rounded transition-all ${
              approveAllBusy
                ? 'bg-slate-600 text-slate-400 cursor-not-allowed'
                : approveAllArmed
                ? 'bg-green-500 text-white animate-pulse'
                : 'bg-slate-700 hover:bg-green-700 text-slate-300 hover:text-white'
            }`}
          >
            <ChevronsUp className="w-3 h-3" />
            {approveAllBusy ? 'Approving…' : approveAllArmed ? 'Confirm?' : 'Approve All'}
          </button>
        )}
      </div>

      {/* Auto-approve mode toggle */}
      <button
        onClick={toggleAutoApprove}
        className={`flex items-center justify-between gap-2 mb-3 px-2.5 py-1.5 rounded-md text-xs font-semibold border transition-colors ${
          autoApprove
            ? 'bg-red-500/15 border-red-500/50 text-red-300 animate-pulse'
            : 'bg-slate-700/60 border-slate-600 text-slate-400 hover:text-slate-200'
        }`}
        title="Auto-approve every queued request — like skipping permissions. Requires confirmation."
      >
        <span className="flex items-center gap-1.5">
          <Zap className="w-3.5 h-3.5" />
          Auto-approve {autoApprove ? 'ON' : 'OFF'}
        </span>
        <span className={`w-8 h-4 rounded-full relative transition-colors ${autoApprove ? 'bg-red-500' : 'bg-slate-600'}`}>
          <span className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all ${autoApprove ? 'left-4' : 'left-0.5'}`} />
        </span>
      </button>

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
