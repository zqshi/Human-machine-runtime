/**
 * OpenClaw Admin API Client
 *
 * Covers /api/admin/openclaw/* routes (monitor, config, statistics).
 * Split from adminApiClient.ts for the 1000-line limit.
 */

import { request } from './adminApiClient';

// ─── OpenClaw Monitor ─────────────────────────────────────────────

export const openclawMonitorApi = {
  costOverview(): Promise<Record<string, unknown>> {
    return request('/api/admin/openclaw/monitor/cost');
  },
  sla(): Promise<Record<string, unknown>> {
    return request('/api/admin/openclaw/monitor/sla');
  },
  alerts(): Promise<{ alerts: Record<string, unknown>[] }> {
    return request('/api/admin/openclaw/monitor/alerts');
  },
  performance(): Promise<Record<string, unknown>> {
    return request('/api/admin/openclaw/monitor/performance');
  },
  health(): Promise<{ metrics: { label: string; value: string; status: string }[] }> {
    return request('/api/admin/analytics/health');
  },
};

// ─── OpenClaw Config ────────────────────────────────────────────

export interface OpenclawConfig {
  runtime: {
    openclawImage?: string;
    openclawRuntimeVersion?: string;
    openclawSourcePath?: string;
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
  config: OpenclawConfig;
}

export const openclawConfigApi = {
  get(): Promise<OpenclawConfig> {
    return request('/api/admin/runtime/openclaw-config');
  },
  save(config: OpenclawConfig): Promise<{ success: boolean }> {
    return request('/api/admin/runtime/openclaw-config', {
      method: 'POST',
      body: JSON.stringify(config),
    });
  },
  snapshots(): Promise<{ snapshots: ConfigSnapshot[] }> {
    return request('/api/admin/runtime/openclaw-config/snapshots');
  },
  restore(snapshotId: string): Promise<{ success: boolean }> {
    return request(
      `/api/admin/runtime/openclaw-config/snapshots/${encodeURIComponent(snapshotId)}/restore`,
      {
        method: 'POST',
      }
    );
  },
};

// ─── OpenClaw Statistics ──────────────────────────────────────────

function buildDateQuery(params?: { startDate?: string; endDate?: string; days?: number }): string {
  if (!params) return '';
  const parts: string[] = [];
  if (params.startDate) parts.push(`startDate=${params.startDate}`);
  if (params.endDate) parts.push(`endDate=${params.endDate}`);
  if (params.days) parts.push(`days=${params.days}`);
  return parts.length > 0 ? `?${parts.join('&')}` : '';
}

export const openclawStatisticsApi = {
  dau(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/openclaw/statistics/dau?days=${daysOrOpts}`);
    }
    return request(`/api/admin/openclaw/statistics/dau${buildDateQuery(daysOrOpts)}`);
  },
  messages(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/openclaw/statistics/messages?days=${daysOrOpts}`);
    }
    return request(`/api/admin/openclaw/statistics/messages${buildDateQuery(daysOrOpts)}`);
  },
  retention(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/openclaw/statistics/retention?days=${daysOrOpts}`);
    }
    return request(`/api/admin/openclaw/statistics/retention${buildDateQuery(daysOrOpts)}`);
  },
  tokens(
    daysOrOpts?: number | { startDate?: string; endDate?: string; days?: number }
  ): Promise<{ days: string[]; values: number[] }> {
    if (typeof daysOrOpts === 'number') {
      return request(`/api/admin/openclaw/statistics/tokens?days=${daysOrOpts}`);
    }
    return request(`/api/admin/openclaw/statistics/tokens${buildDateQuery(daysOrOpts)}`);
  },
  deptTokens(): Promise<{ departments: Record<string, unknown>[] }> {
    return request('/api/admin/openclaw/statistics/dept-tokens');
  },
  topUsers(limit?: number): Promise<{ users: Record<string, unknown>[] }> {
    return request(`/api/admin/openclaw/statistics/top-users${limit ? `?limit=${limit}` : ''}`);
  },
  topUserSpend(limit?: number): Promise<{
    users: { userId: string; count: number; totalTokens: number; estimatedCost: number }[];
  }> {
    return request(
      `/api/admin/openclaw/statistics/top-user-spend${limit ? `?limit=${limit}` : ''}`
    );
  },
  latency(days?: number): Promise<{ days: string[]; p50: number[]; p95: number[]; avg: number[] }> {
    return request(`/api/admin/openclaw/statistics/latency${days ? `?days=${days}` : ''}`);
  },
  errorRate(days?: number): Promise<{ days: string[]; values: number[] }> {
    return request(`/api/admin/openclaw/statistics/error-rate${days ? `?days=${days}` : ''}`);
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
    return request(`/api/admin/openclaw/statistics/user-analysis?${qs.toString()}`);
  },
};
