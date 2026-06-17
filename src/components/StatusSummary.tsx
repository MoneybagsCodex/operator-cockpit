'use client';

import { Project, Agent, ChatMessage, AgentEvent } from '@/src/types';

interface StatusSummaryProps {
  projects: Project[];
  agents: Agent[];
  chat: Record<string, ChatMessage[]>;
  events: AgentEvent[];
}

export function StatusSummary({ projects, agents, chat, events }: StatusSummaryProps) {
  const getOneLiner = (project: Project): string => {
    // Last agent message in this project's chat
    const msgs = (chat[project.id] || []).filter((m) => m.sender === 'agent');
    if (msgs.length > 0) {
      const last = msgs[msgs.length - 1].message;
      // Strip markdown and truncate
      const plain = last.replace(/[#*`_~\[\]()>]/g, '').replace(/\s+/g, ' ').trim();
      return plain.length > 90 ? plain.slice(0, 87) + '…' : plain;
    }

    // Fall back to latest event
    const projectEvents = events
      .filter((e) => e.projectId === project.id)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    if (projectEvents.length > 0) return projectEvents[0].title;

    // Fall back to project metadata
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
          return (
            <div key={project.id} className="flex items-start gap-2">
              <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1.5 ${getStatusDot(project)}`} />
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-300 truncate leading-tight">
                  {project.name}
                  {agent && <span className="text-slate-500 font-normal"> · {agent.name}</span>}
                </p>
                <p className="text-xs text-slate-500 leading-snug mt-0.5 line-clamp-2">
                  {getOneLiner(project)}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
