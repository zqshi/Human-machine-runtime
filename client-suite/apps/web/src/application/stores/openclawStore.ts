import { create } from 'zustand';
import type { AttentionItem } from '../../domain/agent/DrawerContent';
import { appEvents } from '../events/eventBus';
import { useNotificationStore } from './notificationStore';
import { useToastStore } from './toastStore';
import { decisionActions } from './openclawDecisionActions';
import {
  handleSetDiscussingNotificationId,
  handleSetDiscussingDecisionId,
  handleSetDiscussingTaskId,
  handleSetDiscussingGoalId,
} from './openclawDiscussionActions';
import type { OpenClawState, ConversationSession } from './openclawTypes';
import { goalActions, workOrderActions } from './openclawGoalWorkOrderActions';
import {
  persistConversations,
  restoreConversations,
  clearPersistedConversations,
} from './openclawPersistence';
import { initializeOpenClaw } from './openclawInitializer';

export type {
  AppArtifact,
  DocumentArtifact,
  ProactiveActivity,
  ProactiveInsight,
  ConversationSession,
  OpenClawState,
} from './openclawTypes';

/**
 * useOpenClawStore —— OpenClaw 工作区全局 store（多聚合协调面）
 *
 * ┌─ 为什么是「单 store」而非按聚合根拆分 ─────────────────────────────┐
 * │ 本 store 承载 goal / decision / task / workOrder / conversation     │
 * │ / notification / drawer 等多个聚合，但它们之间存在**强运行时耦合**： │
 * │                                                                     │
 * │ 1. 跨聚合派生：rebuildAttentionItems() 同时消费 goals / decisions / │
 * │    tasks / workOrders / notifications，是 A 栏 attentionItems 的唯  │
 * │    一数据源。拆分后该 reducer 需订阅多个 store，引入跨 store 同步   │
 * │    一致性问题。                                                     │
 * │ 2. 跨聚合写：decisionActions 在 respondDecision 中同时改 decision / │
 * │    goals / tasks / collaborationChains，并经 CorrectionPropagator   │
 * │    传播纠偏；goalActions.dispatchGoalPlan 同时写 goals / tasks /    │
 * │    workOrders。这些是**单事务语义**，拆 store 会破坏原子性。        │
 * │ 3. 共享会话上下文：所有 setDiscussingXxx / selectBColumnXxx 都围绕  │
 * │    同一组 `discussing*Id` + `bColumn*Id` + `activeConversationId`  │
 * │    的互斥选择状态机运作，且依赖 switchConversation 这把「单钥匙」。  │
 * │ 4. 命令式跨模块访问：全仓 39 处 `useOpenClawStore.getState()` 命令  │
 * │    式调用（20 个文件），多数跨聚合；硬拆需逐处重指向，回归面大。   │
 * │ 5. 缺安全网：openclaw store 无单测，仅靠 1 个 apiAdapter 测试 +     │
 * │    集成测试兜底，拆分无细粒度回归保护。                             │
 * │                                                                     │
 * │ 结论：当前按辅助文件模块化的结构（见下方「文件分工」）已是合理的    │
 * │ 解耦粒度。强行按聚合拆 store 会把「跨聚合事务」拆成「跨 store 协调」│
 * │ 收益为负。维持现状。                                                │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 文件分工（已完成的模块化拆分）──────────────────────────────────┐
 * │ openclawStore.ts            本文件：state 定义 + drawer/conversation│
 * │                             /runtime/task/app/doc/board/shared-agent│
 * │                             等基础 CRUD + 组装入口                 │
 * │ openclawTypes.ts            OpenClawState 接口 + StoreSet/StoreGet  │
 * │ openclawDecisionActions.ts  决策请求 CRUD + respondDecision 事务   │
 * │                             （含纠偏传播 + 判断记录落库）          │
 * │ openclawGoalWorkOrderActions.ts  目标 CRUD/拆解/下发 + 工单 CRUD    │
 * │ openclawDiscussionActions.ts setDiscussingNotificationId 等 4 个    │
 * │                             上下文切换处理器（生成首条分析消息）   │
 * │ openclawConversationHelpers.ts buildDeepDiscussionResponse 等       │
 * │                             纯函数（CoT/blocks 构造，无 store 依赖）│
 * │ openclawSSEHandler.ts       SSE 订阅 → store 增量更新               │
 * │ openclawInitializer.ts      bootstrap 拉取 + SSE 挂载 + 首次编排    │
 * │ openclawPersistence.ts      sessionStorage 对话持久化（纯函数）     │
 * └────────────────────────────────────────────────────────────────────┘
 *
 * ┌─ 后续演进路线图（非阻塞，条件成熟后再做）────────────────────────┐
 * │ 阶段 1（低风险）：把 _sharedAgentMeta / composerPrefill / drawerWidth│
 * │   等纯 UI 状态抽到 useOpenClawUIStore，组件改 import 即可，无跨聚  │
 * │   合事务。                                                          │
 * │ 阶段 2（中风险）：apps / documents / boards / collaborationChains  │
 * │   这类「只读展示聚合」可独立 store，需把 rebuildAttentionItems 中   │
 * │   对它们的引用改为订阅。                                            │
 * │ 阶段 3（高风险，需先补测试）：goal / decision / task / workOrder   │
 * │   这类「相互写」的核心聚合，必须先补 domain + action 单测，再引入  │
 * │   跨 store 事务抽象（如 event-saga），否则原子性丢失。             │
 * │ 前置条件：补齐 openclaw store 的单测（rebuildAttentionItems /      │
 * │   respondDecision / dispatchGoalPlan 三条事务路径 100% 覆盖）。     │
 * └────────────────────────────────────────────────────────────────────┘
 */
