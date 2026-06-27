/**
 * cockpitConversationActions —— 对话管理切片
 *
 * 从 cockpitStore 拆分，降低主文件行数。承载：
 * - switchConversation：切换活跃对话上下文，按需创建空对话
 * - setActiveInstanceId：切换对话绑定的数字员工实例
 * - appendMessage / appendMessageTo：追加消息（含会话元信息维护与持久化）
 * - updateLastMessage / updateLastMessageIn：就地更新最后一条消息（流式）
 * - createNewConversation / switchToSession / initConversation：会话生命周期
 * - setIsSending / setSystemHealth：基础 UI 状态
 *
 * 注意：appendMessage 中跨切片读取 decisionRequests / tasks / goals 用于生成
 * 会话标题，且需调用 rebuildAttentionItems 与 persistConversations。这是「单
 * store」决策的依据之一（详见 cockpitStore.ts 头注释）。
 */
import type { CoTMessage } from '../../domain/agent/CoTMessage';
import type { SystemHealthSnapshot } from '../../domain/agent/AgentOrchestrationService';
import { useNotificationStore } from './notificationStore';
import { persistConversations, restoreConversations } from './cockpitPersistence';
import type { ConversationSession, StoreSet, StoreGet } from './cockpitTypes';

export function conversationActions(set: StoreSet, get: StoreGet) {
  return {
    switchConversation(id: string) {
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

    appendMessage(msg: CoTMessage) {
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

    appendMessageTo(conversationId: string, msg: CoTMessage) {
      const id = conversationId || get().activeConversationId;
      const updatedConversations = {
        ...get().conversations,
        [id]: [...(get().conversations[id] ?? []), msg],
      };
      set({ conversations: updatedConversations });
      persistConversations(updatedConversations, get().conversationSessions, id);
    },

    updateLastMessage(updater: (m: CoTMessage) => CoTMessage) {
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

    updateLastMessageIn(conversationId: string, updater: (m: CoTMessage) => CoTMessage) {
      const id = conversationId || get().activeConversationId;
      const conv = get().conversations[id] ?? [];
      if (conv.length === 0) return;
      const updated = [...conv];
      updated[updated.length - 1] = updater(updated[updated.length - 1]);
      const updatedConversations = { ...get().conversations, [id]: updated };
      set({ conversations: updatedConversations });
      persistConversations(updatedConversations, get().conversationSessions, id);
    },

    setIsSending(v: boolean) {
      set({ isSending: v });
    },

    setSystemHealth(health: SystemHealthSnapshot) {
      set({ systemHealth: health });
    },

    createNewConversation(title?: string) {
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

    switchToSession(sessionId: string) {
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
  };
}
