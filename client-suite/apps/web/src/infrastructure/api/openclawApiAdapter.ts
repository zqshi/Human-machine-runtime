import { DecisionRequest, type DecisionRequestProps } from '../../domain/agent/DecisionRequest';
import { AgentTask, type AgentTaskProps } from '../../domain/agent/AgentTask';
import { UserGoal, type UserGoalProps } from '../../domain/agent/UserGoal';
import { JudgmentRecord } from '../../domain/agent/JudgmentRecord';
import { WorkOrder, type WorkOrderProps } from '../../domain/agent/WorkOrder';
import type {
  IOpenClawDataSource,
  OpenClawEvent,
  OpenClawEventType,
  CreateGoalInput,
  DecomposeResult,
  CreateWorkOrderInput,
} from '../../domain/agent/IOpenClawDataSource';

const SSE_RECONNECT_MS = 3000;

const AGENT_COLORS: Record<string, string> = {
  'ops-assistant': '#FF3B30',
  'security-agent': '#AF52DE',
  'dev-assistant': '#007AFF',
  'data-analyst': '#FF9500',
};

function toDecisionRequest(dto: Record<string, unknown>): DecisionRequest {
  return DecisionRequest.create({
    id: String(dto.id),
    agentId: String(dto.agentId),
    title: String(dto.title),
    context: String(dto.context),
    recommendation: dto.recommendation as DecisionRequestProps['recommendation'],
    alternatives: (dto.alternatives ?? []) as DecisionRequestProps['alternatives'],
    urgency: (dto.urgency ?? 'normal') as DecisionRequestProps['urgency'],
    deadline: Number(dto.deadline),
    responseStatus: (dto.responseStatus ?? 'pending') as DecisionRequestProps['responseStatus'],
    userResponse: dto.userResponse as string | undefined,
    responseAt: dto.responseAt as number | undefined,
    createdAt: Number(dto.createdAt),
    impactScope: Number(dto.impactScope ?? 0),
    downstreamTaskIds: (dto.downstreamTaskIds ?? []) as string[],
    downstreamGoalIds: (dto.downstreamGoalIds ?? []) as string[],
  });
}

function toAgentTask(dto: Record<string, unknown>): AgentTask {
  return AgentTask.create({
    id: String(dto.id),
    agentId: String(dto.agentId),
    todoId: String(dto.todoId ?? `todo-${dto.id}`),
    name: String(dto.name),
    status: (dto.status ?? 'queued') as AgentTaskProps['status'],
    progress: Number(dto.progress ?? 0),
    subtasks: (dto.subtasks ?? []) as AgentTaskProps['subtasks'],
    logs: (dto.logs ?? []) as AgentTaskProps['logs'],
    color: String(dto.color ?? AGENT_COLORS[String(dto.agentId)] ?? '#8E8E93'),
    createdAt: Number(dto.createdAt),
    updatedAt: Number(dto.updatedAt),
  });
}

function toUserGoal(dto: Record<string, unknown>): UserGoal {
  return UserGoal.create({
    id: String(dto.id),
    title: String(dto.title),
    description: String(dto.description ?? ''),
    priority: (dto.priority ?? 'normal') as UserGoalProps['priority'],
    status: (dto.status ?? 'active') as UserGoalProps['status'],
    deadline: dto.deadline as number | undefined,
    milestones: (dto.milestones ?? []) as UserGoalProps['milestones'],
    progressUpdates: (dto.progressUpdates ?? []) as UserGoalProps['progressUpdates'],
    relatedTaskIds: (dto.relatedTaskIds ?? []) as string[],
    relatedDecisionIds: (dto.relatedDecisionIds ?? []) as string[],
    createdAt: Number(dto.createdAt),
    updatedAt: Number(dto.updatedAt),
    intent: dto.intent as string | undefined,
    constraints: dto.constraints as UserGoalProps['constraints'] | undefined,
    authorization: dto.authorization as UserGoalProps['authorization'] | undefined,
    successCriteria: dto.successCriteria as UserGoalProps['successCriteria'] | undefined,
    ownerId: dto.ownerId as string | undefined,
    collaboratorIds: dto.collaboratorIds as string[] | undefined,
    parentGoalId: dto.parentGoalId as string | undefined,
    decompositionStrategy: dto.decompositionStrategy as string | undefined,
  });
}

