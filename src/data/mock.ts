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

// Mock Approvals — test data for auto-approve feature
export const mockApprovals: ApprovalRequest[] = [
  {
    id: 'approval-test-1',
    agentId: 'test-agent-1',
    projectId: 'operator-cockpit',
    status: 'pending' as const,
    action: 'Run: git push origin main',
    rationale: 'Push latest changes to main branch after all tests pass',
    riskLevel: 'high',
    affectedSystems: ['GitHub', 'CI/CD Pipeline'],
    expectedOutcome: 'Changes are pushed to remote repository and CI/CD pipeline is triggered',
    approveButton: 'Push to main',
    rejectButton: 'Cancel push',
    createdAt: new Date(),
  },
  {
    id: 'approval-test-2',
    agentId: 'test-agent-2',
    projectId: 'operator-cockpit',
    status: 'pending' as const,
    action: 'Run: npm install --save-dev @testing-library/react',
    rationale: 'Add testing library dependency for unit tests',
    riskLevel: 'low',
    affectedSystems: ['Dependencies'],
    expectedOutcome: 'New package is installed in node_modules and package.json is updated',
    approveButton: 'Install',
    rejectButton: 'Skip',
    createdAt: new Date(),
  },
];

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
