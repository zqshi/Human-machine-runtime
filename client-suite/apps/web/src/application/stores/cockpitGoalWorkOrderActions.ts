/**
 * cockpitGoalWorkOrderActions — 目标 + 工单 CRUD 动作
 *
 * 从 cockpitStore 拆分，降低主文件行数。
 */
import { cockpitApiAdapter } from '../../infrastructure/api/cockpitApiAdapter';
import { useToastStore } from './toastStore';
import { AgentTask } from '../../domain/agent/AgentTask';
import { WorkOrder } from '../../domain/agent/WorkOrder';
import { UserGoal } from '../../domain/agent/UserGoal';
import type {
  CreateGoalInput,
  DecomposeResult,
  CreateWorkOrderInput,
  TaskAssignment,
} from '../../domain/agent/ICockpitDataSource';
import type { StoreSet, StoreGet } from './cockpitTypes';

export function goalActions(set: StoreSet, get: StoreGet) {
  return {
    addGoal(goal: UserGoal) {
      set({ goals: [...get().goals, goal] });
    },

    updateGoal(goalId: string, updater: (g: UserGoal) => UserGoal) {
      set({
        goals: get().goals.map((g) => (g.id === goalId ? updater(g) : g)),
      });
    },

    setActiveGoal(goalId: string | null) {
      set({ activeGoalId: goalId });
    },

    async createGoal(input: CreateGoalInput): Promise<UserGoal> {
      try {
        const goal = await cockpitApiAdapter.createGoal(input);
        set({ goals: [goal, ...get().goals] });
        get().rebuildAttentionItems();
        useToastStore.getState().addToast(`目标已创建: ${goal.title}`, 'success');
        return goal;
      } catch (err) {
        useToastStore.getState().addToast('创建目标失败', 'error');
        throw err;
      }
    },

    async decomposeGoal(goalId: string, apply = false): Promise<DecomposeResult> {
      const goal = get().goals.find((g) => g.id === goalId);
      if (!goal) throw new Error('goal not found');

      try {
        const result = await cockpitApiAdapter.decomposeGoal(goalId, apply);

        if (apply && !result.applied) {
          const now = Date.now();
          const tasks = (result.suggestedTasks ?? []).map((t) =>
            AgentTask.create({
              id: String(t.id ?? `task-${now}-${Math.random().toString(36).slice(2, 7)}`),
              agentId: String(t.agentId ?? 'dev-assistant'),
              todoId: `todo-${t.id}`,
              name: String(t.name),
              status: (t.status as 'running' | 'queued') ?? 'queued',
              progress: 0,
              subtasks: [],
              logs: [],
              color: '#007AFF',
              createdAt: now,
              updatedAt: now,
            })
          );
          const milestones = (result.suggestedMilestones ?? []).map((m, i) => ({
            id: String((m as Record<string, unknown>).id ?? `ms-${now}-${i}`),
            name: String((m as Record<string, unknown>).name),
            status: (i === 0 ? 'active' : 'pending') as 'active' | 'pending',
            relatedTaskIds: tasks[i] ? [tasks[i].id] : [],
          }));

          const updatedGoal = goal.updateStatus('active').addProgressUpdate('system', '目标已拆解');
          const updatedGoalWithTasks = tasks.reduce((g, t) => g.linkTask(t.id), updatedGoal);
          const finalGoal = UserGoal.create({
            ...updatedGoalWithTasks.toProps(),
            milestones,
            decompositionStrategy: result.category,
          });

          set({
            goals: get().goals.map((g) => (g.id === goalId ? finalGoal : g)),
            tasks: [...tasks, ...get().tasks],
          });
          get().rebuildAttentionItems();
          useToastStore.getState().addToast('目标已拆解并应用', 'success');
          return { ...result, applied: true, goal: finalGoal, tasks };
        }

        if (result.applied && result.goal) {
          set({
            goals: get().goals.map((g) => (g.id === goalId ? result.goal! : g)),
          });
          if (result.tasks) {
            set({ tasks: [...result.tasks, ...get().tasks] });
          }
          get().rebuildAttentionItems();
          useToastStore.getState().addToast('目标已拆解并应用', 'success');
        }
        return result;
      } catch (err) {
        useToastStore.getState().addToast('目标拆解失败', 'error');
        throw err;
      }
    },

    async dispatchGoalPlan(
      goalId: string,
      taskDefs: Array<{ id: string; name: string; agentId: string; [k: string]: unknown }>,
      assignments: TaskAssignment[]
    ): Promise<void> {
      const goal = get().goals.find((g) => g.id === goalId);
      if (!goal) return;

      const now = Date.now();
      const newTasks: AgentTask[] = [];
      const newWorkOrders: WorkOrder[] = [];

      for (const taskDef of taskDefs) {
        const assignment = assignments.find((a) => a.taskId === taskDef.id);

        if (assignment?.assigneeType === 'agent') {
          newTasks.push(
            AgentTask.create({
              id: taskDef.id,
              agentId: taskDef.agentId,
              todoId: `todo-${taskDef.id}`,
              name: taskDef.name,
              status: 'queued',
              progress: 0,
              subtasks: [],
              logs: [
                {
                  timestamp: now,
                  level: 'INFO' as const,
                  message: `任务已下发给 ${assignment.assigneeName}`,
                },
              ],
              color: '#007AFF',
              createdAt: now,
              updatedAt: now,
            })
          );
        } else if (assignment?.assigneeType === 'person') {
          newWorkOrders.push(
            WorkOrder.create({
              id: `wo-${now}-${Math.random().toString(36).slice(2, 7)}`,
              type: 'input',
              fromUserId: 'current-user',
              toUserId: assignment.assigneeId,
              goalId,
              taskId: taskDef.id,
              title: taskDef.name,
              context: `来自目标「${goal.title}」的任务分配`,
              status: 'pending',
              deadline: now + 7 * 24 * 3_600_000,
              createdAt: now,
            })
          );
        }
      }

      const updatedGoal = UserGoal.create({
        ...goal.toProps(),
        relatedTaskIds: [...goal.relatedTaskIds, ...newTasks.map((t) => t.id)],
        collaboratorIds: [
          ...goal.collaboratorIds,
          ...assignments
            .filter(
              (a) => a.assigneeType === 'person' && !goal.collaboratorIds.includes(a.assigneeId)
            )
            .map((a) => a.assigneeId),
        ],
        decompositionStrategy: 'dispatched',
        updatedAt: now,
      });

      set({
        goals: get().goals.map((g) => (g.id === goalId ? updatedGoal : g)),
        tasks: [...newTasks, ...get().tasks],
        workOrders: [...newWorkOrders, ...get().workOrders],
      });
      get().rebuildAttentionItems();
      useToastStore
        .getState()
        .addToast(
          `已下发 ${newTasks.length} 个 Agent 任务 + ${newWorkOrders.length} 个工单`,
          'success'
        );
    },
  };
}

