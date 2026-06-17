// 底层 request 由统一 httpClient 工厂提供；同时 re-export 供兄弟 adapter（Phase1/Sensing/Objective/Collaboration）复用
import { request } from './httpClient';
export { request };
import {
  DecisionRequest,
  type DecisionRequestProps,
  type DecisionUrgency,
  type DecisionResponseStatus,
  type RecommendationOption,
} from '../../domain/agent/DecisionRequest';
import {
  AgentTask,
  type AgentTaskProps,
  type AgentSubtask,
  type ExecutionLog,
} from '../../domain/agent/AgentTask';
import type { AgentTaskStatus } from '../../domain/shared/types';
import {
  UserGoal,
  type UserGoalProps,
  type GoalPriority,
  type GoalStatus,
  type GoalMilestone,
  type GoalProgressUpdate,
  type GoalConstraint,
  type GoalAuthorization,
  type GoalSuccessCriteria,
} from '../../domain/agent/UserGoal';
import { JudgmentRecord } from '../../domain/agent/JudgmentRecord';
import {
  WorkOrder,
  type WorkOrderProps,
  type WorkOrderType,
  type WorkOrderStatus,
} from '../../domain/agent/WorkOrder';
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

// ─── DTO 运行时类型守卫 ─────────────────────────────────────────────
// 目的：消除所有 `as XxxProps['field']` 类型断言。对联合枚举、数组、
// 嵌套对象字段做运行时收窄，让编译器能捕获 DTO 字段类型变化。
// 说明：本项目未引入 zod（client-suite 无任何 workspace 声明该依赖，
// 根 node_modules 中的 zod 为其他工具间接依赖，不可直接 import），
// 故采用零依赖的类型守卫函数，效果等价：编译期类型安全 + 运行时收窄。

const DECISION_URGENCY: readonly DecisionUrgency[] = [
  'critical',
  'high',
  'normal',
  'low',
];
const DECISION_RESPONSE_STATUS: readonly DecisionResponseStatus[] = [
  'pending',
  'accepted',
  'modified',
  'declined',
  'deferred',
  'expired',
];
const TASK_STATUS: readonly AgentTaskStatus[] = [
  'queued',
  'running',
  'paused',
  'completed',
  'failed',
];
const GOAL_PRIORITY: readonly GoalPriority[] = ['critical', 'high', 'normal', 'low'];
const GOAL_STATUS: readonly GoalStatus[] = [
  'active',
  'paused',
  'completed',
  'archived',
  'cancelled',
];
const WORK_ORDER_TYPE: readonly WorkOrderType[] = ['approval', 'review', 'input', 'decision'];
const WORK_ORDER_STATUS: readonly WorkOrderStatus[] = [
  'pending',
  'completed',
  'expired',
  'auto_resolved',
];

function isString(v: unknown): v is string {
  return typeof v === 'string';
}
function isNumber(v: unknown): v is number {
  return typeof v === 'number' && Number.isFinite(v);
}
function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === 'string');
}
function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** 类型守卫：判断 value 是否属于白名单字面量集合。 */
function isEnumValue<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  // 此处的 `as T` 是实现类型守卫的固有代价：Array.includes(searchElement: T)
  // 要求参数类型为 T，而本函数的职责正是证明 unknown === T，故无法回避。
  // 它是"局部类型断言换取全局类型安全"的取舍点，与待消除的 DTO as 断言性质不同。
  return typeof value === 'string' && allowed.includes(value as T);
}

/** 枚举收窄：落入白名单返回原值，否则返回 fallback。 */
function pickEnum<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return isEnumValue(value, allowed) ? value : fallback;
}

/** 可选原始值收窄：类型匹配返回值，否则 undefined。 */
function optionalString(v: unknown): string | undefined {
  return isString(v) ? v : undefined;
}
function optionalNumber(v: unknown): number | undefined {
  return isNumber(v) ? v : undefined;
}

function isRecommendationOption(v: unknown): v is RecommendationOption {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isString(v.label) &&
    isString(v.description) &&
    isString(v.reasoning) &&
    isString(v.estimatedImpact) &&
    (v.riskLevel === 'low' || v.riskLevel === 'medium' || v.riskLevel === 'high')
  );
}

