/**
 * Admin Quota Management API Client
 *
 * 从 adminApiClient.ts 按资源域拆出（配额看板 / 分配 / 用量历史 / 告警规则与事件 / 默认配置）。
 * 底层 request 由统一 httpClient 工厂提供。
 */

import { request } from './httpClient';

export interface QuotaUsageItem {
  resourceType: string;
  current: number;
  limit: number;
  usagePct: number;
  unit: string;
}

export interface QuotaDashboardData {
  tenantId: string;
  items: QuotaUsageItem[];
  alerts: { active: number; acknowledged: number };
}

export interface AllocationRow {
  instanceId: string;
  instanceName: string;
  state: string;
  cpu: string;
  memory: string;
  cpuUsed: string;
  memoryUsed: string;
  monthlyBudget: number;
  budgetUsed: number;
  resourceSource: string;
}

export interface AllocationData {
  tenantId: string;
  rows: AllocationRow[];
  totals: {
    instanceCount: number;
    instanceLimit: number;
    budgetAllocated: number;
    budgetLimit: number;
  };
}

export interface QuotaAlertRule {
  id: number;
  tenantId: string;
  resourceType: string;
  thresholdPct: number;
  severity: string;
  notifyChannels: string[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface QuotaAlertEvent {
  id: number;
  tenantId: string;
  ruleId: number | null;
  resourceType: string;
  currentPct: number;
  thresholdPct: number;
  severity: string;
  status: string;
  triggeredAt: string;
  resolvedAt: string | null;
}

export interface TenantDefaultConfig {
  cpu: string;
  memory: string;
  storage: string;
  monthlyBudget: number;
  dailyBudget: number;
  maxConcurrency: number;
}

function quotaQs(tenantId?: string, extra?: Record<string, string>): string {
  const ps = new URLSearchParams();
  if (tenantId) ps.set('tenantId', tenantId);
  if (extra) Object.entries(extra).forEach(([k, v]) => ps.set(k, v));
  const s = ps.toString();
  return s ? `?${s}` : '';
}

export const quotaApi = {
  getDashboard(tenantId?: string): Promise<{ data: QuotaDashboardData }> {
    return request(`/api/control/quotas/dashboard${quotaQs(tenantId)}`);
  },
  getAllocation(tenantId?: string): Promise<{ data: AllocationData }> {
    return request(`/api/control/quotas/allocation${quotaQs(tenantId)}`);
  },
  getUsageHistory(
    tenantId?: string,
    days = 30
  ): Promise<{ data: Array<{ measuredAt: string; resourceType: string; usagePct: number }> }> {
    return request(`/api/control/quotas/usage-history${quotaQs(tenantId, { days: String(days) })}`);
  },
  listRules(tenantId?: string): Promise<{ data: QuotaAlertRule[] }> {
    return request(`/api/control/quotas/alerts/rules${quotaQs(tenantId)}`);
  },
  createRule(
    data: {
      resourceType: string;
      thresholdPct: number;
      severity?: string;
      notifyChannels?: string[];
    },
    tenantId?: string
  ): Promise<{ data: QuotaAlertRule }> {
    return request(`/api/control/quotas/alerts/rules${quotaQs(tenantId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateRule(
    ruleId: number,
    data: { thresholdPct?: number; severity?: string; notifyChannels?: string[]; enabled?: boolean }
  ): Promise<{ data: QuotaAlertRule }> {
    return request(`/api/control/quotas/alerts/rules/${ruleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteRule(ruleId: number): Promise<{ success: boolean }> {
    return request(`/api/control/quotas/alerts/rules/${ruleId}`, { method: 'DELETE' });
  },
  listEvents(
    tenantId?: string,
    filters?: { status?: string; limit?: number }
  ): Promise<{ data: QuotaAlertEvent[] }> {
    const ps = new URLSearchParams();
    if (tenantId) ps.set('tenantId', tenantId);
    if (filters?.status) ps.set('status', filters.status);
    if (filters?.limit) ps.set('limit', String(filters.limit));
    const qs = ps.toString();
    return request(`/api/control/quotas/alerts/events${qs ? `?${qs}` : ''}`);
  },
  acknowledgeEvent(eventId: number): Promise<{ data: QuotaAlertEvent }> {
    return request(`/api/control/quotas/alerts/events/${eventId}/ack`, { method: 'POST' });
  },
  getDefaults(tenantId?: string): Promise<{ data: TenantDefaultConfig }> {
    return request(`/api/control/quotas/defaults${quotaQs(tenantId)}`);
  },
  updateDefaults(
    data: Partial<TenantDefaultConfig>,
    tenantId?: string
  ): Promise<{ data: TenantDefaultConfig }> {
    return request(`/api/control/quotas/defaults${quotaQs(tenantId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};