export const useOpenClawStore = create<OpenClawState>((set, get) => ({
  runtimes: [],
  tasks: [],
  selectedTaskId: null,
  conversations: {},
  activeConversationId: 'primary',
  sessionId: null,
  /** 当前对话绑定的数字员工实例 id；null = 平台统一助手（不受模型授权约束） */
  activeInstanceId: null as string | null,
  isSending: false,
  systemHealth: null,
  quickCommands: [],
  proactiveActivities: [],
  proactiveInsights: [],
  decisionTrees: {},
  expandedActivityId: null,
  collaborationChains: [],
  decisionRequests: [],
  goals: [],
  activeGoalId: null,
  apps: [],
  documents: [],
  boards: [],
  drawerContent: null,
  drawerWidth: 360,
  activeSharedAgentId: null,
  activeAttentionItemId: null,
  composerPrefill: null,
  discussingNotificationId: null,
  discussingDecisionId: null,
  discussingTaskId: null,
  discussingGoalId: null,
  attentionItems: [],
  lastCorrectionPlan: null,
  bColumnTaskId: null,
  bColumnGoalId: null,
  bColumnDecisionId: null,
  scrollToMessageId: null,
  conversationSessions: [],
  _sharedAgentMeta: {} as Record<string, string>,
  aColumnTab: 'attention' as const,
  workOrders: [],
  discussingWorkOrderId: null,
  isInitializing: false,
  initError: null,
  _cleanup: null,

  // ── Drawer actions ──

  openDrawer(content) {
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

  setActiveAttentionItem(id) {
    set({ activeAttentionItemId: id });
  },

  // ── B-column selection ──

  selectBColumnTask(id) {
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

  selectBColumnGoal(id) {
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

  selectBColumnDecision(id) {
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

  // ── Conversation management ──

  switchConversation(id) {
    const convs = get().conversations;
    if (!convs[id]) {
      set({ conversations: { ...convs, [id]: [] }, activeConversationId: id });
    } else {
      set({ activeConversationId: id });
    }
  },

  /** 设置当前对话绑定的数字员工实例；传 null 回到平台统一助手 */
  setActiveInstanceId(instanceId: string | null) {
    set({ activeInstanceId: instanceId });
  },

  openDrawerForAttentionItem(itemId) {
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

  // ── Attention items rebuild ──

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

  setDrawerWidth(width) {
    set({ drawerWidth: Math.max(280, Math.min(600, width)) });
  },

  // ── Runtime/Task CRUD ──

  setRuntimes(runtimes) {
    set({ runtimes });
  },

  updateRuntime(agentId, updater) {
    set({
      runtimes: get().runtimes.map((r) => (r.agentId === agentId ? updater(r) : r)),
    });
  },

  setTasks(tasks) {
    set({ tasks });
  },

  updateTask(taskId, updater) {
    set({
      tasks: get().tasks.map((t) => (t.id === taskId ? updater(t) : t)),
    });
    get().rebuildAttentionItems();
  },

  selectTask(taskId) {
    set({ selectedTaskId: taskId });
  },

  appendMessage(msg) {
    const id = get().activeConversationId;
    const now = Date.now();
    const sessions = get().conversationSessions;
    const hasSession = sessions.some((s) => s.id === id);

    let updatedSessions: ConversationSession[];
    if (hasSession) {
      updatedSessions = sessions.map((s) =>
        s.id === id ? { ...s, lastMessageAt: now, messageCount: s.messageCount + 1 } : s
      );
    } else {
      let title = '对话';
      if (id.startsWith('discuss-decision-')) {
        const decId = id.replace('discuss-decision-', '');
        const dec = get().decisionRequests.find((d) => d.id === decId);
        title = dec ? `决策 · ${dec.title}` : '决策讨论';
      } else if (id.startsWith('discuss-')) {
        const notifId = id.replace('discuss-', '');
        const notif = useNotificationStore.getState().notifications.find((n) => n.id === notifId);
        title = notif ? `${notif.sender.name}: ${notif.title}` : '消息讨论';
      } else if (id.startsWith('task-')) {
        const taskId = id.replace('task-', '');
        const task = get().tasks.find((t) => t.id === taskId);
        title = task ? `任务 · ${task.name}` : '任务讨论';
      } else if (id.startsWith('goal-')) {
        const goalId = id.replace('goal-', '');
        const goal = get().goals.find((g) => g.id === goalId);
        title = goal ? `目标 · ${goal.title}` : '目标讨论';
      } else if (id === 'primary') {
        title = '主对话';
      }
      const newSession: ConversationSession = {
        id,
        title,
        createdAt: now,
        lastMessageAt: now,
        messageCount: 1,
        type: id === 'primary' ? 'primary' : id.startsWith('shared-') ? 'shared' : 'discussion',
      };
      updatedSessions = [newSession, ...sessions];
    }

    const updatedConversations = {
      ...get().conversations,
      [id]: [...(get().conversations[id] ?? []), msg],
    };
    set({
      conversations: updatedConversations,
      conversationSessions: updatedSessions,
    });
    persistConversations(updatedConversations, updatedSessions, id);
    get().rebuildAttentionItems();
  },

  appendMessageTo(conversationId, msg) {
    const id = conversationId || get().activeConversationId;
    const updatedConversations = {
      ...get().conversations,
      [id]: [...(get().conversations[id] ?? []), msg],
    };
    set({ conversations: updatedConversations });
    persistConversations(updatedConversations, get().conversationSessions, id);
  },

  updateLastMessage(updater) {
    const id = get().activeConversationId;
    const conv = get().conversations[id] ?? [];
    if (conv.length === 0) return;
    const updated = [...conv];
    updated[updated.length - 1] = updater(updated[updated.length - 1]);
    const updatedConversations = { ...get().conversations, [id]: updated };
    set({ conversations: updatedConversations });
    persistConversations(updatedConversations, get().conversationSessions, id);
    get().rebuildAttentionItems();
  },

  updateLastMessageIn(conversationId, updater) {
    const id = conversationId || get().activeConversationId;
    const conv = get().conversations[id] ?? [];
    if (conv.length === 0) return;
    const updated = [...conv];
    updated[updated.length - 1] = updater(updated[updated.length - 1]);
    const updatedConversations = { ...get().conversations, [id]: updated };
    set({ conversations: updatedConversations });
    persistConversations(updatedConversations, get().conversationSessions, id);
  },

  setIsSending(v) {
    set({ isSending: v });
  },

  setSystemHealth(health) {
    set({ systemHealth: health });
  },

  // ── Decision Tree actions ──

  expandActivity(activityId) {
    const current = get().expandedActivityId;
    set({ expandedActivityId: current === activityId ? null : activityId });
  },

  executeFollowUp(activityId, actionId) {
    const tree = get().decisionTrees[activityId];
    if (!tree) return;
    const action = tree.followUpActions.find((a) => a.id === actionId);
    if (!action) return;
    useToastStore.getState().addToast(`正在执行: ${action.label}`, 'info');
  },

  // ── Workflow intervention actions ──

  pauseTask(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task?.canPause) return;
    get().updateTask(taskId, (t) => t.pause());
    useToastStore.getState().addToast(`已暂停任务: ${task.name}`, 'info');
  },

  resumeTask(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task?.canResume) return;
    get().updateTask(taskId, (t) => t.resume());
    useToastStore.getState().addToast(`已恢复任务: ${task.name}`, 'info');
  },

  cancelTask(taskId) {
    const task = get().tasks.find((t) => t.id === taskId);
    if (!task?.canCancel) return;
    get().updateTask(taskId, (t) => t.cancel());
    useToastStore.getState().addToast(`已停止任务: ${task.name}`, 'error');
    appEvents.emit('agent:task-updated', { taskId, progress: task.progress, status: 'failed' });
  },

  // ── Decision requests (delegated to openclawDecisionActions.ts) ──
  ...decisionActions(set, get),

  // ── Goals + WorkOrders (delegated to openclawGoalWorkOrderActions.ts) ──
  ...goalActions(set, get),
  ...workOrderActions(set, get),

  addApp(app) {
    set({ apps: [...get().apps, app] });
  },
  updateApp(appId, updater) {
    set({ apps: get().apps.map((a) => (a.id === appId ? updater(a) : a)) });
  },
  addDocument(doc) {
    set({ documents: [...get().documents, doc] });
  },
  updateDocument(docId, updater) {
    set({ documents: get().documents.map((d) => (d.id === docId ? updater(d) : d)) });
  },
  addBoard(board) {
    set({ boards: [...get().boards, board] });
  },
  updateBoard(boardId, updater) {
    set({ boards: get().boards.map((b) => (b.id === boardId ? updater(b) : b)) });
  },

  // ── Shared Agent direct chat ──

  setSharedAgentMeta(agentId: string, name: string) {
    const current = get() as unknown as { _sharedAgentMeta: Record<string, string> };
    const meta = { ...current._sharedAgentMeta, [agentId]: name };
    (set as (partial: Record<string, unknown>) => void)({ _sharedAgentMeta: meta });
  },

  startSharedAgentChat(agentId) {
    const sessionId = `session-${Date.now()}`;
    const convId = `shared-${agentId}`;

    // 检查是否已有该 Agent 的对话记录
    const existingSessions = get().conversationSessions;
    const existingSession = existingSessions.find((s) => s.id === convId);

    if (existingSession) {
      // 已有会话 → 切换过去，更新 lastMessageAt 使其排到前面
      const updatedSessions = existingSessions.map((s) =>
        s.id === convId ? { ...s, lastMessageAt: Date.now() } : s
      );
      set({
        activeSharedAgentId: agentId,
        sessionId,
        bColumnTaskId: null,
        discussingTaskId: null,
        discussingGoalId: null,
        conversationSessions: updatedSessions,
      });
    } else {
      // 新建对话会话记录 — 从 sharedAgentMeta 获取名称（由调用方注入）
      const agentMeta = (get() as unknown as { _sharedAgentMeta?: Record<string, string> })
        ._sharedAgentMeta;
      const agentName = agentMeta?.[agentId] || 'Agent';

      const newSession: ConversationSession = {
        id: convId,
        title: agentName,
        createdAt: Date.now(),
        lastMessageAt: Date.now(),
        messageCount: 0,
        type: 'shared',
      };
      set({
        activeSharedAgentId: agentId,
        sessionId,
        bColumnTaskId: null,
        discussingTaskId: null,
        discussingGoalId: null,
        conversationSessions: [newSession, ...existingSessions],
      });
    }

    get().switchConversation(convId);
  },

  returnToPrimaryAgent() {
    const sessionId = `session-${Date.now()}`;
    set({ activeSharedAgentId: null, sessionId });
    get().switchConversation('primary');
  },

  setComposerPrefill(text) {
    set({ composerPrefill: text });
  },

  // ── Discussion actions (delegated) ──

  setDiscussingNotificationId(id) {
    handleSetDiscussingNotificationId(id, set, get);
  },

  setDiscussingDecisionId(id) {
    handleSetDiscussingDecisionId(id, set, get);
  },

  setDiscussingTaskId(id) {
    handleSetDiscussingTaskId(id, set, get);
  },

  setDiscussingGoalId(id) {
    handleSetDiscussingGoalId(id, set, get);
  },

  returnToHome() {
    set({
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      activeSharedAgentId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      composerPrefill: null,
      activeConversationId: 'primary',
    });
    useNotificationStore.getState().selectNotification(null);
  },

  setAColumnTab(tab) {
    set({ aColumnTab: tab });
  },

  createNewConversation(title) {
    const now = Date.now();
    const id = `conv-${now}`;
    const session: ConversationSession = {
      id,
      title:
        title ||
        `对话 ${new Date(now).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}`,
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      type: 'primary',
    };
    set({
      conversations: { ...get().conversations, [id]: [] },
      conversationSessions: [session, ...get().conversationSessions],
      activeConversationId: id,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      activeSharedAgentId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      composerPrefill: null,
    });
    useNotificationStore.getState().selectNotification(null);
  },

  switchToSession(sessionId) {
    const session = get().conversationSessions.find((s) => s.id === sessionId);
    if (!session) return;
    set({
      activeConversationId: sessionId,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      discussingWorkOrderId: null,
      activeSharedAgentId: null,
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      composerPrefill: null,
    });
    useNotificationStore.getState().selectNotification(null);
  },

  initConversation() {
    if (get().sessionId) return;
    const sessionId = `session-${Date.now()}`;

    const restored = restoreConversations();
    if (restored && Object.keys(restored.conversations).length > 0) {
      const conversations = restored.conversations;
      if (!conversations['primary']) conversations['primary'] = [];
      set({
        sessionId,
        conversations,
        conversationSessions: restored.sessions,
        activeConversationId: restored.activeConversationId ?? 'primary',
      });
      return;
    }

    const now = Date.now();
    const primarySession: ConversationSession = {
      id: 'primary',
      title: '主对话',
      createdAt: now,
      lastMessageAt: now,
      messageCount: 0,
      type: 'primary',
    };
    set({
      sessionId,
      conversations: { primary: [] },
      activeConversationId: 'primary',
      conversationSessions: [primarySession],
    });
  },

  async initialize() {
    await initializeOpenClaw(set, get);
  },

  reset() {
    const cleanup = get()._cleanup;
    if (cleanup) cleanup();
    clearPersistedConversations();
    set({
      runtimes: [],
      tasks: [],
      selectedTaskId: null,
      conversations: {},
      activeConversationId: 'primary',
      sessionId: null,
      activeInstanceId: null,
      isSending: false,
      systemHealth: null,
      quickCommands: [],
      proactiveActivities: [],
      proactiveInsights: [],
      decisionTrees: {},
      expandedActivityId: null,
      collaborationChains: [],
      goals: [],
      activeGoalId: null,
      apps: [],
      documents: [],
      boards: [],
      decisionRequests: [],
      lastCorrectionPlan: null,
      drawerContent: null,
      drawerWidth: 360,
      activeSharedAgentId: null,
      activeAttentionItemId: null,
      composerPrefill: null,
      discussingNotificationId: null,
      discussingDecisionId: null,
      discussingTaskId: null,
      discussingGoalId: null,
      attentionItems: [],
      bColumnTaskId: null,
      bColumnGoalId: null,
      bColumnDecisionId: null,
      scrollToMessageId: null,
      conversationSessions: [],
      aColumnTab: 'attention' as const,
      workOrders: [],
      discussingWorkOrderId: null,
      isInitializing: false,
      initError: null,
      _cleanup: null,
    });
  },
}));
