/**
 * Admin AI Gateway API Client
 *
 * 从 adminApiClient.ts 按资源域拆出（模型 / 授权 / 追踪 / 风控 / 成本 / 预算）。
 * 底层 request 由统一 httpClient 工厂提供（含超时、幂等重试、JSON 安全解析）。
 */

import { request } from './httpClient';

/** 模型授权 UI 使用的数字员工实例精简结构 */
export interface GrantInstanceDTO {
  id: string;
  name: string;
  tenantId: string;
  departmentId: string | null;
  department: string | null;
  ownerName: string | null;
  state: string;
}

export const aiGatewayApi = {
  listModels(): Promise<{ models: Record<string, unknown>[]; rows: Record<string, unknown>[] }> {
    return request('/api/admin/ai-gateway/models');
  },
  listProviders(): Promise<{ providers: Record<string, unknown>[] }> {
    return request('/api/admin/ai-gateway/providers');
  },
  createModel(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/models', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateModel(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/ai-gateway/models/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteModel(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/ai-gateway/models/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  toggleModel(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/ai-gateway/models/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
    });
  },
  healthCheck(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/ai-gateway/models/${encodeURIComponent(id)}/health-check`, {
      method: 'POST',
    });
  },
  // ── 模型授权（instance × model 白名单） ──
  listGrantsCount(): Promise<{ counts: Record<string, number> }> {
    return request('/api/admin/ai-gateway/models/grants-count');
  },
  listInstancesForGrant(tenantId?: string): Promise<{ instances: GrantInstanceDTO[] }> {
    const qs = new URLSearchParams();
    if (tenantId) qs.set('tenantId', tenantId);
    const q = qs.toString();
    return request(`/api/admin/ai-gateway/models/instances-for-grant${q ? `?${q}` : ''}`);
  },
  listModelGrants(id: string): Promise<{ grants: string[]; instances: GrantInstanceDTO[] }> {
    return request(`/api/admin/ai-gateway/models/${encodeURIComponent(id)}/grants`);
  },
  setModelGrants(id: string, instanceIds: string[], tenantId?: string): Promise<{ success: boolean; grants: string[] }> {
    const qs = new URLSearchParams();
    if (tenantId) qs.set('tenantId', tenantId);
    const q = qs.toString();
    return request(`/api/admin/ai-gateway/models/${encodeURIComponent(id)}/grants${q ? `?${q}` : ''}`, {
      method: 'PUT',
      body: JSON.stringify({ instanceIds }),
    });
  },
  listFailoverChains(): Promise<{ rows: Record<string, unknown>[] }> {
    return request('/api/admin/ai-gateway/failover-chains');
  },
  saveFailoverChain(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/failover-chains', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deleteFailoverChain(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/ai-gateway/failover-chains/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  listTraces(params?: {
    model?: string;
    status?: string;
    search?: string;
    userId?: string;
    instanceId?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: Record<string, unknown>[];
    traces: Record<string, unknown>[];
    total: number;
    page: number;
  }> {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, String(v));
      });
    const q = qs.toString();
    return request(`/api/admin/ai-gateway/traces${q ? `?${q}` : ''}`);
  },
  getTraceDetail(id: string): Promise<{ trace: Record<string, unknown> }> {
    return request(`/api/admin/ai-gateway/traces/${encodeURIComponent(id)}`);
  },
  getTraceStats(): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/stats');
  },
  // ── 分布式追踪 ──
  listDistTraces(params?: {
    status?: string;
    userId?: string;
    instanceId?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{
    items: Record<string, unknown>[];
    total: number;
    page: number;
  }> {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v != null && v !== '') qs.set(k, String(v));
      });
    const q = qs.toString();
    return request(`/api/admin/ai-gateway/dist-traces${q ? `?${q}` : ''}`);
  },
  getDistTraceDetail(id: string): Promise<{ trace: Record<string, unknown> }> {
    return request(`/api/admin/ai-gateway/dist-traces/${encodeURIComponent(id)}`);
  },
  seedDistTraces(): Promise<{ seeded: string[]; count: number }> {
    return request('/api/admin/ai-gateway/seed-dist-traces', { method: 'POST' });
  },
  listRiskRules(): Promise<{ rules: Record<string, unknown>[]; rows: Record<string, unknown>[] }> {
    return request('/api/admin/ai-gateway/risk-rules');
  },
  createRiskRule(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/risk-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateRiskRule(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/ai-gateway/risk-rules/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteRiskRule(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/ai-gateway/risk-rules/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },
  toggleRiskRule(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/ai-gateway/risk-rules/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
    });
  },
  testRiskRules(text: string): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/risk-rules/test', {
      method: 'POST',
      body: JSON.stringify({ text }),
    });
  },
  exportRiskRules(): Promise<{ rules: Record<string, unknown>[] }> {
    return request('/api/admin/ai-gateway/risk-rules/export');
  },
  importRiskRules(rules: unknown[], mode: string): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/risk-rules/import', {
      method: 'POST',
      body: JSON.stringify({ rules, mode }),
    });
  },
  getConfig(): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/config');
  },
  updateConfig(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/config', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  getStats(params?: { dateFrom?: string; dateTo?: string }): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    const q = qs.toString();
    return request(`/api/admin/ai-gateway/stats${q ? `?${q}` : ''}`);
  },
  getCosts(params?: { dateFrom?: string; dateTo?: string }): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams();
    if (params?.dateFrom) qs.set('dateFrom', params.dateFrom);
    if (params?.dateTo) qs.set('dateTo', params.dateTo);
    const q = qs.toString();
    return request(`/api/admin/ai-gateway/costs${q ? `?${q}` : ''}`);
  },
  getBudgetStatus(): Promise<{ items: Record<string, unknown>[] }> {
    return request('/api/admin/ai-gateway/budget-status');
  },
  saveBudget(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/ai-gateway/budgets', { method: 'POST', body: JSON.stringify(data) });
  },
  deleteBudget(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/ai-gateway/budgets/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
};
