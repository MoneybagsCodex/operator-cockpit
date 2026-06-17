// Source tag for events written from different surfaces
export type AgentEventSource = 'api' | 'file' | 'github-actions' | 'bridge' | 'claude-code' | 'custom';

// How much autonomy an agent has — manual starting point, refined by learned preferences
export type TrustLevel = 'monitor' | 'assistant' | 'autonomous' | 'full-auto';

// Learned confidence for a specific (agent, risk) combination
export interface LearnedThreshold {
  agentId: string;
  riskLevel: ApprovalRiskLevel;
  approvals: number;
  rejections: number;
  revisions: number;
  confidence: number; // 0–1
  autoApprove: boolean; // true when confidence > 0.85 and total >= 5
  lastDecision: string;
}

// Agent Event Types
export type AgentEventType =
  | 'task-started'
  | 'task-progress'
  | 'approval-needed'
  | 'blocker-found'
  | 'waiting-for-input'
  | 'task-complete'
  | 'message';

export type ApprovalRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'needs-revision';
export type TaskStage = 'planning' | 'researching' | 'drafting' | 'executing' | 'testing' | 'waiting-approval' | 'done';
export type ProjectStatus = 'active' | 'waiting-approval' | 'blocked' | 'monitoring' | 'paused' | 'complete';
export type UrgencyLevel = 'low' | 'medium' | 'high' | 'critical';

// Core Agent
export interface Agent {
  id: string;
  name: string;
  type: 'autonomous' | 'subagent' | 'monitor';
  status: 'idle' | 'working' | 'waiting' | 'blocked';
  lastHeartbeat: Date;
  confidenceLevel: number; // 0-1
  currentTask?: string;
  currentStage?: TaskStage;
  projectId: string;
  model?: string;
  trustLevel?: TrustLevel;
}

// Project
export interface Project {
  id: string;
  name: string;
  priority: number; // 1-10
  status: ProjectStatus;
  assignedAgent: string; // agent.id
  latestUpdate: Date;
  nextAction?: string;
  blockers: string[];
  pendingApprovalsCount: number;
}

// Agent Event (the core signal)
export interface AgentEvent {
  id: string;
  agentId: string;
  agentName: string;
  timestamp: Date;
  eventType: AgentEventType;
  projectId: string;

  // Core message to operator
  title: string;
  description: string;
  urgency: UrgencyLevel;

  // If approval needed
  approval?: ApprovalRequest;

  // If waiting for input
  inputNeeded?: {
    question: string;
    options?: string[];
  };

  // Metadata
  relatedFiles?: string[];
  context?: Record<string, unknown>;

  // Traceability
  serializedAt?: Date | string;
  source?: AgentEventSource;
}

// Approval Request
export interface ApprovalRequest {
  id: string;
  agentId: string;
  projectId: string;
  status: ApprovalStatus;

  // What action is being requested?
  action: string;
  rationale: string;

  // Risk assessment
  riskLevel: ApprovalRiskLevel;
  affectedSystems: string[];
  expectedOutcome: string;

  // UI hints
  approveButton?: string;
  rejectButton?: string;
  requestChangesButton?: string;

  // Context linking: what conversation/event triggered this?
  triggeringEventId?: string;
  recentMessages?: Array<{ sender: string; message: string; timestamp: Date | string }>;

  // Timeline
  createdAt: Date;
  expiresAt?: Date;
}

// Chat Message
export interface ChatMessage {
  id: string;
  projectId: string;
  sender: 'user' | 'agent';
  agentId?: string;
  agentName?: string;
  message: string;
  timestamp: Date;
  contextChips?: ContextChip[];
}

// Context Chips (show current state)
export interface ContextChip {
  type: 'project' | 'agent' | 'mode' | 'status';
  value: string;
  color?: string;
}

// Dashboard State
export interface DashboardState {
  projects: Project[];
  agents: Agent[];
  events: AgentEvent[];
  approvals: ApprovalRequest[];
  chatMessages: ChatMessage[];
  selectedProject?: string;
  selectedAgent?: string;
}
