import fs from 'fs';
import path from 'path';
import os from 'os';
import { AgentEvent, ApprovalRequest, Agent, Project, ChatMessage, ApprovalStatus } from '@/src/types';

export const STATE_DIR = process.env.OPERATOR_STATE_DIR || path.join(os.homedir(), '.operator-state');

export const PATHS = {
  events: path.join(STATE_DIR, 'events'),
  approvals: {
    pending: path.join(STATE_DIR, 'approvals', 'pending'),
    approved: path.join(STATE_DIR, 'approvals', 'approved'),
    rejected: path.join(STATE_DIR, 'approvals', 'rejected'),
    'needs-revision': path.join(STATE_DIR, 'approvals', 'needs-revision'),
  },
  agents: path.join(STATE_DIR, 'agents'),
  projects: path.join(STATE_DIR, 'projects'),
  chat: path.join(STATE_DIR, 'chat'),
};

function readJsonFile<T>(filePath: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return null;
  }
}

function writeJsonFile(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

// Events

export function readEvents(): AgentEvent[] {
  try {
    return fs.readdirSync(PATHS.events)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJsonFile<AgentEvent>(path.join(PATHS.events, f)))
      .filter((e): e is AgentEvent => e !== null)
      .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  } catch {
    return [];
  }
}

export function writeEvent(event: AgentEvent): void {
  const ts = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${ts}-${event.id}.json`;
  const serializedAt = event.serializedAt instanceof Date
    ? event.serializedAt.toISOString()
    : event.serializedAt || new Date().toISOString();
  writeJsonFile(path.join(PATHS.events, filename), {
    ...event,
    serializedAt,
    source: event.source || 'api',
  });
}

// Approvals

export function readApprovals(status?: ApprovalStatus | 'all'): ApprovalRequest[] {
  const statuses: ApprovalStatus[] = status === 'all' || !status
    ? ['pending', 'approved', 'rejected', 'needs-revision']
    : [status];

  return statuses.flatMap((s) => {
    try {
      const dir = PATHS.approvals[s];
      return fs.readdirSync(dir)
        .filter((f) => f.endsWith('.json'))
        .map((f) => readJsonFile<ApprovalRequest>(path.join(dir, f)))
        .filter((a): a is ApprovalRequest => a !== null);
    } catch {
      return [];
    }
  });
}

export function writeApproval(approval: ApprovalRequest): void {
  const filename = `${approval.id}.json`;
  writeJsonFile(path.join(PATHS.approvals.pending, filename), approval);
}

export function decideApproval(
  id: string,
  decision: ApprovalStatus,
  notes?: string
): ApprovalRequest | null {
  // Find which status dir the approval is currently in
  const sourceStatuses: ApprovalStatus[] = ['pending', 'approved', 'rejected', 'needs-revision'];
  let sourceFile: string | null = null;
  let approval: ApprovalRequest | null = null;

  for (const s of sourceStatuses) {
    const candidate = path.join(PATHS.approvals[s], `${id}.json`);
    if (fs.existsSync(candidate)) {
      sourceFile = candidate;
      approval = readJsonFile<ApprovalRequest>(candidate);
      break;
    }
  }

  if (!sourceFile || !approval) return null;

  const updated: ApprovalRequest = {
    ...approval,
    status: decision,
  };

  const destFile = path.join(PATHS.approvals[decision], `${id}.json`);
  writeJsonFile(destFile, { ...updated, decidedAt: new Date().toISOString(), decisionNotes: notes });

  if (sourceFile !== destFile) {
    try { fs.unlinkSync(sourceFile); } catch { /* already moved */ }
  }

  return updated;
}

// Agents

export function readAgents(): Agent[] {
  try {
    return fs.readdirSync(PATHS.agents)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJsonFile<Agent>(path.join(PATHS.agents, f)))
      .filter((a): a is Agent => a !== null);
  } catch {
    return [];
  }
}

export function writeAgentHeartbeat(agent: Agent): void {
  writeJsonFile(path.join(PATHS.agents, `${agent.id}.json`), {
    ...agent,
    lastHeartbeat: new Date().toISOString(),
  });
}

// Projects

export function readProjects(): Project[] {
  try {
    return fs.readdirSync(PATHS.projects)
      .filter((f) => f.endsWith('.json'))
      .map((f) => readJsonFile<Project>(path.join(PATHS.projects, f)))
      .filter((p): p is Project => p !== null);
  } catch {
    return [];
  }
}

// Chat

export function readChat(projectId: string): ChatMessage[] {
  const chatDir = path.join(PATHS.chat, projectId);
  try {
    return fs.readdirSync(chatDir)
      .filter((f) => f.endsWith('.jsonl'))
      .sort()
      .flatMap((f) => {
        const content = fs.readFileSync(path.join(chatDir, f), 'utf-8');
        return content.trim().split('\n')
          .filter(Boolean)
          .map((line) => {
            try { return JSON.parse(line) as ChatMessage; } catch { return null; }
          })
          .filter((m): m is ChatMessage => m !== null);
      });
  } catch {
    return [];
  }
}

export function readAllChat(): Record<string, ChatMessage[]> {
  const result: Record<string, ChatMessage[]> = {};
  try {
    const projects = fs.readdirSync(PATHS.chat);
    for (const projectId of projects) {
      result[projectId] = readChat(projectId);
    }
  } catch { /* empty */ }
  return result;
}

export function appendChat(projectId: string, message: ChatMessage): void {
  const today = new Date().toISOString().split('T')[0];
  const chatDir = path.join(PATHS.chat, projectId);
  fs.mkdirSync(chatDir, { recursive: true });
  fs.appendFileSync(path.join(chatDir, `${today}.jsonl`), JSON.stringify(message) + '\n');
}

// State check: is real state populated?
export function hasRealState(): boolean {
  try {
    const events = fs.readdirSync(PATHS.events).filter((f) => f.endsWith('.json'));
    const agents = fs.readdirSync(PATHS.agents).filter((f) => f.endsWith('.json'));
    return events.length > 0 || agents.length > 0;
  } catch {
    return false;
  }
}

// Auto-approve settings — persists toggle state per agent

const AUTO_APPROVE_FILE = path.join(STATE_DIR, 'auto-approve-settings.json');

interface AutoApproveSettings {
  [agentId: string]: boolean;
}

export function getAutoApproveSettings(): AutoApproveSettings {
  return readJsonFile<AutoApproveSettings>(AUTO_APPROVE_FILE) ?? {};
}

export function setAutoApprove(agentId: string, enabled: boolean): void {
  const settings = getAutoApproveSettings();
  settings[agentId] = enabled;
  writeJsonFile(AUTO_APPROVE_FILE, settings);
}

export function isAutoApprovedForAgent(agentId: string): boolean {
  const settings = getAutoApproveSettings();
  return settings[agentId] === true;
}

// Watch for newly approved decisions for a given agent
export function watchApprovalFor(
  agentId: string,
  callback: (approval: ApprovalRequest, decision: ApprovalStatus) => void,
  interval: number = 500
): () => void {
  let lastCheck: Record<string, ApprovalStatus> = {};

  const check = () => {
    const approvals = readApprovals('all');
    for (const a of approvals) {
      if (a.agentId !== agentId) continue;
      const prev = lastCheck[a.id];
      if (prev !== a.status) {
        lastCheck[a.id] = a.status;
        // Only notify on state change away from pending
        if (prev === 'pending' && a.status !== 'pending') {
          callback(a, a.status);
        }
      }
    }
  };

  const timer = setInterval(check, interval);
  check(); // initial check

  return () => clearInterval(timer);
}
