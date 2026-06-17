/**
 * openclawDrawerActions —— Drawer + B 栏选择 + Attention 派生
 *
 * 从 openclawStore 拆分。包含：
 * - openDrawer / closeDrawer / toggleDrawer / setDrawerWidth：抽屉开关与宽度
 * - setActiveAttentionItem / openDrawerForAttentionItem / clearScrollTarget：
 *   attention 项定位与对应抽屉打开
 * - selectBColumnTask / selectBColumnGoal / selectBColumnDecision：B 栏互斥
 *   选择状态机，联动 notification store 与 switchConversation
 * - rebuildAttentionItems：跨聚合派生 A 栏 attentionItems（goals / decisions /
 *   tasks / workOrders / notifications 的唯一汇聚点）
 *
 * rebuildAttentionItems 是「单 store」决策的核心依据之一：同时读 5 个切片。
 */
import type { AttentionItem, OpenClawDrawerContent } from '../../domain/agent/DrawerContent';
import { useNotificationStore } from './notificationStore';
import type { StoreSet, StoreGet } from './openclawTypes';

export function drawerActions(set: StoreSet, get: StoreGet) {
  return {
    openDrawer(content: OpenClawDrawerContent) {
      const width = content.type === 'agent-studio' ? 440 : get().drawerWidth;
      set({ drawerContent: content, drawerWidth: width });
    },

    closeDrawer() {
      set({ drawerContent: null, activeAttentionItemId: null });
    },

    toggleDrawer() {
      const current = get().drawerContent;
      if (current) {
        set({ drawerContent: null, activeAttentionItemId: null });
      }
    },

    setDrawerWidth(width: number) {
      set({ drawerWidth: Math.max(280, Math.min(600, width)) });
    },

    setActiveAttentionItem(id: string | null) {
      set({ activeAttentionItemId: id });
    },

    openDrawerForAttentionItem(itemId: string) {
      const item = get().attentionItems.find((a) => a.id === itemId);
      if (!item) return;

      set({ activeAttentionItemId: itemId, scrollToMessageId: item.messageId });

      if (item.kind === 'decision' && item.decisionId) {
        set({
          drawerContent: {
            type: 'decision-detail',
            title: item.title,
            data: { decisionId: item.decisionId },
          },
        });
      } else if (item.kind === 'task' && item.taskId) {
        set({
          drawerContent: { type: 'task-detail', title: item.title, data: { taskId: item.taskId } },
          selectedTaskId: item.taskId,
        });
      } else if (item.notificationId) {
        set({
          drawerContent: {
            type: 'notification-detail',
            title: item.title,
            data: { notificationId: item.notificationId },
          },
        });
      }
    },

    clearScrollTarget() {
      set({ scrollToMessageId: null });
    },

    selectBColumnTask(id: string | null) {
      set({
        bColumnTaskId: id,
        bColumnGoalId: null,
        bColumnDecisionId: null,
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingTaskId: null,
        discussingGoalId: null,
        ...(id ? { selectedTaskId: null } : {}),
      });
      if (id) {
        useNotificationStore.getState().selectNotification(null);
        get().switchConversation(`task-${id}`);
      } else {
        get().switchConversation('primary');
      }
    },

    selectBColumnGoal(id: string | null) {
      set({
        bColumnGoalId: id,
        bColumnTaskId: null,
        bColumnDecisionId: null,
        discussingNotificationId: null,
        discussingDecisionId: null,
        discussingTaskId: null,
        discussingGoalId: null,
      });
      if (id) {
        useNotificationStore.getState().selectNotification(null);
        get().switchConversation('primary');
      } else {
        get().switchConversation('primary');
      }
    },

    selectBColumnDecision(id: string | null) {
      set({
        bColumnDecisionId: id,
        bColumnTaskId: null,
        bColumnGoalId: null,
        lastCorrectionPlan: null,
      });
      if (id) {
        useNotificationStore.getState().selectNotification(null);
        get().switchConversation('primary');
      } else {
        get().switchConversation('primary');
      }
    },

    rebuildAttentionItems() {
      const notifStore = useNotificationStore.getState();
      const items: AttentionItem[] = [];
      let priority = 0;

      for (const g of get().goals) {
        if (g.status !== 'active' && g.status !== 'paused') continue;
        items.push({
          id: `attn-goal-${g.id}`,
          kind: 'goal',
          title: g.title,
          messageId: '',
          goalId: g.id,
          resolved: false,
          priority: priority++,
          goalProgress: g.overallProgress,
          goalPriority: g.priority,
        });
      }

      for (const d of get().decisionRequests) {
        if (!d.isPending || d.isExpired) continue;
        items.push({
          id: `attn-decision-${d.id}`,
          kind: 'decision',
          title: d.title,
          summary: d.recommendation.label,
          messageId: '',
          decisionId: d.id,
          deadline: d.deadline,
          resolved: false,
          priority: priority++,
        });
      }

      for (const t of get().tasks) {
        if (!t.isActive) continue;
        const runningSubtask = t.subtasks.find((s) => s.status === 'running');
        const lastReasoning = t.reasoningSteps?.[t.reasoningSteps.length - 1];
        items.push({
          id: `attn-task-${t.id}`,
          kind: 'task',
          title: t.name,
          messageId: '',
          taskId: t.id,
          resolved: false,
          priority: priority++,
          taskProgress: t.progress,
          taskColor: t.color,
          currentSubtask: runningSubtask?.name,
          reasoningSummary: lastReasoning?.detail,
          taskStatusLabel:
            t.status === 'running' ? '运行中' : t.status === 'queued' ? '排队中' : undefined,
        });
      }

      for (const t of get().tasks) {
        if (t.isActive) continue;
        items.push({
          id: `attn-task-${t.id}`,
          kind: 'task',
          title: t.name,
          messageId: '',
          taskId: t.id,
          resolved: true,
          priority: priority++,
          taskProgress: t.progress,
          taskColor: t.color,
          taskStatusLabel:
            t.status === 'completed'
              ? '已完成'
              : t.status === 'failed'
                ? '已停止'
                : t.status === 'paused'
                  ? '已暂停'
                  : t.status,
        });
      }

      for (const wo of get().workOrders) {
        if (!wo.isPending) continue;
        items.push({
          id: `attn-wo-${wo.id}`,
          kind: 'workorder',
          title: wo.title,
          summary: wo.context,
          messageId: '',
          workOrderId: wo.id,
          resolved: false,
          priority: priority++,
          deadline: wo.deadline,
          timestamp: wo.createdAt,
        });
      }

      const notifications = notifStore.notifications;
      for (const n of notifications) {
        if (!n.channel || n.channel === 'system') continue;
        items.push({
          id: `attn-notif-${n.id}`,
          kind: 'notification' as const,
          title: n.title,
          summary: n.body,
          messageId: '',
          notificationId: n.id,
          channel: n.channel,
          priority: priority++,
          resolved: n.isAutoHandled,
          isNeedsHuman: n.isNeedsHuman,
          timestamp: n.timestamp ? new Date(n.timestamp).getTime() : 0,
        });
      }

      set({ attentionItems: items });
    },
  };
}
