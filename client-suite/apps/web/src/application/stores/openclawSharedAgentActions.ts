/**
 * openclawSharedAgentActions —— 共享 Agent 直聊 + 全局上下文重置
 *
 * 从 openclawStore 拆分。包含：
 * - setSharedAgentMeta：登记 agent 显示名（_sharedAgentMeta，由调用方注入）
 * - startSharedAgentChat：开启/复用某个 Agent 的专属对话（创建会话记录、切换
 *   activeSharedAgentId、联动 switchConversation）
 * - returnToPrimaryAgent：回到平台统一助手
 * - setComposerPrefill：预填输入框
 * - returnToHome：重置所有互斥上下文（discussing* / bColumn* / shared）回主
 *   对话，是「单钥匙」reset 入口
 * - setAColumnTab：A 栏 Tab 切换
 *
 * 这些都围绕共享会话上下文状态机运作（详见 openclawStore.ts 头注释第 3 点）。
 */
import type { ConversationSession, StoreSet, StoreGet } from './openclawTypes';
import { useNotificationStore } from './notificationStore';

export function sharedAgentActions(set: StoreSet, get: StoreGet) {
  return {
    setSharedAgentMeta(agentId: string, name: string) {
      const current = get() as unknown as { _sharedAgentMeta: Record<string, string> };
      const meta = { ...current._sharedAgentMeta, [agentId]: name };
      (set as (partial: Record<string, unknown>) => void)({ _sharedAgentMeta: meta });
    },

    startSharedAgentChat(agentId: string) {
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

    setComposerPrefill(text: string | null) {
      set({ composerPrefill: text });
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

    setAColumnTab(tab: 'attention' | 'history') {
      set({ aColumnTab: tab });
    },
  };
}
