import type { OperationalRepository } from '../../db/repositories/operational-repository.js';
import { newId } from '../../shared/utils.js';

export class PushChannelService {
  constructor(private repo: OperationalRepository) {}

  async list() {
    return this.repo.list('push_channel');
  }

  async get(id: string) {
    return this.repo.get('push_channel', id);
  }

  async create(input: Record<string, unknown>) {
    const id = (input.id as string) || newId('ch');
    const now = new Date().toISOString();
    const channel = { id, verified: false, ...input, createdAt: now, updatedAt: now };
    await this.repo.upsert('push_channel', id, channel);
    return channel;
  }

  async update(id: string, input: Record<string, unknown>) {
    const existing = await this.repo.get('push_channel', id);
    if (!existing) return null;
    const channel = { ...existing, ...input, id, updatedAt: new Date().toISOString() };
    await this.repo.upsert('push_channel', id, channel);
    return channel;
  }

  async delete(id: string) {
    await this.repo.remove('push_channel', id);
  }

  async testWebhook(id: string): Promise<{ success: boolean; httpStatus?: number; message: string }> {
    const channel = await this.repo.get('push_channel', id);
    if (!channel) return { success: false, message: 'not found' };

    const webhook = String(channel.webhookUrl || channel.endpoint || '').trim();
    if (!webhook) {
      return { success: false, message: '该渠道未配置 webhook 地址，无法发送测试消息' };
    }

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(webhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msgtype: 'text',
          text: { content: `[DCF 测试] 推送渠道连通性测试 — ${new Date().toISOString()}` },
        }),
        signal: controller.signal,
      });
      clearTimeout(timer);
      return {
        success: res.ok,
        httpStatus: res.status,
        message: res.ok ? '测试消息已发送' : `发送失败: HTTP ${res.status}`,
      };
    } catch (err) {
      return { success: false, message: `发送失败: ${err instanceof Error ? err.message : '未知错误'}` };
    }
  }
}
