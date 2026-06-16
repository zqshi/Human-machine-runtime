/**
 * openclawChannelStore — 决策控制台 Channel 聚合状态
 *
 * 管理多 channel 健康状态、统一时间线、跨 channel 消息分发。
 * 数据源：openclawChannelApiClient
 */

import { create } from 'zustand';
import type {
  ChannelHealthDTO,
  ConversationDTO,
  TimelineEntryDTO,
} from '../../infrastructure/api/openclawChannelApiClient';
import { channelApi } from '../../infrastructure/api/openclawChannelApiClient';

interface OpenClawChannelState {
  channels: ChannelHealthDTO[];
  availableChannels: string[];
  conversations: ConversationDTO[];
  timeline: TimelineEntryDTO[];
  timelineHasMore: boolean;
  loading: boolean;
  error: string | null;

  fetchChannels(): Promise<void>;
  fetchView(): Promise<void>;
  fetchTimeline(options?: { limit?: number; before?: string; channels?: string[] }): Promise<void>;
  dispatch(
    targetChannels: string[],
    roomId: string,
    message: { type: 'text' | 'rich_text' | 'card' | 'file'; content: string }
  ): Promise<{ successes: string[]; failures: { channel: string; error: string }[] }>;
  switchChannel(
    conversationId: string,
    fromChannel: string,
    toChannel: string,
    notifyMessage?: string
  ): Promise<boolean>;
  reset(): void;
}

export const useOpenClawChannelStore = create<OpenClawChannelState>((set, get) => ({
  channels: [],
  availableChannels: [],
  conversations: [],
  timeline: [],
  timelineHasMore: false,
  loading: false,
  error: null,

  async fetchChannels() {
    set({ loading: true });
    try {
      const result = await channelApi.list();
      set({
        channels: result.channels,
        availableChannels: result.available,
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async fetchView() {
    set({ loading: true });
    try {
      const result = await channelApi.getView();
      set({
        conversations: result.conversations,
        channels: result.channels.map((c) => ({
          channelType: c.type,
          connected: c.connected,
          checkedAt: new Date().toISOString(),
        })),
        loading: false,
      });
    } catch (e) {
      set({ loading: false, error: (e as Error).message });
    }
  },

  async fetchTimeline(options) {
    try {
      const result = await channelApi.getTimeline(options);
      if (options?.before) {
        set({
          timeline: [...get().timeline, ...result.entries],
          timelineHasMore: result.hasMore,
        });
      } else {
        set({
          timeline: result.entries,
          timelineHasMore: result.hasMore,
        });
      }
    } catch (e) {
      set({ error: (e as Error).message });
    }
  },

  async dispatch(targetChannels, roomId, message) {
    const result = await channelApi.dispatch({ targetChannels, roomId, message });
    return result;
  },

  async switchChannel(conversationId, fromChannel, toChannel, notifyMessage) {
    const result = await channelApi.switchChannel({
      conversationId,
      fromChannel,
      toChannel,
      notifyMessage,
    });
    return result.success;
  },

  reset() {
    set({
      channels: [],
      availableChannels: [],
      conversations: [],
      timeline: [],
      timelineHasMore: false,
      loading: false,
      error: null,
    });
  },
}));
