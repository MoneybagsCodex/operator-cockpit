'use client';

import { mockDashboardState } from '@/src/data/mock';
import { ChatThread } from '@/src/components/ChatThread';
import { ApprovalQueue } from '@/src/components/ApprovalQueue';
import { DecisionCarousel } from '@/src/components/DecisionCarousel';
import { AgentStatusBar } from '@/src/components/AgentStatusBar';
import { StatusSummary } from '@/src/components/StatusSummary';
import { useLiveState } from '@/src/hooks/useLiveState';
import { useState } from 'react';

export default function Dashboard() {
  const { events, approvals, agents, projects, chat, connected, usingMockData, decide, preferences } = useLiveState();
  const [closedProjects, setClosedProjects] = useState<Set<string>>(new Set());

  const pendingApprovals = approvals.filter((a) => a.status === 'pending');

  // Use real projects when available, otherwise fall back to mock
  const hasRealProjects = projects.length > 0;
  const displayProjects = (hasRealProjects ? projects : mockDashboardState.projects)
    .filter((p) => !closedProjects.has(p.id));
  const displayAgents = agents.length > 0 ? agents : mockDashboardState.agents;

  const getChatMessages = (projectId: string) => {
    const live = chat[projectId];
    if (live && live.length > 0) return live;
    // only use mock chat when showing mock projects
    if (!hasRealProjects) return mockDashboardState.chatMessages.filter((m) => m.projectId === projectId);
    return [];
  };

  const allChatMessages = Object.values(chat).flat();

  return (
    <>
      {pendingApprovals.length > 0 && (
        <DecisionCarousel
          approvals={pendingApprovals}
          agents={displayAgents}
          chatMessages={allChatMessages}
          events={events}
          autoAdvance={true}
          autoAdvanceDelay={8000}
          onDecide={decide}
        />
      )}

      <div className="flex flex-col h-screen bg-slate-900">
        <AgentStatusBar
          agents={displayAgents}
          connected={connected}
          usingMockData={usingMockData}
        />

        <div className="flex flex-1 overflow-hidden gap-4 p-4">
          <div className="w-80 flex-shrink-0 flex flex-col gap-4">
            <StatusSummary
              projects={displayProjects}
              agents={displayAgents}
              chat={chat}
              events={events}
            />
            <ApprovalQueue approvals={approvals} agents={displayAgents} preferences={preferences} onDecide={decide} />
          </div>

          <div className={`flex-1 grid gap-4 overflow-hidden ${displayProjects.length === 1 ? 'grid-cols-1' : displayProjects.length <= 4 ? 'grid-cols-2' : 'grid-cols-3'}`}>
            {displayProjects.map((project) => {
              const agent = displayAgents.find((a) => a.id === project.assignedAgent);
              const projectMessages = getChatMessages(project.id);
              const projectEvents = events.filter((e) => e.projectId === project.id);
              const hasPendingDecision = pendingApprovals.some((a) => a.projectId === project.id);

              return (
                <ChatThread
                  key={project.id}
                  project={project}
                  agent={agent}
                  messages={projectMessages}
                  events={projectEvents}
                  highlighted={hasPendingDecision}
                  onClose={() => setClosedProjects((prev) => new Set([...prev, project.id]))}
                />
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}