export function workOrderActions(set: StoreSet, get: StoreGet) {
  return {
    async fetchWorkOrders() {
      try {
        const workOrders = await cockpitApiAdapter.fetchWorkOrders({ status: 'pending' });
        set({ workOrders });
        get().rebuildAttentionItems();
      } catch {
        // silent
      }
    },

    async respondWorkOrder(id: string, response: string) {
      try {
        const updated = await cockpitApiAdapter.respondWorkOrder(id, response);
        set({ workOrders: get().workOrders.map((wo) => (wo.id === id ? updated : wo)) });
        get().rebuildAttentionItems();
        useToastStore.getState().addToast('工单已回复', 'success');
      } catch {
        useToastStore.getState().addToast('工单回复失败', 'error');
      }
    },

    async createWorkOrder(input: CreateWorkOrderInput): Promise<WorkOrder> {
      const wo = await cockpitApiAdapter.createWorkOrder(input);
      set({ workOrders: [wo, ...get().workOrders] });
      get().rebuildAttentionItems();
      useToastStore.getState().addToast('工单已创建', 'success');
      return wo;
    },

    setDiscussingWorkOrderId(id: string | null) {
      set({
        discussingWorkOrderId: id,
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingTaskId: null,
        discussingGoalId: null,
      });
      if (id) {
        get().switchConversation(`workorder-${id}`);
      } else {
        get().switchConversation('primary');
      }
    },
  };
}