function isAgentSubtask(v: unknown): v is AgentSubtask {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isString(v.name) &&
    (v.status === 'pending' ||
      v.status === 'running' ||
      v.status === 'success' ||
      v.status === 'failed')
  );
}

function isExecutionLog(v: unknown): v is ExecutionLog {
  if (!isRecord(v)) return false;
  return (
    isNumber(v.timestamp) &&
    (v.level === 'INFO' || v.level === 'WARN' || v.level === 'ERROR' || v.level === 'DEBUG') &&
    isString(v.message)
  );
}

function isMilestone(v: unknown): v is GoalMilestone {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isString(v.name) &&
    (v.status === 'pending' || v.status === 'active' || v.status === 'completed') &&
    (v.relatedTaskIds === undefined || isStringArray(v.relatedTaskIds))
  );
}

function isProgressUpdate(v: unknown): v is GoalProgressUpdate {
  if (!isRecord(v)) return false;
  return (
    isNumber(v.timestamp) &&
    isString(v.agentId) &&
    isString(v.message) &&
    (v.milestoneId === undefined || isString(v.milestoneId))
  );
}

function isConstraint(v: unknown): v is GoalConstraint {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    (v.type === 'budget' ||
      v.type === 'timeline' ||
      v.type === 'compliance' ||
      v.type === 'quality' ||
      v.type === 'custom') &&
    isString(v.description) &&
    (v.threshold === undefined || isString(v.threshold)) &&
    typeof v.hardLimit === 'boolean'
  );
}

function isAuthorization(v: unknown): v is GoalAuthorization {
  if (!isRecord(v)) return false;
  return (
    (v.autoExecute === undefined || isStringArray(v.autoExecute)) &&
    (v.requireOwner === undefined || isStringArray(v.requireOwner)) &&
    (v.requireCollaborator === undefined || Array.isArray(v.requireCollaborator))
  );
}

function isSuccessCriteria(v: unknown): v is GoalSuccessCriteria {
  if (!isRecord(v)) return false;
  return (
    isString(v.id) &&
    isString(v.metric) &&
    isString(v.target) &&
    isString(v.measureMethod) &&
    (v.currentValue === undefined || isString(v.currentValue))
  );
}

/** 数组元素守卫：返回符合谓词的元素数组，丢弃非法元素（与原 `as` 行为一致：静默容忍脏数据）。 */
function filterArray<T>(value: unknown, guard: (x: unknown) => x is T): T[] {
  return Array.isArray(value) ? value.filter(guard) : [];
}

function toDecisionRequest(dto: Record<string, unknown>): DecisionRequest {
  const recommendation = isRecommendationOption(dto.recommendation)
    ? dto.recommendation
    : // DTO 必含 recommendation；收窄失败时给最小合法占位，避免 domain 构造抛错。
      // 此分支仅在 DTO 结构异常时触达，等同于原 `as` 在运行时也是裸传。
      ({
        id: String(dto.id),
        label: '',
        description: '',
        reasoning: '',
        estimatedImpact: '',
        riskLevel: 'low',
      } satisfies RecommendationOption);

  return DecisionRequest.create({
    id: String(dto.id),
    agentId: String(dto.agentId),
    title: String(dto.title),
    context: String(dto.context),
    recommendation,
    alternatives: filterArray(dto.alternatives, isRecommendationOption),
    urgency: pickEnum(dto.urgency, DECISION_URGENCY, 'normal'),
    deadline: Number(dto.deadline),
    responseStatus: pickEnum(dto.responseStatus, DECISION_RESPONSE_STATUS, 'pending'),
    userResponse: optionalString(dto.userResponse),
    responseAt: optionalNumber(dto.responseAt),
    createdAt: Number(dto.createdAt),
    impactScope: Number(dto.impactScope ?? 0),
    downstreamTaskIds: isStringArray(dto.downstreamTaskIds) ? dto.downstreamTaskIds : [],
    downstreamGoalIds: isStringArray(dto.downstreamGoalIds) ? dto.downstreamGoalIds : [],
  });
}

