import fs from 'fs';
import path from 'path';
import { PATHS } from './state';

export type WatchEvent = {
  type: 'event' | 'approval' | 'agent' | 'project' | 'chat';
  action: 'added' | 'changed' | 'removed';
  filename: string;
  subdir?: string;
};

type WatchCallback = (event: WatchEvent) => void;

const watchers: fs.FSWatcher[] = [];

export function startWatching(callback: WatchCallback): () => void {
  const watch = (dir: string, type: WatchEvent['type']) => {
    try {
      const watcher = fs.watch(dir, (eventType, filename) => {
        if (!filename || (!filename.endsWith('.json') && !filename.endsWith('.jsonl'))) return;
        callback({
          type,
          action: eventType === 'rename' ? 'added' : 'changed',
          filename,
        });
      });
      watchers.push(watcher);
    } catch {
      // dir may not exist yet; that's ok
    }
  };

  watch(PATHS.events, 'event');
  watch(PATHS.approvals.pending, 'approval');
  watch(PATHS.approvals.approved, 'approval');
  watch(PATHS.approvals.rejected, 'approval');
  watch(PATHS.approvals['needs-revision'], 'approval');
  watch(PATHS.agents, 'agent');
  watch(PATHS.projects, 'project');

  // Watch each project's chat dir (and top-level chat dir for new project dirs)
  try {
    const chatDirs = fs.readdirSync(PATHS.chat);
    for (const projectDir of chatDirs) {
      watch(path.join(PATHS.chat, projectDir), 'chat');
    }
  } catch { /* chat dir may not exist yet */ }
  try {
    const topWatcher = fs.watch(PATHS.chat, (_, filename) => {
      if (filename) {
        // New project chat dir appeared — watch it too
        const newDir = path.join(PATHS.chat, filename);
        try {
          if (fs.statSync(newDir).isDirectory()) {
            watch(newDir, 'chat');
          }
        } catch { /* race condition */ }
        callback({ type: 'chat', action: 'added', filename });
      }
    });
    watchers.push(topWatcher);
  } catch { /* chat dir may not exist yet */ }

  return () => {
    watchers.forEach((w) => w.close());
    watchers.length = 0;
  };
}
