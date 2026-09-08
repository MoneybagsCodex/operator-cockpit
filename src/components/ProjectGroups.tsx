'use client';

import { FolderKanban, Trash2 } from 'lucide-react';
import type { ProjectGroup } from '@/src/app/api/project-groups/route';

interface ProjectGroupsProps {
  groups: ProjectGroup[];
  /** How many of a group's pinned threads currently have a live terminal open. */
  liveCounts: Record<string, number>;
  onLaunch: (group: ProjectGroup) => void;
  onDelete: (id: string) => void;
}

// Sidebar list of saved project groups — each pins specific terminal threads
// (not just agent configs) so relaunching resumes the exact same conversations
// rather than starting fresh ones. A group here exists independent of whether
// any of its terminals are currently open.
export function ProjectGroups({ groups, liveCounts, onLaunch, onDelete }: ProjectGroupsProps) {
  if (groups.length === 0) return null;

  return (
    <div className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
      <div className="px-3 py-2.5 flex items-center gap-2 border-b border-slate-700">
        <FolderKanban className="w-3.5 h-3.5 text-slate-400" />
        <span className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Projects</span>
        <span className="text-xs text-slate-500">({groups.length})</span>
      </div>
      <div>
        {groups.map((g) => {
          const live = liveCounts[g.id] ?? 0;
          const running = live > 0;
          return (
            <div
              key={g.id}
              className="w-full flex items-center gap-2 px-3 py-2 hover:bg-slate-700/50 border-b border-slate-700/30 last:border-0 transition-colors group"
            >
              <button onClick={() => onLaunch(g)} className="flex items-center gap-2 flex-1 min-w-0 text-left">
                <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: g.color }} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-medium text-slate-200 truncate">{g.name}</div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {g.members.length} agent{g.members.length === 1 ? '' : 's'}
                  </div>
                </div>
              </button>
              <span
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${
                  running ? 'bg-emerald-500/15 text-emerald-400' : 'bg-slate-700 text-slate-500'
                }`}
              >
                {running ? `live · ${live}` : 'not running'}
              </span>
              <button
                onClick={() => onDelete(g.id)}
                className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 flex-shrink-0"
                title="Forget this project (doesn't close any open terminals)"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
