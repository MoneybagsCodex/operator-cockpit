'use client';

import { useEffect, useState, useRef } from 'react';
import { AgentEvent, ApprovalRequest, Agent, Project, ChatMessage, DashboardState } from '@/src/types';
import { mockDashboardState } from '@/src/data/mock';

interface LiveState {
  events: AgentEvent[];
  approvals: ApprovalRequest[];
  agents: Agent[];
  projects: Project[];
  chat: Record<string, ChatMessage[]>;
  connected: boolean;
  usingMockData: boolean;
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
  });

  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    const token = process.env.NEXT_PUBLIC_API_TOKEN;
    const es = new EventSource(token ? `/api/stream?token=${encodeURIComponent(token)}` : '/api/stream');
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

  const decide = async (id: string, decision: 'approved' | 'rejected' | 'needs-revision', notes?: string) => {
    const token = process.env.NEXT_PUBLIC_API_TOKEN;
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    await fetch(`/api/approvals/${id}/decide`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ decision, notes }),
    });
  };

  return { ...state, decide };
}

// Re-export DashboardState shape for convenience
export type { DashboardState };
