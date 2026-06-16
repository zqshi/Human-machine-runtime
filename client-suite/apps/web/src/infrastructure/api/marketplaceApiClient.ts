/**
 * Marketplace API Client
 *
 * Wraps the /api/control/marketplace/* endpoints for the "共享" (Share) feature.
 */

import { handleSessionExpired } from './sessionHandler';

class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public body?: unknown
  ) {
    super(`API ${status}: ${statusText}`);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 3_000);
  try {
    const res = await fetch(path, {
      credentials: 'include',
      signal: controller.signal,
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    });
    if (res.status === 401) {
      handleSessionExpired();
      throw new ApiError(401, 'Session expired');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => undefined);
      throw new ApiError(res.status, res.statusText, body);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as T);
  } finally {
    clearTimeout(timeoutId);
  }
}

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
