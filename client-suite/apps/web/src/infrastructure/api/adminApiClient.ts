/**
 * Admin & Platform API Client
 *
 * Covers all /api/admin/* and /api/platform/* routes.
 */

import { ApiError } from './hmrApiClient';

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (path.includes('/undefined') || path.includes('/null')) {
    return Promise.reject(new Error(`invalid API path: ${path}`));
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(path, {
      credentials: 'include',
      signal: controller.signal,
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...init?.headers,
      },
    });
    if (!res.ok) {
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        /* ignore */
      }
      throw new ApiError(res.status, res.statusText, body);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as T);
  } finally {
    clearTimeout(timeoutId);
  }
}

// ─── Instances ──────────────────────────────────────────────────────

export const instanceApi = {
  list(): Promise<{ instances: Record<string, unknown>[] }> {
    return request('/api/admin/instances');
  },
  get(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/instances/${encodeURIComponent(id)}`);
  },
  start(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/instances/${encodeURIComponent(id)}/start`, { method: 'POST' });
  },
  stop(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/instances/${encodeURIComponent(id)}/stop`, { method: 'POST' });
  },
  rebuild(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/instances/${encodeURIComponent(id)}/rebuild`, { method: 'POST' });
  },
};

// ─── Skills ─────────────────────────────────────────────────────────

