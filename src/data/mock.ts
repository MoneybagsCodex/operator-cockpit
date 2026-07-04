import {
  Agent,
  Project,
  AgentEvent,
  ApprovalRequest,
  ChatMessage,
  DashboardState,
} from '@/src/types';

// Mock Agents — empty until real Claude Code sessions connect via cockpit-hook.sh
export const mockAgents: Agent[] = [];

// Mock Projects — empty until real projects appear from connected agents
export const mockProjects: Project[] = [];

// Mock Approvals — empty
export const mockApprovals: ApprovalRequest[] = [];

// Mock Events — empty
export const mockEvents: AgentEvent[] = [];

// Mock Chat Messages — empty
export const mockChatMessages: ChatMessage[] = [];

// Full Dashboard State — all empty until real agents connect
export const mockDashboardState: DashboardState = {
  projects: mockProjects,
  agents: mockAgents,
  events: mockEvents,
  approvals: mockApprovals,
  chatMessages: mockChatMessages,
};
