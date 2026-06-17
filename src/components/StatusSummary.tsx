'use client';

import { Project, Agent, ChatMessage, AgentEvent } from '@/src/types';
import { useEffect, useState, useRef } from 'react';

interface StatusSummaryProps {
  projects: Project[];
  agents: Agent[];
  chat: Record<string, ChatMessage[]>;
  events: AgentEvent[];
}

async function summarizeConversation(messages: ChatMessage[]): Promise<string> {
  const recent = messages.slice(-6);
  const transcript = recent
    .map((m) => `${m.sender === 'user' ? 'User' : 'Agent'}: ${m.message}`)
    .join('\n');

  const res = await fetch('/api/summarize', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ transcript }),
  });
  if (!res.ok) throw new Error('summarize failed');
  const data = await res.json();
  return data.summary as string;
}

export function StatusSummary({ projects, agents, chat, events }: StatusSummaryProps) {
  const [summaries, setSummaries] = useState<Record<string, string>>({});
  // Track last message count per project so we only re-summarize when content changes
  const lastMsgCount = useRef<Record<string, number>>({});

  useEffect(() => {
    for (const project of projects) {
      const msgs = chat[project.id] || [];
      const prev = lastMsgCount.current[project.id] ?? -1;
      if (msgs.length === 0 || msgs.length === prev) continue;
      lastMsgCount.current[project.id] = msgs.length;

      summarizeConversation(msgs)
        .then((summary) => setSummaries((s) => ({ ...s, [project.id]: summary })))
        .catch(() => {});
    }
  }, [chat, projects]);

  const getFallback = (project: Project): string => {
    const msgs = (chat[project.id] || []).filter((m) => m.sender === 'agent');
    if (msgs.length > 0) {
      const plain = msgs[msgs.length - 1].message
        .replace(/[#*`_~\[\]()>]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      return plain.length > 90 ? plain.slice(0, 87) + '…' : plain;
    }
    const projectEvents = events
      .filter((e) => e.projectId === project.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (projectEvents.length > 0) return projectEvents[0].title;
    return project.nextAction || project.status;
  };

  const getStatusDot = (project: Project) => {
    if (project.blockers.length > 0) return 'bg-red-500';
    if (project.pendingApprovalsCount > 0) return 'bg-yellow-500';
    if (project.status === 'active') return 'bg-green-500';
    if (project.status === 'monitoring') return 'bg-blue-500';
    return 'bg-slate-500';
  };

  if (projects.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 p-3 flex flex-col gap-2">
      <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Where things are</h2>
      <div className="space-y-2">
        {projects.map((project) => {
          const agent = agents.find((a) => a.id === project.assignedAgent);
          const summary = summaries[project.id] || getFallback(project);
          return (
            <div key={project.id} className="flex items-start gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${getStatusDot(project)}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate leading-tight">
                  {project.name}
                  {agent && <span className="text-slate-500 font-normal"> · {agent.name}</span>}
                </p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2">
                  {summary}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
