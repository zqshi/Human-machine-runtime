/**
 * channelConfigStore — 渠道配置状态管理
 *
 * 管理 IM 通道的增删改查和测试操作。
 * 数据从 /api/admin/push-channels 获取。
 */

import { create } from 'zustand';
import type { ChannelConfigProps } from '../../domain/agent/ChannelConfig';
import { channelConfigAdapter } from '../../infrastructure/api/channelConfigAdapter';
import { channelAdapterRegistry } from '../../infrastructure/channels/ChannelAdapterRegistry';

interface ChannelConfigState {
  channels: ChannelConfigProps[];
  loading: boolean;
  testResults: Record<string, 'success' | 'fail' | 'testing'>;

  fetchChannels(): Promise<void>;
  addChannel(channel: Omit<ChannelConfigProps, 'id' | 'createdAt' | 'updatedAt'>): Promise<void>;
  updateChannel(channel: ChannelConfigProps): Promise<void>;
  deleteChannel(id: string): Promise<void>;
  testChannel(id: string): Promise<boolean>;
}

export const useChannelConfigStore = create<ChannelConfigState>((set, get) => ({
  channels: [],
  loading: false,
  testResults: {},

  async fetchChannels() {
    set({ loading: true });
    try {
      const channels = await channelConfigAdapter.fetchAll();
      set({ channels, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  async addChannel(input) {
    const saved = await channelConfigAdapter.save(
      input as Parameters<typeof channelConfigAdapter.save>[0]
    );
    const channels = [...get().channels, saved];
    set({ channels });
    channelAdapterRegistry.rebuildFromConfig(channels);
  },

  async updateChannel(channel) {
    const saved = await channelConfigAdapter.save(channel);
    const channels = get().channels.map((c) => (c.id === saved.id ? saved : c));
    set({ channels });
    channelAdapterRegistry.rebuildFromConfig(channels);
  },

  async deleteChannel(id) {
    await channelConfigAdapter.remove(id);
    const channels = get().channels.filter((c) => c.id !== id);
    set({ channels });
    channelAdapterRegistry.rebuildFromConfig(channels);
  },

  async testChannel(id) {
    set({ testResults: { ...get().testResults, [id]: 'testing' } });
    try {
      const result = await channelConfigAdapter.test(id);
      set({ testResults: { ...get().testResults, [id]: result.success ? 'success' : 'fail' } });
      return result.success;
    } catch {
      set({ testResults: { ...get().testResults, [id]: 'fail' } });
      return false;
    }
  },
}));
