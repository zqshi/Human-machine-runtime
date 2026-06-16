/**
 * Platform API Client
 *
 * Covers /api/platform/* routes (tenants, users, roles, config, monitoring, audit).
 * Split from adminApiClient.ts for the 1000-line limit.
 */

import { request } from './adminApiClient';

// ─── Platform: Tenants ──────────────────────────────────────────────

export const tenantApi = {
  list(): Promise<{ tenants: Record<string, unknown>[]; total: number }> {
    return request('/api/platform/tenants');
  },
  get(id: string): Promise<{ tenant: Record<string, unknown> }> {
    return request(`/api/platform/tenants/${encodeURIComponent(id)}`);
  },
  create(data: object): Promise<{
    tenant: Record<string, unknown>;
    adminCreated: boolean;
    initialCredentials: { username: string; password: string } | null;
  }> {
    return request('/api/platform/tenants', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: object): Promise<{ tenant: Record<string, unknown> }> {
    return request(`/api/platform/tenants/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  suspend(id: string): Promise<Record<string, unknown>> {
    return request(`/api/platform/tenants/${encodeURIComponent(id)}/suspend`, { method: 'POST' });
  },
  activate(id: string): Promise<Record<string, unknown>> {
    return request(`/api/platform/tenants/${encodeURIComponent(id)}/activate`, { method: 'POST' });
  },
  archive(id: string): Promise<Record<string, unknown>> {
    return request(`/api/platform/tenants/${encodeURIComponent(id)}/archive`, { method: 'POST' });
  },
  checkDeletable(id: string): Promise<{ deletable: boolean; reason?: string }> {
    return request(`/api/platform/tenants/${encodeURIComponent(id)}/deletable`);
  },
  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/platform/tenants/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  getConfig(
    tenantId: string
  ): Promise<{ global: Record<string, unknown>; overrides: Record<string, unknown> }> {
    return request(`/api/platform/tenants/${encodeURIComponent(tenantId)}/config`);
  },
  updateConfig(
    tenantId: string,
    overrides: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return request(`/api/platform/tenants/${encodeURIComponent(tenantId)}/config`, {
      method: 'PUT',
      body: JSON.stringify(overrides),
    });
  },
  resetConfigKey(tenantId: string, key: string): Promise<Record<string, unknown>> {
    return request(
      `/api/platform/tenants/${encodeURIComponent(tenantId)}/config/${encodeURIComponent(key)}`,
      {
        method: 'DELETE',
      }
    );
  },
};

// ─── Platform: Users ────────────────────────────────────────────────

export const platformUserApi = {
  list(params?: { scope?: string; role?: string }): Promise<{ users: Record<string, unknown>[] }> {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
    const q = qs.toString();
    return request(`/api/platform/users${q ? `?${q}` : ''}`);
  },
  create(data: object): Promise<Record<string, unknown>> {
    return request('/api/platform/users', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/platform/users/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  resetPassword(id: string): Promise<Record<string, unknown>> {
    return request(`/api/platform/users/${encodeURIComponent(id)}/reset-password`, {
      method: 'POST',
    });
  },
  toggleDisable(id: string): Promise<Record<string, unknown>> {
    return request(`/api/platform/users/${encodeURIComponent(id)}/toggle-disable`, {
      method: 'POST',
    });
  },
};

// ─── Platform: Roles ──────────────────────────────────────────────

export const platformRoleApi = {
  list(): Promise<{ roles: Record<string, unknown>[]; permissions: Record<string, unknown>[] }> {
    return request('/api/platform/roles');
  },
  create(data: object): Promise<Record<string, unknown>> {
    return request('/api/platform/roles', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/platform/roles/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: string): Promise<Record<string, unknown>> {
    return request(`/api/platform/roles/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};

// ─── Platform: Config ───────────────────────────────────────────────

export const platformConfigApi = {
  list(): Promise<{ config: Record<string, unknown> }> {
    return request('/api/platform/config');
  },
  update(data: object): Promise<Record<string, unknown>> {
    return request('/api/platform/config', { method: 'PUT', body: JSON.stringify(data) });
  },
};

// ─── Platform: Monitoring ───────────────────────────────────────────

export const platformMonitoringApi = {
  overview(): Promise<Record<string, unknown>> {
    return request('/api/platform/monitoring/overview');
  },
  resources(): Promise<Record<string, unknown>> {
    return request('/api/platform/monitoring/resources');
  },
  health(): Promise<Record<string, unknown>> {
    return request('/api/platform/monitoring/health');
  },
};

// ─── Platform: Audit ───────────────────────────────────────────────

export const platformAuditApi = {
  async list(params?: {
    limit?: number;
    type?: string;
  }): Promise<{ logs: Record<string, unknown>[]; total: number }> {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v));
      });
    const q = qs.toString();
    const r = await request<{ data?: Record<string, unknown>[]; total?: number }>(
      `/api/control/audits${q ? `?${q}` : ''}`
    );
    return { logs: r.data || [], total: r.total || 0 };
  },
};

// ─── Platform: Plans ───────────────────────────────────────────────

export interface PlanDTO {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  description: string | null;
  isDefault: boolean;
  status: string;
  quotaTemplate: Record<string, unknown>;
  featureTemplate: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
}

export const planApi = {
  list(): Promise<{ plans: PlanDTO[] }> {
    return request('/api/platform/plans');
  },
  get(id: string): Promise<{ plan: PlanDTO }> {
    return request(`/api/platform/plans/${encodeURIComponent(id)}`);
  },
  create(data: object): Promise<{ plan: PlanDTO }> {
    return request('/api/platform/plans', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: object): Promise<{ plan: PlanDTO }> {
    return request(`/api/platform/plans/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/platform/plans/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
