/**
 * Cockpit Admin API Client
 *
 * Covers /api/admin/cockpit/* routes (monitor, config, statistics).
 * Split from adminApiClient.ts for the 1000-line limit.
 */

import { request } from './adminApiClient';

// ─── Cockpit Monitor ─────────────────────────────────────────────

export const cockpitMonitorApi = {
  costOverview(): Promise<Record<string, unknown>> {
    return request('/api/admin/cockpit/monitor/cost');
  },
  sla(): Promise<Record<string, unknown>> {
    return request('/api/admin/cockpit/monitor/sla');
  },
  alerts(): Promise<{ alerts: Record<string, unknown>[] }> {
    return request('/api/admin/cockpit/monitor/alerts');
  },
  performance(): Promise<Record<string, unknown>> {
    return request('/api/admin/cockpit/monitor/performance');
  },
  health(): Promise<{ metrics: { label: string; value: string; status: string }[] }> {
    return request('/api/admin/analytics/health');
  },
};

// ─── Cockpit Config ────────────────────────────────────────────

export interface CockpitConfig {
  runtime: {
    cockpitImage?: string;
    cockpitRuntimeVersion?: string;
    cockpitSourcePath?: string;
  };
  permissionTemplate: {
    commandAllowlist?: string[];
    approvalByRisk?: Record<string, unknown>;
  };
  retention: {
    auditLogTtlDays?: number;
    auditLogMaxRows?: number;
    archiveEnabled?: boolean;
    archiveRingSize?: number;
  };
}

export interface ConfigSnapshot {
  id: string;
  savedAt: string;
  actor?: string;
  config: CockpitConfig;
}

export const cockpitConfigApi = {
  get(): Promise<CockpitConfig> {
    return request('/api/admin/runtime/cockpit-config');
  },
  save(config: CockpitConfig): Promise<{ success: boolean }> {
    return request('/api/admin/runtime/cockpit-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },
  snapshots(): Promise<{ snapshots: ConfigSnapshot[] }> {
    return request('/api/admin/runtime/cockpit-config/snapshots');
  },
  restore(snapshotId: string): Promise<{ success: boolean }> {
    return request(
      `/api/admin/runtime/cockpit-config/snapshots/${encodeURIComponent(snapshotId)}/restore`,
      {
        method: 'POST',
      }
    );
  },
};

// ─── Cockpit Statistics ──────────────────────────────────────────

function buildDateQuery(params?: { startDate?: string; endDate?: string; days?: number }): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.startDate) parts.push(`startDate=${params.startDate}`);
  if (params.endDate) parts.push(`endDate=${params.endDate}`);
  if (params.days) parts.push(`days=${params.days}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export const cockpitStatisticsApi = {
  dau(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/cockpit/statistics/dau?days=${daysOrOpts}`);
    }
    return request(`/api/admin/cockpit/statistics/dau${buildDateQuery(daysOrOpts)}`);
  },
  messages(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/cockpit/statistics/messages?days=${daysOrOpts}`);
    }
    return request(`/api/admin/cockpit/statistics/messages${buildDateQuery(daysOrOpts)}`);
  },
  retention(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/cockpit/statistics/retention?days=${daysOrOpts}`);
    }
    return request(`/api/admin/cockpit/statistics/retention${buildDateQuery(daysOrOpts)}`);
  },
  tokens(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/cockpit/statistics/tokens?days=${daysOrOpts}`);
    }
    return request(`/api/admin/cockpit/statistics/tokens${buildDateQuery(daysOrOpts)}`);
  },
  deptTokens(): Promise<{ departments: Record<string, unknown>[] }> {
    return request('/api/admin/cockpit/statistics/dept-tokens');
  },
  topUsers(limit?: number): Promise<{ users: Record<string, unknown>[] }> {
    return request(`/api/admin/cockpit/statistics/top-users${limit ? `?limit=${limit}` : ''}`);
  },
  topUserSpend(limit?: number): Promise<{
    users: { userId: string; count: number; totalTokens: number; estimatedCost: number }[];
  }> {
    return request(
      `/api/admin/cockpit/statistics/top-user-spend${limit ? `?limit=${limit}` : ''}`
    );
  },
  latency(days?: number): Promise<{ days: string[]; p50: number[]; p95: number[]; avg: number[] }> {
    return request(`/api/admin/cockpit/statistics/latency${days ? `?days=${days}` : ''}`);
  },
  errorRate(days?: number): Promise<{ days: string[]; values: number[] }> {
    return request(`/api/admin/cockpit/statistics/error-rate${days ? `?days=${days}` : ''}`);
  },
  userAnalysis(params: {
    startDate: string;
    endDate: string;
    department?: string;
    userId?: string;
    limit?: number;
  }): Promise<{
    users: {
      userId: string;
      department: string;
      messages: number;
      tokens: number;
      estimatedCost: number;
    }[];
    departments: string[];
  }> {
    const qs = new URLSearchParams();
    qs.set('startDate', params.startDate);
    qs.set('endDate', params.endDate);
    if (params.department) qs.set('department', params.department);
    if (params.userId) qs.set('userId', params.userId);
    if (params.limit) qs.set('limit', String(params.limit));
    return request(`/api/admin/cockpit/statistics/user-analysis?${qs.toString()}`);
  },
};
