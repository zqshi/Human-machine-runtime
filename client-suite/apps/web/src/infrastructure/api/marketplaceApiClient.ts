/**
 * Marketplace API Client
 *
 * Wraps the /api/control/marketplace/* endpoints for the "共享" (Share) feature.
 * 底层 request 由统一 httpClient 工厂提供。
 */

import { request } from './httpClient';

// ─── Types ─────────────────────────────────────────────────────────

export interface MarketplaceSkillDTO {
  id: string;
  name: string;
  slug?: string;
  description?: string;
  version?: string;
  author?: string;
  category?: string;
  downloads?: number;
  rating?: number;
  source?: string;
  [key: string]: unknown;
}

export interface MarketplaceAgentDTO {
  id: string;
  name: string;
  description?: string;
  version?: string;
  author?: string;
  capabilities?: string[];
  [key: string]: unknown;
}

export interface PublishApprovalDTO {
  id: string;
  skillSlug: string;
  tenantId: string;
  actor: string;
  version?: string;
  status: 'pending' | 'approved' | 'rejected';
  reviewedBy?: string;
  reviewNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

// ─── API ───────────────────────────────────────────────────────────

export const marketplaceApi = {
  listSkills(params?: {
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ success: boolean; data: unknown }> {
    const qs = new URLSearchParams();
    if (params?.keyword) qs.set('keyword', params.keyword);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return request(`/api/control/marketplace/skills${q ? `?${q}` : ''}`);
  },

  getSkill(id: string): Promise<{ success: boolean; data: MarketplaceSkillDTO }> {
    return request(`/api/control/marketplace/skills/${encodeURIComponent(id)}`);
  },

  getSkillStats(id: string): Promise<{ success: boolean; data: unknown }> {
    return request(`/api/control/marketplace/skills/${encodeURIComponent(id)}/stats`);
  },

  installSkill(skillId: string, version?: string): Promise<{ success: boolean; data: unknown }> {
    return request('/api/control/marketplace/skills/install', {
      method: 'POST',
      body: JSON.stringify({ skillId, version }),
    });
  },

  requestPublish(data: {
    skillSlug: string;
    version?: string;
    changelog?: string;
  }): Promise<{ success: boolean; data: PublishApprovalDTO | unknown }> {
    return request('/api/control/marketplace/skills/publish', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listApprovals(): Promise<{ success: boolean; data: PublishApprovalDTO[]; total: number }> {
    return request('/api/control/marketplace/approvals');
  },

  approve(id: string): Promise<{ success: boolean; data: PublishApprovalDTO }> {
    return request(`/api/control/marketplace/approve/${encodeURIComponent(id)}`, {
      method: 'POST',
    });
  },

  reject(id: string, reason?: string): Promise<{ success: boolean; data: PublishApprovalDTO }> {
    return request(`/api/control/marketplace/reject/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  listAgents(params?: {
    keyword?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ success: boolean; data: unknown }> {
    const qs = new URLSearchParams();
    if (params?.keyword) qs.set('keyword', params.keyword);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return request(`/api/control/marketplace/agents${q ? `?${q}` : ''}`);
  },

  getAgent(id: string): Promise<{ success: boolean; data: MarketplaceAgentDTO }> {
    return request(`/api/control/marketplace/agents/${encodeURIComponent(id)}`);
  },

  /** T20b-A:安装市场 Agent 为可运行实例(后端落 AgentDefinition + createInstance),返回 instanceId */
  installAgent(agentId: string): Promise<{
    success: boolean;
    data: { agentDefinitionId: string; instanceId: string; name: string };
  }> {
    return request('/api/control/marketplace/agents/install', {
      method: 'POST',
      body: JSON.stringify({ agentId }),
    });
  },

  getModerationQueue(params?: {
    type?: string;
    page?: number;
    pageSize?: number;
  }): Promise<{ success: boolean; data: unknown }> {
    const qs = new URLSearchParams();
    if (params?.type) qs.set('type', params.type);
    if (params?.page) qs.set('page', String(params.page));
    if (params?.pageSize) qs.set('pageSize', String(params.pageSize));
    const q = qs.toString();
    return request(`/api/control/marketplace/moderation${q ? `?${q}` : ''}`);
  },
};
