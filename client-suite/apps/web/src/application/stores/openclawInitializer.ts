/**
 * openclawInitializer —— bootstrap 拉取 + SSE 挂载 + 首次编排
 *
 * initializeOpenClaw：从后端并行拉取 runtimes/tasks/decisions/goals/workOrders/
 * quickCommands/proactive*，一次性 set 进主 store；挂载 SSE handler；
 * 调 switchConversation('primary') + rebuildAttentionItems() 完成 A 栏首屏。
 * 失败写 initError，由 UI 层展示重试。
 */
import { AgentTask } from '../../domain/agent/AgentTask';
import { DecisionRequest } from '../../domain/agent/DecisionRequest';
import { UserGoal } from '../../domain/agent/UserGoal';
import type { WorkOrder } from '../../domain/agent/WorkOrder';
import { DecisionTree } from '../../domain/agent/DecisionTree';
import { AgentRuntime } from '../../domain/agent/AgentRuntime';
import type { AgentRuntimeStatus } from '../../domain/shared/types';
import { AgentOrchestrationService } from '../../domain/agent/AgentOrchestrationService';
import { openclawApiAdapter } from '../../infrastructure/api/openclawApiAdapter';
import { request as apiRequest } from '../../infrastructure/api/openclawApiAdapter';
import { useNotificationStore } from './notificationStore';
import { useAgentStore } from './agentStore';
import { useJudgmentStore } from './judgmentStore';
import { useSignalStore } from './signalStore';
import { createSSEHandler } from './openclawSSEHandler';
import type { OpenClawState } from './openclawTypes';

type SetFn = (
  partial: Partial<OpenClawState> | ((s: OpenClawState) => Partial<OpenClawState>)
) => void;
type GetFn = () => OpenClawState;

async function fetchRuntimesFromAPI(_templates: unknown[]): Promise<AgentRuntime[] | null> {
  try {
    const res = await apiRequest<{ instances?: Record<string, unknown>[] }>('/api/admin/instances');
    const instances = Array.isArray(res?.instances) ? res.instances : Array.isArray(res) ? res : [];
    if (!instances.length) return null;

    return instances.map((inst) =>
      AgentRuntime.create({
        agentId: String(inst.id),
        runtimeStatus: mapInstanceState(String(inst.state || 'stopped')) as AgentRuntimeStatus,
        currentTaskId: null,
        tokenUsage: 0,
        lastActiveAt: inst.updatedAt ? new Date(String(inst.updatedAt)).getTime() : Date.now(),
        connectedChannels: [],
      })
    );
  } catch {
    return null;
  }
}

function mapInstanceState(state: string): string {
  if (state === 'running') return 'active';
  if (state === 'stopped' || state === 'failed') return 'inactive';
  if (state === 'provisioning') return 'starting';
  return 'inactive';
}

async function fetchSystemHealthFromAPI(runtimes: AgentRuntime[]) {
  try {
    const res = await apiRequest<{
      metrics?: { label: string; value: string; status: string }[];
      score?: number;
    }>('/api/admin/analytics/health');
    if (!res?.metrics) return null;

    return AgentOrchestrationService.computeSystemHealth(runtimes);
  } catch {
    return null;
  }
}

async function fetchCollaborationChainsFromAPI() {
  try {
    const res = await apiRequest<{ items?: Record<string, unknown>[] }>('/api/openclaw/sessions');
    const items = res?.items;
    if (!Array.isArray(items) || !items.length) return null;
    return items;
  } catch {
    return null;
  }
}

export async function initializeOpenClaw(set: SetFn, get: GetFn): Promise<void> {
  if (get().runtimes.length > 0) return;
  set({ isInitializing: true, initError: null });

  try {
    const templates = useAgentStore.getState().capabilityRegistry.getAvailableTemplates();

    const apiRuntimes = await fetchRuntimesFromAPI(templates);
    const runtimes = apiRuntimes ?? [];

    const apiHealth = await fetchSystemHealthFromAPI(runtimes);
    const systemHealth = apiHealth ?? AgentOrchestrationService.computeSystemHealth(runtimes);

    const apiChains = await fetchCollaborationChainsFromAPI();
    const collaborationChains = (apiChains ?? []) as unknown as ReturnType<
      typeof get
    >['collaborationChains'];

    const decisionTrees: Record<string, DecisionTree> = {};

    let quickCommands: ReturnType<typeof get>['quickCommands'] = [];
    let proactiveActivities: ReturnType<typeof get>['proactiveActivities'] = [];
    let proactiveInsights: ReturnType<typeof get>['proactiveInsights'] = [];

    let tasks: AgentTask[];
    let decisionRequests: DecisionRequest[];
    let goals: UserGoal[];
    let workOrders: WorkOrder[] = [];

    try {
      const bootstrap = await openclawApiAdapter.fetchBootstrap();
      quickCommands = bootstrap.quickCommands;
      proactiveActivities = bootstrap.proactiveActivities as typeof proactiveActivities;
      proactiveInsights = bootstrap.proactiveInsights as typeof proactiveInsights;
    } catch {
      // bootstrap API unavailable
    }

    try {
      [tasks, decisionRequests, goals, workOrders] = await Promise.all([
        openclawApiAdapter.fetchTasks(),
        openclawApiAdapter.fetchDecisions(),
        openclawApiAdapter.fetchGoals(),
        openclawApiAdapter.fetchWorkOrders({ status: 'pending' }).catch(() => []),
      ]);
      openclawApiAdapter
        .fetchJudgmentRecords()
        .then((records) => {
          const store = useJudgmentStore.getState();
          for (const r of records) store.addRecord(r);
        })
        .catch(() => {});
      useSignalStore.getState().fetchFromBackend();
    } catch {
      tasks = [];
      decisionRequests = [];
      goals = [];
    }

    const activeGoalId = goals.find((g) => g.status === 'active')?.id ?? null;

    set({
      runtimes,
      tasks,
      systemHealth,
      quickCommands,
      proactiveActivities,
      proactiveInsights,
      decisionTrees,
      collaborationChains,
      decisionRequests,
      goals,
      activeGoalId,
      workOrders,
    });

    const notifStore = useNotificationStore.getState();
    for (const dr of decisionRequests) {
      if (dr.responseStatus === 'pending') {
        notifStore.mergeCrossChannelNotifications([
          {
            id: `notif-dec-${dr.id}`,
            type: 'decision' as const,
            title: dr.title,
            body: dr.recommendation.label,
            timestamp: new Date(dr.createdAt).toISOString(),
            read: false,
            sender: { name: '数字员工' },
            decisionId: dr.id,
          },
        ]);
      }
    }

    const sseCleanup = createSSEHandler({ get, set });

    const cleanup = () => {
      sseCleanup();
    };
    set({ _cleanup: cleanup });

    get().switchConversation('primary');
    get().rebuildAttentionItems();
    set({ isInitializing: false });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '初始化失败';
    console.error('[OpenClawStore] initialize failed', err);
    set({ isInitializing: false, initError: msg });
  }
}
