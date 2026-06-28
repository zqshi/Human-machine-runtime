/**
 * v1.9 管理后台 API Client — 审批队列 / 运行时模板 / Feature Flag。
 *
 * 消费后端 T4(tool-approvals)/T5(feature-flag)/T6(runtime-templates) route。
 * 底层 request 由统一 httpClient 工厂提供。路由前缀 /api/admin/*。
 */
import { request } from './httpClient';

/* ---------- Tool Approvals(#7 审批队列,T4) ---------- */

export type ToolApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface ToolApproval {
  id: string;
  tenantId: string;
  toolId: string;
  toolName: string;
  riskLevel: string;
  instanceId: string | null;
  params: Record<string, unknown>;
  context: Record<string, unknown>;
  status: ToolApprovalStatus;
  requestedBy: string | null;
  reviewedBy: string | null;
  reviewNote: string | null;
  result: Record<string, unknown> | null;
  createdAt: string;
  reviewedAt: string | null;
}

export const toolApprovalsApi = {
  listPending(): Promise<{ items: ToolApproval[]; total: number }> {
    return request('/api/admin/tool-approvals/pending');
  },
  approve(id: string): Promise<{ approvalId: string; status: string; result?: unknown }> {
    return request(`/api/admin/tool-approvals/${encodeURIComponent(id)}/approve`, {
      method: 'POST',
    });
  },
  reject(id: string): Promise<{ approvalId: string; status: string }> {
    return request(`/api/admin/tool-approvals/${encodeURIComponent(id)}/reject`, {
      method: 'POST',
    });
  },
};

/* ---------- Runtime Templates(治本 D8 后端侧,T6,只读) ---------- */

export interface SandboxTemplateDef {
  name: string;
  description: string;
  cpu: string;
  memory: string;
  networkMode: 'bridge' | 'host' | 'none';
  highPrivilege: boolean;
}

export interface RuntimeTypeEntry {
  runtimeType: string;
  framework: string;
}

export const runtimeTemplatesApi = {
  listSandboxTemplates(): Promise<{ items: SandboxTemplateDef[] }> {
    return request('/api/admin/runtime-templates/sandbox-templates');
  },
  listRuntimeTypes(): Promise<{ items: RuntimeTypeEntry[] }> {
    return request('/api/admin/runtime-templates/runtime-types');
  },
  getSummary(): Promise<{ builtIn: number; default: string }> {
    return request('/api/admin/runtime-templates/sandbox-templates-summary');
  },
};

/* ---------- Feature Flags(#13 灰度,T5) ---------- */

export interface FeatureFlagConfig {
  enabled: boolean;
  rolloutPct?: number;
  allowedTenants?: string[];
  killSwitch?: boolean;
}

export const featureFlagApi = {
  list(): Promise<{ flags: Record<string, FeatureFlagConfig> }> {
    return request('/api/admin/feature-flags');
  },
  set(key: string, config: FeatureFlagConfig): Promise<{ key: string; flag: FeatureFlagConfig }> {
    return request(`/api/admin/feature-flags/${encodeURIComponent(key)}`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },
};

/* ---------- Runtime Manifests(v2.0 编译固化,C12) ---------- */

export interface CompiledTool {
  toolId: string;
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface RuntimeManifestView {
  id: string;
  agentDefinitionId: string;
  generation: number;
  bakedAt: number;
  status: string;
  compiledSystemPrompt: string;
  compiledGuardrails: unknown[];
  compiledTools: CompiledTool[];
  compiledSkillsContext: string;
  runtimeRoute: string;
  sandboxStrategy: string;
  errorMsg: string | null;
}

export interface BakeResult {
  manifestId: string;
  status: 'baked' | 'failed';
  errorMsg: string | null;
}

export const runtimeManifestApi = {
  /** 触发 bake(同步固化,返回终态 baked|failed + manifestId) */
  bake(agentDefinitionId: string): Promise<BakeResult> {
    return request(`/api/admin/runtime-manifests/${encodeURIComponent(agentDefinitionId)}/bake`, {
      method: 'POST',
    });
  },
  /** 某定义全部 manifest(generation 倒序) */
  listByDefinition(
    agentDefinitionId: string,
    limit?: number
  ): Promise<{ items: RuntimeManifestView[]; total: number; limit: number }> {
    const qs = limit ? `?limit=${limit}` : '';
    return request(`/api/admin/runtime-manifests/${encodeURIComponent(agentDefinitionId)}${qs}`);
  },
  /** 精确查某版本 manifest */
  get(agentDefinitionId: string, generation: number): Promise<RuntimeManifestView> {
    return request(
      `/api/admin/runtime-manifests/${encodeURIComponent(agentDefinitionId)}/${generation}`
    );
  },
};