function toAgentTask(dto: Record<string, unknown>): AgentTask {
  return AgentTask.create({
    id: String(dto.id),
    agentId: String(dto.agentId),
    todoId: String(dto.todoId ?? `todo-${dto.id}`),
    name: String(dto.name),
    status: pickEnum(dto.status, TASK_STATUS, 'queued'),
    progress: Number(dto.progress ?? 0),
    subtasks: filterArray(dto.subtasks, isAgentSubtask),
    logs: filterArray(dto.logs, isExecutionLog),
    color: String(dto.color ?? AGENT_COLORS[String(dto.agentId)] ?? '#8E8E93'),
    createdAt: Number(dto.createdAt),
    updatedAt: Number(dto.updatedAt),
  });
}

function toUserGoal(dto: Record<string, unknown>): UserGoal {
  const authorization = isAuthorization(dto.authorization)
    ? {
        autoExecute: isStringArray(dto.authorization.autoExecute) ? dto.authorization.autoExecute : [],
        requireOwner: isStringArray(dto.authorization.requireOwner)
          ? dto.authorization.requireOwner
          : [],
        requireCollaborator: Array.isArray(dto.authorization.requireCollaborator)
          ? dto.authorization.requireCollaborator
          : [],
      }
    : undefined;

  return UserGoal.create({
    id: String(dto.id),
    title: String(dto.title),
    description: String(dto.description ?? ''),
    priority: pickEnum(dto.priority, GOAL_PRIORITY, 'normal'),
    status: pickEnum(dto.status, GOAL_STATUS, 'active'),
    deadline: optionalNumber(dto.deadline),
    milestones: filterArray(dto.milestones, isMilestone),
    progressUpdates: filterArray(dto.progressUpdates, isProgressUpdate),
    relatedTaskIds: isStringArray(dto.relatedTaskIds) ? dto.relatedTaskIds : [],
    relatedDecisionIds: isStringArray(dto.relatedDecisionIds) ? dto.relatedDecisionIds : [],
    createdAt: Number(dto.createdAt),
    updatedAt: Number(dto.updatedAt),
    intent: optionalString(dto.intent),
    constraints: filterArray(dto.constraints, isConstraint),
    authorization,
    successCriteria: filterArray(dto.successCriteria, isSuccessCriteria),
    ownerId: optionalString(dto.ownerId),
    collaboratorIds: isStringArray(dto.collaboratorIds) ? dto.collaboratorIds : [],
    parentGoalId: optionalString(dto.parentGoalId),
    decompositionStrategy: optionalString(dto.decompositionStrategy),
  });
}

function toWorkOrder(dto: Record<string, unknown>): WorkOrder {
  return WorkOrder.create({
    id: String(dto.id),
    type: pickEnum(dto.type, WORK_ORDER_TYPE, 'input'),
    fromUserId: String(dto.fromUserId),
    toUserId: String(dto.toUserId),
    goalId: String(dto.goalId ?? ''),
    taskId: optionalString(dto.taskId),
    title: String(dto.title),
    context: String(dto.context ?? ''),
    aiSuggestion: optionalString(dto.aiSuggestion),
    confidence: Number(dto.confidence ?? 0),
    status: pickEnum(dto.status, WORK_ORDER_STATUS, 'pending'),
    response: optionalString(dto.response),
    respondedAt: optionalNumber(dto.respondedAt),
    deadline: Number(dto.deadline),
    createdAt: Number(dto.createdAt),
  });
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
    // res.tasks / suggestedTasks / suggestedMilestones 是 Record[]，
    // 通过 Array.isArray + isRecord 守卫收窄，消除 as Record<string, unknown>[] 断言。
    const toArray = (v: unknown): Record<string, unknown>[] =>
      Array.isArray(v) ? v.filter(isRecord) : [];
    return {
      applied: Boolean(res.applied),
      category: optionalString(res.category),
      goal: isRecord(res.goal) ? toUserGoal(res.goal) : undefined,
      tasks: Array.isArray(res.tasks) && res.tasks.length ? toArray(res.tasks).map(toAgentTask) : undefined,
      // DecomposeResult 的 suggested* 字段为原始 Record[]（透传给上层 UI 渲染，不进 domain 构造），
      // 此处不假设其内部结构，仅保证返回值类型为 Record<string, unknown>[]。
      suggestedTasks: Array.isArray(res.suggestedTasks) ? toArray(res.suggestedTasks) : undefined,
      suggestedMilestones: Array.isArray(res.suggestedMilestones)
        ? toArray(res.suggestedMilestones)
        : undefined,
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
