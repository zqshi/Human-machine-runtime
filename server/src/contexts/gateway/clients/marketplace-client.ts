import { createHmac } from 'node:crypto';
import { BaseGatewayClient, type RequestOptions, type TimeoutProfile } from './base-client.js';
import { config } from '../../../config/index.js';

/* ──── Interfaces ──── */

export interface HubSkill {
  id: string;
  slug: string;
  name: string;
  description?: string;
  authorId: string;
  status: string;
  version?: string;
  downloads?: number;
  stars?: number;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface HubAgent {
  id: string;
  slug: string;
  name: string;
  description?: string;
  authorId: string;
  status: string;
  version?: string;
  createdAt: string;
  updatedAt: string;
}

export interface HubComment {
  id: string;
  targetType: string;
  targetId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface HubShare {
  id: string;
  resourceType: string;
  resourceId: string;
  sharedBy: string;
  sharedWith?: string;
  accessLevel: string;
  createdAt: string;
}

export interface McpToolGroup {
  id: string;
  name: string;
  description?: string;
  toolCount: number;
}

export interface McpTool {
  id: string;
  groupId: string;
  name: string;
  description?: string;
  schema?: Record<string, unknown>;
  status: string;
}

/* ──── Pagination helper ──── */

interface PaginationParams {
  page?: number;
  pageSize?: number;
}

function appendPagination(query: URLSearchParams, params?: PaginationParams): void {
  if (params?.page) query.set('page', String(params.page));
  if (params?.pageSize) query.set('pageSize', String(params.pageSize));
}

/* ──── Client ──── */

export class MarketplaceClient extends BaseGatewayClient {
  /* ──── HMAC Auth Override ──── */

  protected override async request<T = unknown>(
    path: string,
    opts: RequestOptions & { timeoutProfile?: TimeoutProfile } = {}
  ): Promise<T> {
    this.injectHmac(opts, path);
    return super.request<T>(path, opts);
  }

  protected override async requestRaw(
    path: string,
    opts: RequestOptions & { timeoutProfile?: TimeoutProfile } = {}
  ): Promise<Response> {
    this.injectHmac(opts, path);
    return super.requestRaw(path, opts);
  }

  private injectHmac(opts: RequestOptions, path: string): void {
    const secret = config.gateway.marketplaceHmacSecret;
    if (!secret) return;

    const timestamp = String(Math.floor(Date.now() / 1000));
    const payload = opts.body ? JSON.stringify(opts.body) : '';
    const signature = createHmac('sha256', secret)
      .update(`${timestamp}\n${path}\n${payload}`)
      .digest('hex');

    opts.headers = {
      ...opts.headers,
      'X-Marketplace-Timestamp': timestamp,
      'X-Marketplace-Signature': `sha256=${signature}`,
    };
  }

  /* ──── Skills ──── */

  async listSkills(
    params: PaginationParams & { keyword?: string; status?: string; authorId?: string } = {},
    authToken?: string
  ) {
    const query = new URLSearchParams();
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.status) query.set('status', params.status);
    if (params.authorId) query.set('authorId', params.authorId);
    appendPagination(query, params);
    const qs = query.toString();
    return this.request<{ skills: HubSkill[]; total: number }>(
      `/api/v1/skills${qs ? `?${qs}` : ''}`,
      { authToken }
    );
  }

  async getSkill(skillId: string, authToken?: string) {
    return this.request<HubSkill>(`/api/v1/skills/${skillId}`, { authToken });
  }

