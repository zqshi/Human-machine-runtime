/**
 * Admin & Platform API Client
 *
 * Covers all /api/admin/* and /api/platform/* routes.
 * 底层 request 由统一 httpClient 工厂提供（含超时、幂等重试、JSON 安全解析）。
 */

import { request } from './httpClient';
import type {
  ToolSource,
  ToolDefinition,
  ToolInstance,
  SyncResult,
  ToolStats,
  ToolCallLog,
} from '../../domain/tool/types';

export { request };

// 以下大块已按资源域拆出至同目录子文件，此处 barrel re-export 保持 adminApiClient 的
// 对外引用契约不变（所有 `from '.../adminApiClient'` 无需改动）。
export { aiGatewayApi } from './adminAiGatewayApi';
export type { GrantInstanceDTO } from './adminAiGatewayApi';
export { quotaApi } from './adminQuotaApi';
export type {
  QuotaUsageItem,
  QuotaDashboardData,
  AllocationRow,
  AllocationData,
  QuotaAlertRule,
  QuotaAlertEvent,
  TenantDefaultConfig,
} from './adminQuotaApi';

// ─── Instances ──────────────────────────────────────────────────────

/** 实例详情(对齐后端 Instance domain,含 v1.9 agentDefinitionId 关联) */
export interface InstanceDetail {
  id: string;
  name?: string;
  state?: string;
  tenantId?: string;
  /** v1.9:关联的 AgentDefinition id(useAgentChat 拉 persona 用) */
  agentDefinitionId?: string | null;
  agentGeneration?: number | null;
  [key: string]: unknown;
}

export const instanceApi = {
  list(): Promise<{ instances: InstanceDetail[] }> {
    return request('/api/admin/instances');
  },
  get(id: string): Promise<InstanceDetail> {
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
// 工具相关纯类型上移至 domain 层（消除跨层类型耦合）；此处 re-export 保持
// infrastructure 内部及已存在的 application 层 import 不破坏。
export type {
  ToolSource,
  ToolDefinition,
  ToolInstance,
  SyncResult,
  ToolStats,
  ToolCallLog,
} from '../../domain/tool/types';

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
  /** T37:探测表结构不落库(供 McpDatabaseFlow 测试连接+预览 schema,勾选后再 sync) */
  introspectSource(id: string): Promise<{
    tables: Array<{
      tableName: string;
      tableType: string;
      columns: Array<{ name: string; dataType: string; isPrimaryKey: boolean }>;
    }>;
    errors: string[];
  }> {
    return request(`/api/admin/tools/sources/${encodeURIComponent(id)}/introspect`, {
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
