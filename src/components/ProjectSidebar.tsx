import { Project, Agent } from '@/src/types';
import { mockDashboardState } from '@/src/data/mock';
import { AlertCircle, Clock, CheckCircle2 } from 'lucide-react';

interface ProjectSidebarProps {
  projects: Project[];
  agents: Agent[];
  selectedProjectId?: string;
  onSelectProject: (projectId: string) => void;
}

export function ProjectSidebar({
  projects,
  agents,
  selectedProjectId,
  onSelectProject,
}: ProjectSidebarProps) {
  const getAgentColor = (agentName: string) => {
    const colorMap: Record<string, string> = {
      Architect: 'bg-purple-600',
      Ops: 'bg-cyan-600',
      Researcher: 'bg-blue-600',
      Auditor: 'bg-pink-600',
    };
    return colorMap[agentName] || 'bg-gray-600';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'blocked':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'monitoring':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  return (
    <div className="w-64 bg-slate-800 rounded-lg p-4 flex flex-col overflow-hidden border border-slate-700">
      <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">
        Projects
      </h2>

      <div className="space-y-2 flex-1 overflow-y-auto">
        {projects.map((project) => {
          const agent = agents.find((a) => a.id === project.assignedAgent);
          const isSelected = project.id === selectedProjectId;

          return (
            <button
              key={project.id}
              onClick={() => onSelectProject(project.id)}
              className={`w-full text-left p-3 rounded-lg transition-colors ${
                isSelected
                  ? 'bg-slate-700 border border-slate-600'
                  : 'hover:bg-slate-700/50 border border-transparent'
              }`}
            >
              <div className="flex items-start justify-between mb-2">
                <span className="text-sm font-medium text-slate-100 line-clamp-1">
                  {project.name}
                </span>
                {getStatusIcon(project.status)}
              </div>

              {agent && (
                <div className="flex items-center gap-2 mb-2">
                  <div
                    className={`w-6 h-6 rounded ${getAgentColor(agent.name)} flex items-center justify-center text-xs font-bold text-white`}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <span className="text-xs text-slate-400">{agent.name}</span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500">
                  Priority: {project.priority}
                </span>
                {project.pendingApprovalsCount > 0 && (
                  <span className="bg-red-600 text-white text-xs px-2 py-1 rounded">
                    {project.pendingApprovalsCount}
                  </span>
                )}
              </div>

              {project.blockers.length > 0 && (
                <div className="mt-2 text-xs text-red-400">
                  🚫 {project.blockers[0]}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="border-t border-slate-700 pt-4 mt-4">
        <div className="text-xs text-slate-500 space-y-1">
          <div>
            Working: {mockDashboardState.agents.filter((a) => a.status === 'working').length}
          </div>
          <div>
            Blocked: {mockDashboardState.agents.filter((a) => a.status === 'blocked').length}
          </div>
        </div>
      </div>
    </div>
  );
}
