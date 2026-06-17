/**
 * channelConfigAdapter — 渠道配置 API 适配器
 *
 * 调用管理后台已有的 /api/admin/push-channels CRUD + test 端点。
 * 底层 request 由统一 httpClient 工厂提供（含超时、JSON 安全解析）。
 */

import { request } from './httpClient';
import type { ChannelConfigProps } from '../../domain/agent/ChannelConfig';

export const channelConfigAdapter = {
  async fetchAll(): Promise<ChannelConfigProps[]> {
    const res = await request<{ channels?: ChannelConfigProps[]; items?: ChannelConfigProps[] }>(
      '/api/admin/push-channels'
    );
    return res.channels ?? res.items ?? [];
  },

  async save(
    channel: Omit<ChannelConfigProps, 'createdAt' | 'updatedAt'> & { id?: string }
  ): Promise<ChannelConfigProps> {
    const res = await request<ChannelConfigProps | { channel: ChannelConfigProps }>(
      '/api/admin/push-channels',
      {
        method: 'POST',
        body: JSON.stringify(channel),
      }
    );
    return 'channel' in res ? res.channel : res;
  },

  async remove(id: string): Promise<void> {
    await request<{ ok: boolean }>(`/api/admin/push-channels/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
    });
  },

  async test(id: string): Promise<{ success: boolean; message: string }> {
    return request<{ success: boolean; message: string }>(
      `/api/admin/push-channels/${encodeURIComponent(id)}/test`,
      { method: 'POST' }
    );
  },
};
