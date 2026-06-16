import { eq, and, desc, gte, lte } from 'drizzle-orm';
import type { Database } from '../client.js';
import { quotaAlertRules, quotaUsageSnapshots, quotaAlertEvents } from '../schema/tenant.js';
import type {
  QuotaAlertRule,
  QuotaAlertEvent,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
  ResourceType,
  AlertSeverity,
  NotifyChannel,
  AlertEventStatus,
} from '../../contexts/quota-management/domain/quota-rule.js';
import type { UsageHistoryPoint } from '../../contexts/quota-management/domain/quota-usage.js';

export class QuotaRepository {
  constructor(private db: Database) {}

  /* ──── Alert Rules ──── */

  async listRules(tenantId: string): Promise<QuotaAlertRule[]> {
    const rows = await this.db
      .select()
      .from(quotaAlertRules)
      .where(eq(quotaAlertRules.tenantId, tenantId))
      .orderBy(quotaAlertRules.id);
    return rows.map(toRuleDomain);
  }

  async getRuleById(id: number): Promise<QuotaAlertRule | null> {
    const [row] = await this.db
      .select()
      .from(quotaAlertRules)
      .where(eq(quotaAlertRules.id, id))
      .limit(1);
    return row ? toRuleDomain(row) : null;
  }

  async createRule(tenantId: string, input: CreateAlertRuleInput): Promise<QuotaAlertRule> {
    const [row] = await this.db
      .insert(quotaAlertRules)
      .values({
        tenantId,
        resourceType: input.resourceType,
        thresholdPct: input.thresholdPct,
        severity: input.severity ?? 'warning',
        notifyChannels: input.notifyChannels ?? ['in_app'],
        enabled: input.enabled ?? true,
      })
      .returning();
    return toRuleDomain(row);
  }

  async updateRule(id: number, input: UpdateAlertRuleInput): Promise<QuotaAlertRule | null> {
    const values: Record<string, unknown> = { updatedAt: new Date() };
    if (input.thresholdPct !== undefined) values.thresholdPct = input.thresholdPct;
    if (input.severity !== undefined) values.severity = input.severity;
    if (input.notifyChannels !== undefined) values.notifyChannels = input.notifyChannels;
    if (input.enabled !== undefined) values.enabled = input.enabled;

    const [row] = await this.db
      .update(quotaAlertRules)
      .set(values)
      .where(eq(quotaAlertRules.id, id))
      .returning();
    return row ? toRuleDomain(row) : null;
  }

  async deleteRule(id: number): Promise<boolean> {
    const rows = await this.db
      .delete(quotaAlertRules)
      .where(eq(quotaAlertRules.id, id))
      .returning({ id: quotaAlertRules.id });
    return rows.length > 0;
  }

  /* ──── Alert Events ──── */

  async listEvents(
    tenantId: string,
    filters?: { status?: string; limit?: number }
  ): Promise<QuotaAlertEvent[]> {
    const query = this.db
      .select()
      .from(quotaAlertEvents)
      .where(
        filters?.status
          ? and(
              eq(quotaAlertEvents.tenantId, tenantId),
              eq(quotaAlertEvents.status, filters.status)
            )
          : eq(quotaAlertEvents.tenantId, tenantId)
      )
      .orderBy(desc(quotaAlertEvents.triggeredAt))
      .limit(filters?.limit ?? 50);
    const rows = await query;
    return rows.map(toEventDomain);
  }

  async createEvent(data: {
    tenantId: string;
    ruleId: number | null;
    resourceType: string;
    currentPct: number;
    thresholdPct: number;
    severity: string;
  }): Promise<QuotaAlertEvent> {
    const [row] = await this.db
      .insert(quotaAlertEvents)
      .values({
        tenantId: data.tenantId,
        ruleId: data.ruleId,
        resourceType: data.resourceType,
        currentPct: data.currentPct,
        thresholdPct: data.thresholdPct,
        severity: data.severity,
      })
      .returning();
    return toEventDomain(row);
  }

  async acknowledgeEvent(id: number): Promise<QuotaAlertEvent | null> {
    const [row] = await this.db
      .update(quotaAlertEvents)
      .set({ status: 'acknowledged' })
      .where(eq(quotaAlertEvents.id, id))
      .returning();
    return row ? toEventDomain(row) : null;
  }

  async resolveEvent(id: number): Promise<QuotaAlertEvent | null> {
    const [row] = await this.db
      .update(quotaAlertEvents)
      .set({ status: 'resolved', resolvedAt: new Date() })
      .where(eq(quotaAlertEvents.id, id))
      .returning();
    return row ? toEventDomain(row) : null;
  }

  async countActiveEvents(tenantId: string): Promise<{ active: number; acknowledged: number }> {
    const rows = await this.db
      .select({ status: quotaAlertEvents.status })
      .from(quotaAlertEvents)
      .where(eq(quotaAlertEvents.tenantId, tenantId));

    let active = 0;
    let acknowledged = 0;
    for (const r of rows) {
      if (r.status === 'active') active++;
      else if (r.status === 'acknowledged') acknowledged++;
    }
    return { active, acknowledged };
  }

  /* ──── Usage Snapshots ──── */

  async saveSnapshot(data: {
    tenantId: string;
    resourceType: string;
    currentValue: number;
    limitValue: number;
    usagePct: number;
    metadata?: Record<string, unknown>;
  }): Promise<void> {
    await this.db.insert(quotaUsageSnapshots).values({
      tenantId: data.tenantId,
      resourceType: data.resourceType,
      currentValue: data.currentValue,
      limitValue: data.limitValue,
      usagePct: data.usagePct,
      measuredAt: new Date(),
      metadata: data.metadata ?? {},
    });
  }

  async getUsageHistory(tenantId: string, since: Date, until?: Date): Promise<UsageHistoryPoint[]> {
    const conditions = [
      eq(quotaUsageSnapshots.tenantId, tenantId),
      gte(quotaUsageSnapshots.measuredAt, since),
    ];
    if (until) conditions.push(lte(quotaUsageSnapshots.measuredAt, until));

    const rows = await this.db
      .select()
      .from(quotaUsageSnapshots)
      .where(and(...conditions))
      .orderBy(quotaUsageSnapshots.measuredAt);

    return rows.map((r) => ({
      measuredAt: r.measuredAt.toISOString(),
      resourceType: r.resourceType as ResourceType,
      currentValue: r.currentValue,
      limitValue: r.limitValue,
      usagePct: r.usagePct,
    }));
  }
}

function toRuleDomain(row: typeof quotaAlertRules.$inferSelect): QuotaAlertRule {
  return {
    id: row.id,
    tenantId: row.tenantId,
    resourceType: row.resourceType as ResourceType,
    thresholdPct: row.thresholdPct,
    severity: row.severity as AlertSeverity,
    notifyChannels: (row.notifyChannels ?? []) as NotifyChannel[],
    enabled: row.enabled,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toEventDomain(row: typeof quotaAlertEvents.$inferSelect): QuotaAlertEvent {
  return {
    id: row.id,
    tenantId: row.tenantId,
    ruleId: row.ruleId,
    resourceType: row.resourceType as ResourceType,
    currentPct: row.currentPct,
    thresholdPct: row.thresholdPct,
    severity: row.severity as AlertSeverity,
    status: row.status as AlertEventStatus,
    triggeredAt: row.triggeredAt.toISOString(),
    resolvedAt: row.resolvedAt?.toISOString() ?? null,
  };
}
