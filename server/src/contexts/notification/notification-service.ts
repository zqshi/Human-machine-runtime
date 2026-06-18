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
    return this.createAlert(tenantId, {
      type: 'quota_alert',
      severity: alert.severity,
      resourceType: alert.resourceType,
      title: `${alert.resourceType} 使用率 ${alert.currentPct}% 超过阈值 ${alert.thresholdPct}%`,
      currentPct: alert.currentPct,
      thresholdPct: alert.thresholdPct,
    });
  }

  /**
   * 通用告警落库（站内通知）。各业务域（配额、工具健康、…）共用，
   * 通过 type 区分语义（quota_alert / tool_health_alert / …）。
   * 多余字段写入 notification.data JSON 列（见 OperationalRepository.upsert）。
   */
  async createAlert(
    tenantId: string,
    alert: {
      type: string;
      title: string;
      severity: string;
      resourceType?: string;
      message?: string;
      sourceId?: string;
      sourceName?: string;
      [k: string]: unknown;
    }
  ): Promise<string> {
    const id = newId('ntf');
    await this.repo.upsert('notification', id, {
      id,
      type: alert.type,
      tenantId,
      title: alert.title,
      severity: alert.severity,
      resourceType: alert.resourceType ?? null,
      message: alert.message ?? null,
      sourceId: alert.sourceId ?? null,
      sourceName: alert.sourceName ?? null,
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
