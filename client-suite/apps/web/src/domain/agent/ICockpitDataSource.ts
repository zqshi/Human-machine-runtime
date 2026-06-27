import type { DecisionRequest } from './DecisionRequest';
import type { AgentTask, AgentTaskProps } from './AgentTask';
import type { UserGoal, UserGoalProps } from './UserGoal';
import type { JudgmentRecord } from './JudgmentRecord';
import type { WorkOrder, WorkOrderProps } from './WorkOrder';

export type CockpitEventType =
  | 'decision:created'
  | 'decision:updated'
  | 'task:updated'
  | 'goal:updated'
  | 'workorder:created'
  | 'workorder:completed'
  | 'artifact:created'
  | 'artifact:progress'
  | 'artifact:completed'
  | 'connected'
  | 'signal:created'
  | 'correction:applied'
  | 'intent:dispatched'
  | 'session:created'
  | 'session:escalated'
  | 'escalation:triggered'
  | 'escalation:resolved'
  | 'agent-profile:updated'
  | 'objective:updated'
  | 'objective:decoded'
  | 'emergent-signal:detected'
  | 'pattern:discovered'
  | 'runtime:message-scored'
  | 'runtime:recommendation'
  | 'orchestration:chain-created'
  | 'orchestration:step-advanced'
  | 'orchestration:escalation-created'
  | 'receipt:sent';

export interface CockpitEvent {
  type: CockpitEventType;
  data: Record<string, unknown>;
}

export interface CreateGoalInput {
  title?: string;
  intent: string;
  description?: string;
  priority?: UserGoalProps['priority'];
  deadline?: number;
  constraints?: UserGoalProps['constraints'];
  authorization?: UserGoalProps['authorization'];
  successCriteria?: UserGoalProps['successCriteria'];
  collaboratorIds?: string[];
  parentGoalId?: string;
}

export interface TaskAssignment {
  taskId: string;
  assigneeId: string;
  assigneeType: 'person' | 'agent';
  assigneeName: string;
  reason: string;
  confidence: number;
}

export interface RiskItem {
  id: string;
  level: 'high' | 'medium' | 'low';
  description: string;
  mitigation: string;
}

export interface DecomposeResult {
  applied: boolean;
  category?: string;
  goal?: UserGoal;
  tasks?: AgentTask[];
  suggestedTasks?: Record<string, unknown>[];
  suggestedMilestones?: Record<string, unknown>[];
  assignments?: TaskAssignment[];
  riskAnalysis?: RiskItem[];
}

export interface CreateWorkOrderInput {
  toUserId: string;
  title: string;
  type?: WorkOrderProps['type'];
  goalId?: string;
  taskId?: string;
  context?: string;
  aiSuggestion?: string;
  confidence?: number;
  deadline?: number;
}

export interface ICockpitDataSource {
  fetchDecisions(filter?: { status?: string }): Promise<DecisionRequest[]>;
  respondDecision(
    id: string,
    action: 'accept' | 'modify' | 'decline' | 'defer',
    params?: { feedback?: string; optionId?: string; deferUntil?: number }
  ): Promise<DecisionRequest>;
  fetchTasks(): Promise<AgentTask[]>;
  updateTask(
    id: string,
    patch: Partial<Pick<AgentTaskProps, 'status' | 'progress'>>
  ): Promise<AgentTask>;
  fetchGoals(filter?: { ownerId?: string; collaboratorId?: string }): Promise<UserGoal[]>;
  updateGoal(id: string, patch: Partial<Pick<UserGoalProps, 'status'>>): Promise<UserGoal>;
  createGoal(input: CreateGoalInput): Promise<UserGoal>;
  decomposeGoal(id: string, apply?: boolean): Promise<DecomposeResult>;
  addCollaborator(goalId: string, userId: string): Promise<UserGoal>;
  removeCollaborator(goalId: string, userId: string): Promise<UserGoal>;
  fetchWorkOrders(filter?: { status?: string }): Promise<WorkOrder[]>;
  fetchSentWorkOrders(): Promise<WorkOrder[]>;
  createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder>;
  respondWorkOrder(id: string, response: string): Promise<WorkOrder>;
  fetchInbox(): Promise<{ workOrders: WorkOrder[]; goalCount: number; pendingCount: number }>;
  fetchJudgmentRecords(filter?: { decisionId?: string }): Promise<JudgmentRecord[]>;
  subscribeEvents(handler: (event: CockpitEvent) => void): () => void;
}