function toWorkOrder(dto: Record<string, unknown>): WorkOrder {
  return WorkOrder.create({
    id: String(dto.id),
    type: (dto.type ?? 'input') as WorkOrderProps['type'],
    fromUserId: String(dto.fromUserId),
    toUserId: String(dto.toUserId),
    goalId: String(dto.goalId ?? ''),
    taskId: dto.taskId as string | undefined,
    title: String(dto.title),
    context: String(dto.context ?? ''),
    aiSuggestion: dto.aiSuggestion as string | undefined,
    confidence: Number(dto.confidence ?? 0),
    status: (dto.status ?? 'pending') as WorkOrderProps['status'],
    response: dto.response as string | undefined,
    respondedAt: dto.respondedAt as number | undefined,
    deadline: Number(dto.deadline),
    createdAt: Number(dto.createdAt),
  });
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    credentials: 'include',
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => undefined);
    throw new Error(
      `API ${res.status}: ${(body as Record<string, unknown>)?.error ?? res.statusText}`
    );
  }
  const text = await res.text();
  return text ? JSON.parse(text) : (undefined as T);
}

export class OpenClawApiAdapter implements IOpenClawDataSource {
  async fetchDecisions(filter?: { status?: string }): Promise<DecisionRequest[]> {
    const qs = filter?.status ? `?status=${encodeURIComponent(filter.status)}` : '';
    const res = await request<{ items: Record<string, unknown>[] }>(`/api/openclaw/decisions${qs}`);
    return res.items.map(toDecisionRequest);
  }

  async respondDecision(
    id: string,
    action: 'accept' | 'modify' | 'decline' | 'defer',
    params?: { feedback?: string; optionId?: string; deferUntil?: number }
  ): Promise<DecisionRequest> {
    const res = await request<{ decision: Record<string, unknown> }>(
      `/api/openclaw/decisions/${encodeURIComponent(id)}/respond`,
      { method: 'POST', body: JSON.stringify({ action, ...params }) }
    );
    return toDecisionRequest(res.decision);
  }

  async fetchTasks(): Promise<AgentTask[]> {
    const res = await request<{ items: Record<string, unknown>[] }>('/api/openclaw/tasks');
    return res.items.map(toAgentTask);
  }