  async createSkill(
    data: { name: string; slug: string; description?: string; tags?: string[] },
    authToken?: string
  ) {
    return this.request<HubSkill>('/api/v1/skills', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async updateSkill(skillId: string, data: Partial<HubSkill>, authToken?: string) {
    return this.request<HubSkill>(`/api/v1/skills/${skillId}`, {
      method: 'PUT',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async deleteSkill(skillId: string, authToken?: string) {
    return this.request(`/api/v1/skills/${skillId}`, {
      method: 'DELETE',
      authToken,
      timeoutProfile: 'write',
    });
  }

  async searchSkills(keyword: string, params?: PaginationParams, authToken?: string) {
    const query = new URLSearchParams({ keyword });
    appendPagination(query, params);
    return this.request<{ skills: HubSkill[]; total: number }>(
      `/api/v1/skills/search?${query.toString()}`,
      { authToken }
    );
  }

  async publishSkill(
    slug: string,
    data: { files?: Record<string, string>; version?: string; changelog?: string },
    authToken?: string
  ) {
    return this.request(`/api/v1/skills/${slug}/publish`, {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async moderateSkill(
    skillId: string,
    action: 'approve' | 'reject',
    note?: string,
    authToken?: string
  ) {
    return this.request(`/api/v1/skills/${skillId}/moderate`, {
      method: 'POST',
      body: { action, note },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async downloadSkill(skillId: string, version?: string, authToken?: string) {
    const query = version ? `?version=${encodeURIComponent(version)}` : '';
    return this.request(`/api/v1/skills/${skillId}/download${query}`, { authToken });
  }

  async getSkillStats(skillId: string, authToken?: string) {
    return this.request(`/api/v1/skills/${skillId}/stats`, { authToken });
  }

  async getSkillDailyStats(skillId: string, params?: { days?: number }, authToken?: string) {
    const query = params?.days ? `?days=${params.days}` : '';
    return this.request(`/api/v1/skills/${skillId}/stats/daily${query}`, { authToken });
  }

  async listSkillVersions(skillId: string, authToken?: string) {
    return this.request(`/api/v1/skills/${skillId}/versions`, { authToken });
  }

  async getSkillLeaderboard(category: string, period: string, authToken?: string) {
    return this.request(
      `/api/v1/skills/leaderboard?category=${encodeURIComponent(category)}&period=${encodeURIComponent(period)}`,
      { authToken }
    );
  }

  /* ──── Agents ──── */

  async listAgents(
    params: PaginationParams & { keyword?: string; status?: string } = {},
    authToken?: string
  ) {
    const query = new URLSearchParams();
    if (params.keyword) query.set('keyword', params.keyword);
    if (params.status) query.set('status', params.status);
    appendPagination(query, params);
    const qs = query.toString();
    return this.request<{ agents: HubAgent[]; total: number }>(
      `/api/v1/agents${qs ? `?${qs}` : ''}`,
      { authToken }
    );
  }

  async getAgent(agentId: string, authToken?: string) {
    return this.request<HubAgent>(`/api/v1/agents/${agentId}`, { authToken });
  }

  async createAgent(
    data: { name: string; slug: string; description?: string },
    authToken?: string
  ) {
    return this.request<HubAgent>('/api/v1/agents', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async updateAgent(agentId: string, data: Partial<HubAgent>, authToken?: string) {
    return this.request<HubAgent>(`/api/v1/agents/${agentId}`, {
      method: 'PUT',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async deleteAgent(agentId: string, authToken?: string) {
    return this.request(`/api/v1/agents/${agentId}`, {
      method: 'DELETE',
      authToken,
      timeoutProfile: 'write',
    });
  }

  async listAgentVersions(agentId: string, authToken?: string) {
    return this.request(`/api/v1/agents/${agentId}/versions`, { authToken });
  }

  async publishAgent(agentId: string, data?: { version?: string }, authToken?: string) {
    return this.request(`/api/v1/agents/${agentId}/publish`, {
      method: 'POST',
      body: data ?? {},
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Comments ──── */

  async listComments(
    targetType: string,
    targetId: string,
    params?: PaginationParams,
    authToken?: string
  ) {
    const query = new URLSearchParams({ targetType, targetId });
    appendPagination(query, params);
    return this.request<{ comments: HubComment[]; total: number }>(
      `/api/v1/comments?${query.toString()}`,
      { authToken }
    );
  }

  async createComment(
    data: { targetType: string; targetId: string; content: string },
    authToken?: string
  ) {
    return this.request<HubComment>('/api/v1/comments', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async updateComment(commentId: string, content: string, authToken?: string) {
    return this.request<HubComment>(`/api/v1/comments/${commentId}`, {
      method: 'PUT',
      body: { content },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async deleteComment(commentId: string, authToken?: string) {
    return this.request(`/api/v1/comments/${commentId}`, {
      method: 'DELETE',
      authToken,
      timeoutProfile: 'write',
    });
  }

  async reportComment(commentId: string, reason: string, authToken?: string) {
    return this.request(`/api/v1/comments/${commentId}/report`, {
      method: 'POST',
      body: { reason },
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Stars ──── */

  async toggleStar(targetType: string, targetId: string, authToken?: string) {
    return this.request<{ starred: boolean }>('/api/v1/stars', {
      method: 'POST',
      body: { targetType, targetId },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async listStarred(
    userId: string,
    params?: PaginationParams & { targetType?: string },
    authToken?: string
  ) {
    const query = new URLSearchParams({ userId });
    if (params?.targetType) query.set('targetType', params.targetType);
    appendPagination(query, params);
    return this.request(`/api/v1/stars?${query.toString()}`, { authToken });
  }

  /* ──── Shares ──── */

  async createShare(
    data: { resourceType: string; resourceId: string; sharedWith?: string; accessLevel?: string },
    authToken?: string
  ) {
    return this.request<HubShare>('/api/v1/shares', {
      method: 'POST',
      body: data,
      authToken,
      timeoutProfile: 'write',
    });
  }

  async listShares(resourceType: string, resourceId: string, authToken?: string) {
    return this.request<{ shares: HubShare[] }>(
      `/api/v1/shares?resourceType=${encodeURIComponent(resourceType)}&resourceId=${encodeURIComponent(resourceId)}`,
      { authToken }
    );
  }

  async revokeShare(shareId: string, authToken?: string) {
    return this.request(`/api/v1/shares/${shareId}`, {
      method: 'DELETE',
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── MCP Tools ──── */

  async listMcpGroups(authToken?: string) {
    return this.request<{ groups: McpToolGroup[] }>('/api/v1/mcp/groups', { authToken });
  }

  async listMcpTools(groupId: string, authToken?: string) {
    return this.request<{ tools: McpTool[] }>(`/api/v1/mcp/groups/${groupId}/tools`, {
      authToken,
    });
  }

  async syncMcpTools(groupId: string, authToken?: string) {
    return this.request(`/api/v1/mcp/groups/${groupId}/sync`, {
      method: 'POST',
      authToken,
      timeoutProfile: 'write',
    });
  }

  /* ──── Users ──── */

  async getUserProfile(userId: string, authToken?: string) {
    return this.request(`/api/v1/users/${userId}/profile`, { authToken });
  }

  async syncUserRoots(userId: string, authToken?: string) {
    return this.request(`/api/v1/users/${userId}/sync-roots`, {
      method: 'POST',
      authToken,
      timeoutProfile: 'write',
    });
  }

  async listUserInstalls(userId: string, params?: PaginationParams, authToken?: string) {
    const query = new URLSearchParams();
    appendPagination(query, params);
    const qs = query.toString();
    return this.request(`/api/v1/users/${userId}/installs${qs ? `?${qs}` : ''}`, { authToken });
  }

  /* ──── Admin ──── */

  async adminListUsers(params: PaginationParams = {}, authToken?: string) {
    const query = new URLSearchParams();
    appendPagination(query, params);
    const qs = query.toString();
    return this.request(`/api/v1/admin/users${qs ? `?${qs}` : ''}`, { authToken });
  }

  async adminModerationQueue(params?: PaginationParams & { type?: string }, authToken?: string) {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    appendPagination(query, params);
    return this.request(`/api/v1/admin/moderation?${query.toString()}`, { authToken });
  }

  async adminAuditLogs(
    params?: PaginationParams & { action?: string; userId?: string; since?: string },
    authToken?: string
  ) {
    const query = new URLSearchParams();
    if (params?.action) query.set('action', params.action);
    if (params?.userId) query.set('userId', params.userId);
    if (params?.since) query.set('since', params.since);
    appendPagination(query, params);
    return this.request(`/api/v1/admin/audit-logs?${query.toString()}`, { authToken });
  }

  async adminGlobalStats(authToken?: string) {
    return this.request('/api/v1/admin/stats', { authToken });
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
