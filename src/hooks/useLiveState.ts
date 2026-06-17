'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { AgentEvent, ApprovalRequest, Agent, Project, ChatMessage, DashboardState, LearnedThreshold } from '@/src/types';
import { mockDashboardState } from '@/src/data/mock';

interface LiveState {
  events: AgentEvent[];
  approvals: ApprovalRequest[];
  agents: Agent[];
  projects: Project[];
  chat: Record<string, ChatMessage[]>;
  connected: boolean;
  usingMockData: boolean;
  preferences: LearnedThreshold[];
}

function deserializeDates<T extends Record<string, unknown>>(obj: T): T {
  const dateFields = ['timestamp', 'lastHeartbeat', 'latestUpdate', 'createdAt', 'expiresAt', 'serializedAt'];
  const result = { ...obj };
  for (const key of dateFields) {
    if (result[key] && typeof result[key] === 'string') {
      (result as Record<string, unknown>)[key] = new Date(result[key] as string);
    }
  }
  return result;
}

const TRUST_BASELINE: Record<string, string[]> = {
  monitor:     [],
  assistant:   ['low'],
  autonomous:  ['low', 'medium'],
  'full-auto': ['low', 'medium', 'high'],
};

export function useLiveState(): LiveState & {
  decide: (id: string, decision: 'approved' | 'rejected' | 'needs-revision', notes?: string) => Promise<void>;
} {
  const [state, setState] = useState<LiveState>({
    events: mockDashboardState.events,
    approvals: mockDashboardState.approvals,
    agents: mockDashboardState.agents,
    projects: mockDashboardState.projects,
    chat: {},
    connected: false,
    usingMockData: true,
    preferences: [],
  });

  const esRef = useRef<EventSource | null>(null);
  const autoApprovedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const es = new EventSource('/api/stream');
    esRef.current = es;

    es.onopen = () => {
      setState((prev) => ({ ...prev, connected: true }));
    };

    es.onmessage = (e) => {
      const msg = JSON.parse(e.data) as {
        type: string;
        data: unknown;
      };

      if (msg.type === 'snapshot') {
        const snap = msg.data as {
          events: AgentEvent[];
          approvals: ApprovalRequest[];
          agents: Agent[];
          projects: Project[];
          chat?: Record<string, ChatMessage[]>;
        };

        const hasRealChat = snap.chat && Object.keys(snap.chat).length > 0;
        const hasRealApprovals = snap.approvals.length > 0;
        const hasRealData = hasRealChat || hasRealApprovals;

        setState((prev) => ({
          ...prev,
          events: snap.events.map((e) => deserializeDates(e as unknown as Record<string, unknown>) as unknown as AgentEvent),
          approvals: snap.approvals.map((a) => deserializeDates(a as unknown as Record<string, unknown>) as unknown as ApprovalRequest),
          agents: snap.agents.length > 0 ? snap.agents.map((a) => deserializeDates(a as unknown as Record<string, unknown>) as unknown as Agent) : prev.agents,
          projects: snap.projects.length > 0 ? snap.projects : prev.projects,
          chat: Object.fromEntries(
            Object.entries(snap.chat || {}).map(([pid, msgs]) => [
              pid,
              (msgs as ChatMessage[]).map((m) => ({ ...m, timestamp: new Date(m.timestamp as unknown as string) })),
            ])
          ),
          usingMockData: !hasRealData,
        }));
      } else if (msg.type === 'events') {
        const events = (msg.data as AgentEvent[]).map((e) => deserializeDates(e as unknown as Record<string, unknown>) as unknown as AgentEvent);
        setState((prev) => ({ ...prev, events, usingMockData: false }));
      } else if (msg.type === 'approvals') {
        const approvals = (msg.data as ApprovalRequest[]).map((a) => deserializeDates(a as unknown as Record<string, unknown>) as unknown as ApprovalRequest);
        setState((prev) => ({ ...prev, approvals, usingMockData: false }));
      } else if (msg.type === 'agents') {
        const agents = (msg.data as Agent[]).map((a) => deserializeDates(a as unknown as Record<string, unknown>) as unknown as Agent);
        setState((prev) => ({ ...prev, agents }));
      } else if (msg.type === 'projects') {
        setState((prev) => ({ ...prev, projects: msg.data as Project[] }));
      } else if (msg.type === 'chat') {
        const raw = msg.data as Record<string, ChatMessage[]>;
        const chat: Record<string, ChatMessage[]> = {};
        for (const [pid, msgs] of Object.entries(raw)) {
          chat[pid] = msgs.map((m) => ({ ...m, timestamp: new Date(m.timestamp as unknown as string) }));
        }
        setState((prev) => ({ ...prev, chat }));
      }
    };

    es.onerror = () => {
      setState((prev) => ({ ...prev, connected: false }));
    };

    return () => {
      es.close();
    };
  }, []);

  const decide = useCallback(async (id: string, decision: 'approved' | 'rejected' | 'needs-revision', notes?: string) => {
    await fetch(`/api/approvals/${id}/decide`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision, notes }),
    });
  }, []);

  // Load preferences once on mount
  useEffect(() => {
    fetch('/api/preferences')
      .then((r) => r.json())
      .then((prefs: LearnedThreshold[]) => setState((prev) => ({ ...prev, preferences: prefs })))
      .catch(() => {});
  }, []);

  // Auto-approve pending items that fall below the agent's threshold
  useEffect(() => {
    const pending = state.approvals.filter((a) => a.status === 'pending');
    for (const approval of pending) {
      if (autoApprovedRef.current.has(approval.id)) continue;
      const agent = state.agents.find((a) => a.id === approval.agentId);
      const trustLevel = agent?.trustLevel ?? 'monitor';
      const learned = state.preferences.find(
        (p) => p.agentId === approval.agentId && p.riskLevel === approval.riskLevel
      );
      const shouldAuto = learned
        ? learned.autoApprove
        : (TRUST_BASELINE[trustLevel] ?? []).includes(approval.riskLevel);

      if (shouldAuto) {
        autoApprovedRef.current.add(approval.id);
        decide(approval.id, 'approved').catch(() => {});
      }
    }
  }, [state.approvals, state.agents, state.preferences, decide]);

  return { ...state, decide };
}

// Re-export DashboardState shape for convenience
export type { DashboardState };