export const skillApi = {
  list(params?: {
    category?: string;
    status?: string;
    keyword?: string;
    source?: string;
    name?: string;
    employeeId?: string;
  }): Promise<{ skills: Record<string, unknown>[]; total: number }> {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v) qs.set(k, v);
      });
    const q = qs.toString();
    return request(`/api/admin/skills${q ? `?${q}` : ''}`);
  },
  get(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/skills/${encodeURIComponent(id)}`);
  },
  create(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/skills', { method: 'POST', body: JSON.stringify(data) });
  },
  update(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/skills/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/skills/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  link(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/skills/${encodeURIComponent(id)}/link`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  unlink(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/skills/${encodeURIComponent(id)}/unlink`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getPolicy(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/skills/${encodeURIComponent(id)}/policy`);
  },
  updatePolicy(id: string, policy: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/skills/${encodeURIComponent(id)}/policy`, {
      method: 'PUT',
      body: JSON.stringify(policy),
    });
  },
  exportAll(): Promise<Record<string, unknown>> {
    return request('/api/admin/skills/export');
  },
  importBatch(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/skills/import', { method: 'POST', body: JSON.stringify(data) });
  },
  listEmployees(): Promise<Record<string, unknown>[]> {
    return request('/api/admin/skills/employees');
  },
  getSedimentationPolicy(): Promise<Record<string, unknown>> {
    return request('/api/admin/runtime/skill-sedimentation-policy');
  },
  updateSedimentationPolicy(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/runtime/skill-sedimentation-policy', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  getFileContent(
    id: string,
    filename: string,
    version?: string
  ): Promise<{ filename: string; content: string; size: number }> {
    const params = new URLSearchParams({ filename });
    if (version) params.set('version', version);
    return request(`/api/admin/skills/${encodeURIComponent(id)}/file?${params}`);
  },
};

// ─── Tools ──────────────────────────────────────────────────────────

export interface ToolSource {
  id: string;
  tenantId: string;
  sourceType: 'openapi' | 'database' | 'gateway' | 'mcp_native';
  name: string;
  description?: string;
  status: string;
  toolCount: number;
  specUrl?: string;
  specVersion?: string;
  dbType?: string;
  dbHost?: string;
  dbPort?: number;
  dbName?: string;
  gatewayType?: string;
  gatewayUrl?: string;
  mcpTransport?: string;
  mcpEndpoint?: string;
  syncStrategy?: string;
  lastSyncedAt?: string;
  lastSyncError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ToolDefinition {
  id: string;
  sourceId: string;
  name: string;
  operationId?: string;
  method?: string;
  path?: string;
  summary?: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  executionType: string;
  tags?: string[];
  enabled: boolean;
  status: string;
  callCount: number;
  lastCalledAt?: string;
}

export interface ToolInstance {
  id: string;
  definitionId: string;
  tenantId: string;
  instanceId?: string;
  displayName?: string;
  status: string;
}

export interface SyncResult {
  success: boolean;
  toolsCreated: number;
  toolsUpdated: number;
  toolsRemoved: number;
  errors: string[];
}

export interface ToolStats {
  totalSources: number;
  totalDefinitions: number;
  enabledDefinitions: number;
  totalCalls: number;
  successRate: number;
  avgDurationMs: number;
}

export interface ToolCallLog {
  id: string;
  definitionId: string;
  callerId?: string;
  durationMs?: number;
  status: string;
  errorMessage?: string;
  calledAt: string;
}

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

export const toolApi = {
  // Sources
  listSources(): Promise<{ sources: ToolSource[] }> {
    return request('/api/admin/tools/sources');
  },
  getSource(id: string): Promise<ToolSource> {
    return request(`/api/admin/tools/sources/${encodeURIComponent(id)}`);
  },
  createSource(data: object): Promise<ToolSource> {
    return request('/api/admin/tools/sources', { method: 'POST', body: JSON.stringify(data) });
  },
  updateSource(id: string, data: object): Promise<ToolSource> {
    return request(`/api/admin/tools/sources/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  deleteSource(id: string): Promise<void> {
    return request(`/api/admin/tools/sources/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  syncSource(id: string): Promise<SyncResult> {
    return request(`/api/admin/tools/sources/${encodeURIComponent(id)}/sync`, { method: 'POST' });
  },
  testConnection(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/tools/sources/${encodeURIComponent(id)}/test-connection`, {
      method: 'POST',
    });
  },
  uploadSpec(
    specContent: string
  ): Promise<{ specVersion: string; title: string; toolCount: number }> {
    return request('/api/admin/tools/upload-spec', {
      method: 'POST',
      body: JSON.stringify({ specContent }),
    });
  },

  // Definitions
  listDefinitions(params?: { sourceId?: string }): Promise<{ definitions: ToolDefinition[] }> {
    const qs = params?.sourceId ? `?sourceId=${encodeURIComponent(params.sourceId)}` : '';
    return request(`/api/admin/tools/definitions${qs}`);
  },
  getDefinition(id: string): Promise<ToolDefinition> {
    return request(`/api/admin/tools/definitions/${encodeURIComponent(id)}`);
  },
  updateDefinition(id: string, data: object): Promise<ToolDefinition> {
    return request(`/api/admin/tools/definitions/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  testTool(
    id: string,
    params: object
  ): Promise<{ success: boolean; data?: unknown; error?: string; durationMs: number }> {
    return request(`/api/admin/tools/definitions/${encodeURIComponent(id)}/test`, {
      method: 'POST',
      body: JSON.stringify({ params }),
    });
  },

  // Instances
  listInstances(): Promise<{ instances: ToolInstance[] }> {
    return request('/api/admin/tools/instances');
  },
  bindTool(data: {
    definitionId: string;
    instanceId?: string;
    displayName?: string;
  }): Promise<ToolInstance> {
    return request('/api/admin/tools/instances', { method: 'POST', body: JSON.stringify(data) });
  },
  unbindTool(id: string): Promise<void> {
    return request(`/api/admin/tools/instances/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },

  // Stats
  getStats(): Promise<ToolStats> {
    return request('/api/admin/tools/stats');
  },
  getCallLogs(params?: { limit?: number; offset?: number }): Promise<{ logs: ToolCallLog[] }> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString();
    return request(`/api/admin/tools/call-logs${q ? `?${q}` : ''}`);
  },
};

// ─── AI Gateway ─────────────────────────────────────────────────────

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

// ─── Logs ───────────────────────────────────────────────────────────