  async updateTask(
    id: string,
    patch: Partial<Pick<AgentTaskProps, 'status' | 'progress'>>
  ): Promise<AgentTask> {
    const res = await request<Record<string, unknown>>(
      `/api/openclaw/tasks/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    );
    return toAgentTask(res);
  }

  async fetchGoals(filter?: { ownerId?: string; collaboratorId?: string }): Promise<UserGoal[]> {
    const params = new URLSearchParams();
    if (filter?.ownerId) params.set('ownerId', filter.ownerId);
    if (filter?.collaboratorId) params.set('collaboratorId', filter.collaboratorId);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await request<{ items: Record<string, unknown>[] }>(`/api/openclaw/goals${qs}`);
    return res.items.map(toUserGoal);
  }

  async updateGoal(id: string, patch: Partial<Pick<UserGoalProps, 'status'>>): Promise<UserGoal> {
    const res = await request<Record<string, unknown>>(
      `/api/openclaw/goals/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(patch) }
    );
    return toUserGoal(res);
  }

  async createGoal(input: CreateGoalInput): Promise<UserGoal> {
    const res = await request<Record<string, unknown>>('/api/openclaw/goals', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return toUserGoal(res);
  }

  async decomposeGoal(id: string, apply = false): Promise<DecomposeResult> {
    const res = await request<Record<string, unknown>>(
      `/api/openclaw/goals/${encodeURIComponent(id)}/decompose`,
      { method: 'POST', body: JSON.stringify({ apply }) }
    );
    return {
      applied: Boolean(res.applied),
      category: res.category as string | undefined,
      goal: res.goal ? toUserGoal(res.goal as Record<string, unknown>) : undefined,
      tasks: res.tasks ? (res.tasks as Record<string, unknown>[]).map(toAgentTask) : undefined,
      suggestedTasks: res.suggestedTasks as Record<string, unknown>[] | undefined,
      suggestedMilestones: res.suggestedMilestones as Record<string, unknown>[] | undefined,
    };
  }

  async addCollaborator(goalId: string, userId: string): Promise<UserGoal> {
    const res = await request<{ goal: Record<string, unknown> }>(
      `/api/openclaw/goals/${encodeURIComponent(goalId)}/collaborators`,
      { method: 'POST', body: JSON.stringify({ userId }) }
    );
    return toUserGoal(res.goal);
  }

  async removeCollaborator(goalId: string, userId: string): Promise<UserGoal> {
    const res = await request<{ goal: Record<string, unknown> }>(
      `/api/openclaw/goals/${encodeURIComponent(goalId)}/collaborators/${encodeURIComponent(userId)}`,
      { method: 'DELETE' }
    );
    return toUserGoal(res.goal);
  }

  async fetchWorkOrders(filter?: { status?: string }): Promise<WorkOrder[]> {
    const qs = filter?.status ? `?status=${encodeURIComponent(filter.status)}` : '';
    const res = await request<{ items: Record<string, unknown>[] }>(
      `/api/openclaw/workorders${qs}`
    );
    return res.items.map(toWorkOrder);
  }

  async fetchSentWorkOrders(): Promise<WorkOrder[]> {
    const res = await request<{ items: Record<string, unknown>[] }>(
      '/api/openclaw/workorders/sent'
    );
    return res.items.map(toWorkOrder);
  }

  async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
    const res = await request<Record<string, unknown>>('/api/openclaw/workorders', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    return toWorkOrder(res);
  }

  async respondWorkOrder(id: string, response: string): Promise<WorkOrder> {
    const res = await request<Record<string, unknown>>(
      `/api/openclaw/workorders/${encodeURIComponent(id)}/respond`,
      { method: 'POST', body: JSON.stringify({ response }) }
    );
    return toWorkOrder(res);
  }

  async fetchInbox(): Promise<{
    workOrders: WorkOrder[];
    goalCount: number;
    pendingCount: number;
  }> {
    const res = await request<{
      workOrders: Record<string, unknown>[];
      goalCount: number;
      pendingCount: number;
    }>('/api/openclaw/inbox');
    return {
      workOrders: res.workOrders.map(toWorkOrder),
      goalCount: res.goalCount,
      pendingCount: res.pendingCount,
    };
  }

  async fetchJudgmentRecords(filter?: { decisionId?: string }): Promise<JudgmentRecord[]> {
    const qs = filter?.decisionId ? `?decisionId=${encodeURIComponent(filter.decisionId)}` : '';
    const res = await request<{ items: Record<string, unknown>[] }>(
      `/api/openclaw/judgment-records${qs}`
    );
    return res.items.map((dto) => JudgmentRecord.rehydrate(dto));
  }

  subscribeEvents(handler: (event: OpenClawEvent) => void): () => void {
    let es: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;

    const connect = () => {
      if (stopped) return;
      es = new EventSource('/api/openclaw/events', { withCredentials: true });

      const eventTypes: OpenClawEventType[] = [
        'connected',
        'decision:created',
        'decision:updated',
        'task:updated',
        'goal:updated',
        'workorder:created',
        'workorder:completed',
        'artifact:created',
        'artifact:progress',
        'artifact:completed',
        'signal:created',
        'correction:applied',
        'intent:dispatched',
        'session:created',
        'session:escalated',
        'escalation:triggered',
        'escalation:resolved',
        'agent-profile:updated',
        'objective:updated',
        'objective:decoded',
        'emergent-signal:detected',
        'pattern:discovered',
      ];

      for (const type of eventTypes) {
        es.addEventListener(type, (e: MessageEvent) => {
          try {
            handler({ type, data: JSON.parse(e.data) });
          } catch {
            /* malformed event */
          }
        });
      }

      es.onerror = () => {
        es?.close();
        es = null;
        if (!stopped) {
          reconnectTimer = setTimeout(connect, SSE_RECONNECT_MS);
        }
      };
    };

    connect();

    return () => {
      stopped = true;
      es?.close();
      es = null;
      if (reconnectTimer) clearTimeout(reconnectTimer);
    };
  }
  async fetchBootstrap(): Promise<{
    quickCommands: Array<{ id: string; icon: string; label: string; desc: string }>;
    proactiveActivities: Array<{
      id: string;
      icon: string;
      iconColor: string;
      action: string;
      detail: string;
      time: string;
      category: string;
    }>;
    proactiveInsights: Array<{
      id: string;
      icon: string;
      color: string;
      title: string;
      description: string;
      urgency: string;
    }>;
  }> {
    return request('/api/openclaw/bootstrap');
  }

  async executeAgent(
    userText: string,
    responseText: string,
    sessionId: string
  ): Promise<{ intent: string | null; artifactId?: string; artifactType?: string }> {
    return request('/api/openclaw/agent/execute', {
      method: 'POST',
      body: JSON.stringify({ userText, responseText, sessionId }),
    });
  }
}

export const openclawApiAdapter = new OpenClawApiAdapter();

// ─── Judgment Records ────────────────────────────────────────────────

export async function fetchJudgmentRecords(filter?: {
  decisionId?: string;
}): Promise<Record<string, unknown>[]> {
  const qs = filter?.decisionId ? `?decisionId=${encodeURIComponent(filter.decisionId)}` : '';
  const res = await request<{ items: Record<string, unknown>[] }>(
    `/api/openclaw/judgment-records${qs}`
  );
  return res.items;
}

export async function createJudgmentRecord(
  record: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return request('/api/openclaw/judgment-records', {
    method: 'POST',
    body: JSON.stringify(record),
  });
}

// ─── Signals ─────────────────────────────────────────────────────────

export async function fetchSignals(filter?: {
  urgency?: string;
}): Promise<Record<string, unknown>[]> {
  const qs = filter?.urgency ? `?urgency=${encodeURIComponent(filter.urgency)}` : '';
  const res = await request<{ items: Record<string, unknown>[] }>(`/api/openclaw/signals${qs}`);
  return res.items;
}
