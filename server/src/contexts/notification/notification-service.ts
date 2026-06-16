import type { OperationalRepository } from '../../db/repositories/operational-repository.js';
import { newId } from '../../shared/utils.js';

export class NotificationService {
  constructor(private repo: OperationalRepository) {}

  async createFromAlert(
    tenantId: string,
    alert: {
      resourceType: string;
      currentPct: number;
      thresholdPct: number;
      severity: string;
    }
  ) {
    const id = newId('ntf');
    await this.repo.upsert('notification', id, {
      id,
      type: 'quota_alert',
      tenantId,
      title: `${alert.resourceType} 使用率 ${alert.currentPct}% 超过阈值 ${alert.thresholdPct}%`,
      severity: alert.severity,
      resourceType: alert.resourceType,
      currentPct: alert.currentPct,
      thresholdPct: alert.thresholdPct,
      read: false,
      createdAt: new Date().toISOString(),
    });
    return id;
  }

  async list() {
    const items = await this.repo.list('notification');
    const unread = items.filter((n) => !n.read).length;
    return { items, summary: { unread, total: items.length } };
  }

  async getUnreadCount() {
    const items = await this.repo.list('notification');
    const unread = items.filter((n) => !n.read).length;
    return { unread, total: items.length };
  }

  async markRead(id: string) {
    const n = await this.repo.get('notification', id);
    if (n) {
      n.read = true;
      await this.repo.upsert('notification', id, n);
    }
  }

  async dismiss(id: string) {
    await this.repo.remove('notification', id);
  }

  async snooze(id: string, hours: number) {
    const n = await this.repo.get('notification', id);
    if (n) {
      n.snoozedUntil = new Date(Date.now() + hours * 3600000).toISOString();
      await this.repo.upsert('notification', id, n);
    }
  }

  async escalate(id: string) {
    const n = await this.repo.get('notification', id);
    if (n) {
      n.escalated = true;
      await this.repo.upsert('notification', id, n);
    }
  }
}