export const adminLogsApi = {
  list(params?: {
    scope?: string;
    level?: string;
    keyword?: string;
    limit?: number;
    module?: string;
    page?: string;
    operation?: string;
    status?: string;
    timeRange?: string;
    trace?: string;
    actor?: string;
  }): Promise<Record<string, unknown>[]> {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v));
      });
    const q = qs.toString();
    return request(`/api/admin/logs${q ? `?${q}` : ''}`);
  },
  exportCsv(params?: Record<string, string>): Promise<Blob> {
    const qs = new URLSearchParams(params);
    const q = qs.toString();
    return request(`/api/admin/logs/export/csv${q ? `?${q}` : ''}`);
  },
  exportJson(params?: Record<string, string>): Promise<Record<string, unknown>[]> {
    const qs = new URLSearchParams(params);
    const q = qs.toString();
    return request(`/api/admin/logs/export/json${q ? `?${q}` : ''}`);
  },
};

// ─── Auth Management ────────────────────────────────────────────────

export const authMgmtApi = {
  listUsers(): Promise<{ users: Record<string, unknown>[] }> {
    return request('/api/admin/auth/users');
  },
  createUser(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/auth/users', { method: 'POST', body: JSON.stringify(data) });
  },
  updateUser(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/auth/users/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deleteUser(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/auth/users/${encodeURIComponent(id)}/delete`, { method: 'POST' });
  },
  listRoles(): Promise<{ roles: Record<string, unknown>[] }> {
    return request('/api/admin/auth/roles');
  },
  createRole(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/auth/roles', { method: 'POST', body: JSON.stringify(data) });
  },
  updateRole(role: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/auth/roles/${encodeURIComponent(role)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  deleteRole(role: string): Promise<{ success: boolean }> {
    return request(`/api/admin/auth/roles/${encodeURIComponent(role)}/delete`, { method: 'POST' });
  },
  assignRole(userId: string, roleId: string): Promise<Record<string, unknown>> {
    return request('/api/admin/auth/role-assignments', {
      method: 'POST',
      body: JSON.stringify({ userId, roleId }),
    });
  },
  removeRole(userId: string, roleId: string): Promise<{ success: boolean }> {
    return request('/api/admin/auth/role-assignments', {
      method: 'DELETE',
      body: JSON.stringify({ userId, roleId }),
    });
  },
  health(): Promise<Record<string, unknown>> {
    return request('/api/admin/auth/health');
  },
};

// ─── Notifications ──────────────────────────────────────────────────

export const adminNotificationApi = {
  list(): Promise<{ items: Record<string, unknown>[]; summary: Record<string, unknown> }> {
    return request('/api/admin/notifications');
  },
  count(): Promise<{ unread: number; total: number }> {
    return request('/api/admin/notifications/count');
  },
  markRead(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/notifications/${encodeURIComponent(id)}/read`, { method: 'POST' });
  },
  dismiss(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/notifications/${encodeURIComponent(id)}/dismiss`, {
      method: 'POST',
    });
  },
  snooze(id: string, hours: number): Promise<{ success: boolean }> {
    return request(`/api/admin/notifications/${encodeURIComponent(id)}/snooze`, {
      method: 'POST',
      body: JSON.stringify({ hours }),
    });
  },
  escalate(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/notifications/${encodeURIComponent(id)}/escalate`, {
      method: 'POST',
    });
  },
  listPushChannels(): Promise<{ channels: Record<string, unknown>[] }> {
    return request('/api/admin/push-channels');
  },
  savePushChannel(data: object): Promise<Record<string, unknown>> {
    return request('/api/admin/push-channels', { method: 'POST', body: JSON.stringify(data) });
  },
  deletePushChannel(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/push-channels/${encodeURIComponent(id)}/delete`, {
      method: 'POST',
    });
  },
  testPushChannel(id: string): Promise<{ success: boolean; message?: string }> {
    return request(`/api/admin/push-channels/${encodeURIComponent(id)}/test`, {
      method: 'POST',
    });
  },
};

// ─── Analytics ──────────────────────────────────────────────────────

export const analyticsApi = {
  logStats(params?: { scope?: string; days?: number }): Promise<Record<string, unknown>> {
    const qs = new URLSearchParams();
    if (params)
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined) qs.set(k, String(v));
      });
    const q = qs.toString();
    return request(`/api/admin/analytics/log-stats${q ? `?${q}` : ''}`);
  },
  agentPerformance(): Promise<Record<string, unknown>> {
    return request('/api/admin/analytics/agent-performance');
  },
  alerts(): Promise<Record<string, unknown>> {
    return request('/api/admin/analytics/alerts');
  },
  health(): Promise<Record<string, unknown>> {
    return request('/api/admin/analytics/health');
  },
  dauTrend(days?: number): Promise<Record<string, unknown>> {
    const qs = days ? `?days=${days}` : '';
    return request(`/api/admin/analytics/dau-trend${qs}`);
  },
  latencyTrend(days?: number): Promise<Record<string, unknown>> {
    const qs = days ? `?days=${days}` : '';
    return request(`/api/admin/analytics/latency-trend${qs}`);
  },
};

// ─── Quota Management ──────────────────────────────────────────────

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

// ─── Channel Management ────────────────────────────────────────────

export interface ChannelConfig {
  id: string;
  appId: string;
  name: string;
  ak: string;
  sk: string;
  webhookUrl: string;
  webhookEnabled: boolean;
  createdAt: string;
  updatedAt: string;
  verified: boolean;
}

export const channelApi = {
  list(params?: { keyword?: string }): Promise<{ channels: ChannelConfig[] }> {
    const qs = new URLSearchParams();
    if (params?.keyword) qs.set('keyword', params.keyword);
    const q = qs.toString();
    return request(`/api/admin/channels${q ? `?${q}` : ''}`);
  },
  get(id: string): Promise<ChannelConfig> {
    return request(`/api/admin/channels/${encodeURIComponent(id)}`);
  },
  create(data: {
    appId: string;
    name: string;
    ak: string;
    sk: string;
    webhookUrl?: string;
    webhookEnabled?: boolean;
  }): Promise<ChannelConfig> {
    return request('/api/admin/channels', { method: 'POST', body: JSON.stringify(data) });
  },
  update(
    id: string,
    data: {
      appId?: string;
      name?: string;
      ak?: string;
      sk?: string;
      webhookUrl?: string;
      webhookEnabled?: boolean;
    }
  ): Promise<ChannelConfig> {
    return request(`/api/admin/channels/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  delete(id: string): Promise<{ success: boolean }> {
    return request(`/api/admin/channels/${encodeURIComponent(id)}`, { method: 'DELETE' });
  },
  verify(id: string): Promise<{ success: boolean; message: string }> {
    return request(`/api/admin/channels/${encodeURIComponent(id)}/verify`, { method: 'POST' });
  },
};

// ─── Employee Detail (Admin) ───────────────────────────────────────

export const employeeDetailApi = {
  getDetail(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}`);
  },
  updateProfile(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/profile`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updatePolicy(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/policy`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  updateApprovalPolicy(id: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/approval-policy`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  optimizePolicyPrompt(id: string, data: object): Promise<{ prompt: string }> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/optimize-policy-prompt`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  instanceAction(
    id: string,
    action: string,
    payload?: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/instance-action`, {
      method: 'POST',
      body: JSON.stringify({ action, ...payload }),
    });
  },
  syncIdentity(id: string): Promise<Record<string, unknown>> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/sync-identity`, {
      method: 'POST',
    });
  },
  getResources(id: string): Promise<{ resources: Record<string, unknown> }> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/resources`);
  },
  updateResources(
    id: string,
    data: object
  ): Promise<{ success: boolean; resources: Record<string, unknown> }> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/resources`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  resetResources(id: string): Promise<{ success: boolean; resources: Record<string, unknown> }> {
    return request(`/api/admin/employees/${encodeURIComponent(id)}/resources/reset`, {
      method: 'POST',
    });
  },
};
