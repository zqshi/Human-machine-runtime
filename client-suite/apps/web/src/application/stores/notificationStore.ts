import { create } from 'zustand';
import { Notification } from '../../domain/notification/Notification';
import type { NotificationProps, AgentReaction } from '../../domain/notification/Notification';
import { Approval } from '../../domain/notification/Approval';
import { notificationApi } from '../../infrastructure/api/hmrApiClient';
import { appEvents } from '../events/eventBus';
import { channelAdapterRegistry } from '../../infrastructure/channels/ChannelAdapterRegistry';
import type { ChannelType, TriageStatus } from '../../domain/shared/types';
import { useCockpitStore } from './cockpitStore';

type ActiveTab = 'all' | 'unread' | 'approvals';
type InboxFilter = 'all' | TriageStatus | ChannelType;

interface NotificationState {
  notifications: Notification[];
  approvals: Approval[];
  activeTab: ActiveTab;
  selectedNotificationId: string | null;
  inboxFilter: InboxFilter;

  markAsRead(id: string): void;
  approveRequest(id: string): void;
  rejectRequest(id: string, reason: string): void;
  setActiveTab(tab: ActiveTab): void;
  markAllAsRead(): void;
  reset(): void;
  /** Fetch notifications from HMR backend */
  fetchFromBackend(): Promise<void>;
  mergeCrossChannelNotifications(items: NotificationProps[]): void;
  addCompletionNotification(taskId: string, taskName: string): void;
  selectNotification(id: string | null): void;
  setInboxFilter(filter: InboxFilter): void;
  /** Send a reply back to the original channel */
  sendInboxReply(id: string, body: string): Promise<void>;
  /** Accept Agent's suggested reply */
  acceptAgentReply(id: string): Promise<void>;
  /** Dismiss an item (mark as not needing human attention) */
  dismissItem(id: string): void;
  /** Delegate to Agent for full autonomy on this type of message */
  delegateToAgent(id: string): void;
}

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  approvals: [],
  activeTab: 'all',
  selectedNotificationId: null,
  inboxFilter: 'all',

  markAsRead(id) {
    set({
      notifications: get().notifications.map((n) => (n.id === id ? n.markAsRead() : n)),
    });
  },

  approveRequest(id) {
    set({
      approvals: get().approvals.map((a) => (a.id === id ? a.approve() : a)),
    });
  },

  rejectRequest(id, reason) {
    set({
      approvals: get().approvals.map((a) => (a.id === id ? a.reject(reason) : a)),
    });
  },

  setActiveTab(tab) {
    set({ activeTab: tab });
  },

  markAllAsRead() {
    set({
      notifications: get().notifications.map((n) =>
        n.isUnread || n.isNeedsHuman ? n.markAsRead().withTriageStatus('auto-handled') : n
      ),
    });
  },

  reset() {
    set({
      notifications: [],
      approvals: [],
      activeTab: 'all',
      selectedNotificationId: null,
      inboxFilter: 'all',
    });
  },

  async fetchFromBackend() {
    try {
      const res = await notificationApi.list();
      if (res.items && res.items.length > 0) {
        set({
          notifications: res.items.map((n) => {
            const detail = (n.detail ?? '') as string;
            const source = (n.source ?? 'System') as string;
            const severity = (n.severity ?? '') as string;
            const at = (n.at ?? new Date().toISOString()) as string;
            return Notification.create({
              id: n.id,
              title: n.title,
              body: n.body ?? detail,
              type: (source === 'instance'
                ? 'system'
                : severity === 'high'
                  ? 'approval'
                  : 'update') as 'system' | 'mention' | 'approval' | 'update',
              read: false,
              timestamp: at,
              sender: { name: source, avatar: '' },
            });
          }),
        });
      }
    } catch {
      // API 不可用时保持空列表
    }
  },

  mergeCrossChannelNotifications(items) {
    const existing = new Set(get().notifications.map((n) => n.id));
    const newItems = items.filter((p) => !existing.has(p.id)).map(Notification.create);
    if (newItems.length > 0) {
      set({ notifications: [...newItems, ...get().notifications] });
    }
  },

  addCompletionNotification(taskId, taskName) {
    const n = Notification.create({
      id: `task-done-${taskId}`,
      type: 'system',
      channel: 'system',
      title: '任务完成',
      body: `${taskName} 已完成执行`,
      timestamp: new Date().toISOString(),
      read: false,
      sender: { name: 'Cockpit' },
      agentTaskId: taskId,
      triageStatus: 'auto-handled',
      agentReaction: { summary: '任务已完成', actionTaken: `自动完成 ${taskName}` },
    });
    set({ notifications: [n, ...get().notifications] });
  },

  selectNotification(id) {
    set({
      selectedNotificationId: id,
      notifications: id
        ? get().notifications.map((n) => (n.id === id && n.isUnread ? n.markAsRead() : n))
        : get().notifications,
    });
    // 互斥：选通知时清除 B 栏任务，切回 primary 对话，同步重建 A 栏
    if (id) {
      useCockpitStore.getState().selectBColumnTask(null);
      useCockpitStore.getState().selectBColumnGoal(null);
      useCockpitStore.getState().selectBColumnDecision(null);
      useCockpitStore.getState().switchConversation('primary');
      useCockpitStore.getState().rebuildAttentionItems();
    }
  },

  setInboxFilter(filter) {
    set({ inboxFilter: filter });
  },

  async sendInboxReply(id, body) {
    const notification = get().notifications.find((n) => n.id === id);
    if (!notification?.channel || !notification.externalId) return;

    const adapter = channelAdapterRegistry.get(notification.channel);
    if (adapter) {
      await adapter.sendReply({
        externalId: notification.externalId,
        roomId: notification.roomId,
        body,
      });
    }

    appEvents.emit('inbox:reply-sent', {
      notificationId: id,
      channel: notification.channel,
      body,
    });

    // Mark as handled after successful reply
    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? n.withTriageStatus('auto-handled') : n
      ),
    });
  },

  async acceptAgentReply(id) {
    const notification = get().notifications.find((n) => n.id === id);
    if (!notification?.agentReaction?.draftReply) return;

    await get().sendInboxReply(id, notification.agentReaction.draftReply);
  },

  dismissItem(id) {
    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? n.withTriageStatus('auto-handled') : n
      ),
    });
  },

  delegateToAgent(id) {
    const notification = get().notifications.find((n) => n.id === id);
    if (!notification) return;

    const reaction: AgentReaction = {
      summary: '已授权 Agent 自动处理此类消息',
      actionTaken: '用户已授权自动处理，未来类似消息将不再打扰',
    };

    set({
      notifications: get().notifications.map((n) =>
        n.id === id ? n.withTriageStatus('auto-handled').withAgentReaction(reaction) : n
      ),
    });

    appEvents.emit('inbox:message-received', {
      notificationId: id,
      channel: notification.channel ?? 'system',
    });
  },
}));

export const selectUnreadCount = (state: NotificationState): number =>
  state.notifications.filter((n) => n.isUnread).length;

export const selectCrossChannelNotifications = (state: NotificationState) =>
  state.notifications.filter((n) => (n.channel && n.channel !== 'system') || n.type === 'decision');

export const selectNeedsHumanCount = (state: NotificationState): number =>
  state.notifications.filter((n) => n.isNeedsHuman && n.channel && n.channel !== 'system').length;
