import { BaseGatewayClient } from './base-client.js';

/* ──── Interfaces ──── */

export interface AgentProfile {
  id: string;
  agentId: string;
  name: string;
  avatar?: string;
  bio?: string;
  voice?: string;
  locale?: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface AgentSettings {
  agentId: string;
  avatar?: string;
  name?: string;
  voice?: string;
  locale?: string;
  timezone?: string;
  notificationsEnabled?: boolean;
  [key: string]: unknown;
}

export interface BlogEntry {
  id: string;
  agentId: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityRecord {
  id: string;
  agentId: string;
  type: string;
  description?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

function appendPagination(query: URLSearchParams, params?: PaginationParams): void {
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
}

/**
 * portal-backend uses `/api/portal/*` session-based routes — no agentId in path.
 * Agent identity determined by auth token / session cookie.
 * Paths verified against ks-claw/service/portal-backend/src/routes/.
 */
export class PortalClient extends BaseGatewayClient {
  /* ──── Profile ──── */

  async getAgentProfile(_agentId: string, authToken?: string) {
    return this.request<AgentProfile>('/api/portal/profile', { authToken });
  }

  async updateAgentProfile(
    _agentId: string,
    data: Partial<Pick<AgentProfile, 'name' | 'avatar' | 'bio' | 'voice' | 'locale' | 'metadata'>>,
    authToken?: string
  ) {
    return this.request<AgentProfile>('/api/portal/profile', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Settings ──── */

  async getAgentSettings(_agentId: string, authToken?: string) {
    return this.request<AgentSettings>('/api/portal/settings', { authToken });
  }

  async updateAgentSettings(_agentId: string, data: Partial<AgentSettings>, authToken?: string) {
    return this.request<AgentSettings>('/api/portal/settings', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Journey & Blog ──── */

  async getAgentJourney(_agentId: string, authToken?: string) {
    return this.request('/api/portal/journey', { authToken });
  }

  async listBlogEntries(_agentId: string, params?: PaginationParams, authToken?: string) {
    const query = new URLSearchParams();
    appendPagination(query, params);
    const qs = query.toString();
    return this.request<{ entries: BlogEntry[]; total: number }>(
      `/api/portal/blog${qs ? `?${qs}` : ''}`,
      { authToken }
    );
  }

  async createBlogEntry(
    _agentId: string,
    data: { title: string; content: string },
    authToken?: string
  ) {
    return this.request<BlogEntry>('/api/portal/blog', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Activity ──── */

  async listActivity(
    _agentId: string,
    params?: PaginationParams & { type?: string; since?: string },
    authToken?: string
  ) {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.since) query.set('since', params.since);
    appendPagination(query, params);
    return this.request<{ activities: ActivityRecord[]; total: number }>(
      `/api/portal/activity?${query.toString()}`,
      { authToken }
    );
  }

  async getActivityAggregate(_agentId: string, period?: string, authToken?: string) {
    const query = period ? `?period=${encodeURIComponent(period)}` : '';
    return this.request(`/api/portal/activity/aggregate${query}`, { authToken });
  }

  /* ──── Usage ──── */

  async getUsageSummary(_agentId: string, period?: string, authToken?: string) {
    const query = period ? `?period=${period}` : '';
    return this.request(`/api/portal/usage${query}`, { authToken });
  }

  /* ──── Skills ──── */

  async listSkills(authToken?: string) {
    return this.request('/api/portal/skills', { authToken });
  }

  /* ──── Health ──── */

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await this.request('/healthz', { skipRetry: true });
      return true;
    } catch {
      return false;
    }
  }
}
