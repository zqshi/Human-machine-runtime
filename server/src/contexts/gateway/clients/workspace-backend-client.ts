import { BaseGatewayClient } from './base-client.js';

/* ──── Interfaces ──── */

export interface XspaceWorkspace {
  id: string;
  name: string;
  type: string;
  userId: string;
  model?: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface XspaceApp {
  id: string;
  workspaceId: string;
  name: string;
  type: string;
  status: string;
  deploymentId?: string;
  createdAt: string;
}

export interface XspaceConversation {
  id: string;
  workspaceId: string;
  title?: string;
  agentId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface XspaceAgent {
  id: string;
  name: string;
  description?: string;
  userId: string;
  workspaceId?: string;
  model?: string;
  status: string;
  createdAt: string;
}

export interface XspaceDeployment {
  id: string;
  appId: string;
  status: string;
  url?: string;
  createdAt: string;
  updatedAt: string;
}

export interface XspaceSupabaseAuth {
  url: string;
  anonKey: string;
  email: string;
  password: string;
}

/**
 * xspace uses `/xspace/api/v1/` prefix.
 * - Singular form for single-resource paths (`/workspace/{id}`, `/agent/{id}`)
 * - Plural for collection list (`/workspaces`, `/agents`)
 * - PATCH for updates (not PUT)
 * - Flat routes for apps/conversations (not nested under workspace)
 * Paths verified against xspace FastAPI router.
 */
export class XspaceClient extends BaseGatewayClient {
  private supabaseAuth: XspaceSupabaseAuth | null = null;
  private cachedToken: string | null = null;
  private tokenExpiresAt = 0;

  setSupabaseAuth(auth: XspaceSupabaseAuth): void {
    this.supabaseAuth = auth;
  }

  private async acquireToken(): Promise<string | undefined> {
    if (!this.supabaseAuth) return undefined;
    if (this.cachedToken && Date.now() < this.tokenExpiresAt) {
      return this.cachedToken;
    }
    try {
      const res = await fetch(`${this.supabaseAuth.url}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: this.supabaseAuth.anonKey,
        },
        body: JSON.stringify({
          email: this.supabaseAuth.email,
          password: this.supabaseAuth.password,
        }),
      });
      if (!res.ok) return undefined;
      const data = (await res.json()) as { access_token: string; expires_in: number };
      this.cachedToken = data.access_token;
      this.tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;
      return this.cachedToken;
    } catch {
      return undefined;
    }
  }

  private async resolveAuthToken(explicit?: string): Promise<string | undefined> {
    if (explicit) return explicit;
    return this.acquireToken();
  }
  /* ──── Workspaces ──── */

  async listWorkspaces(params: { userId?: string; type?: string } = {}, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    const query = new URLSearchParams();
    if (params.userId) query.set('userId', params.userId);
    if (params.type) query.set('type', params.type);
    const qs = query.toString();
    return this.request<{ workspaces: XspaceWorkspace[] }>(
      `/xspace/api/v1/workspaces${qs ? `?${qs}` : ''}`,
      { authToken: token }
    );
  }

  async createWorkspace(
    data: { name: string; type: string; userId: string; model?: string },
    authToken?: string
  ) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceWorkspace>('/xspace/api/v1/workspace', {
      method: 'POST',
      body: data,
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async getWorkspace(workspaceId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceWorkspace>(`/xspace/api/v1/workspace/${workspaceId}`, {
      authToken: token,
    });
  }

  async updateWorkspace(
    workspaceId: string,
    data: Partial<Pick<XspaceWorkspace, 'name' | 'model'>>,
    authToken?: string
  ) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceWorkspace>(`/xspace/api/v1/workspace/${workspaceId}`, {
      method: 'PATCH',
      body: data,
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async deleteWorkspace(workspaceId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/workspace/${workspaceId}`, {
      method: 'DELETE',
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async updateWorkspaceModel(workspaceId: string, model: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/workspace/${workspaceId}`, {
      method: 'PATCH',
      body: { model },
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async addWorkspaceSkill(workspaceId: string, skillId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/workspace/${workspaceId}/skill`, {
      method: 'POST',
      body: { skillId },
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async removeWorkspaceSkill(workspaceId: string, skillId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/workspace/${workspaceId}/skill/${skillId}`, {
      method: 'DELETE',
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async listWorkspaceSkills(workspaceId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/workspace/${workspaceId}/skills`, { authToken: token });
  }

  /* ──── Apps (flat routes) ──── */

  async listApps(workspaceId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<{ apps: XspaceApp[] }>(
      `/xspace/api/v1/apps?workspaceId=${encodeURIComponent(workspaceId)}`,
      { authToken: token }
    );
  }

  async createApp(workspaceId: string, data: { name: string; type: string }, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceApp>('/xspace/api/v1/app', {
      method: 'POST',
      body: { ...data, workspaceId },
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async getApp(_workspaceId: string, appId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceApp>(`/xspace/api/v1/app/${appId}`, { authToken: token });
  }

  async updateApp(
    _workspaceId: string,
    appId: string,
    data: Partial<Pick<XspaceApp, 'name' | 'type'>>,
    authToken?: string
  ) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceApp>(`/xspace/api/v1/app/${appId}`, {
      method: 'PATCH',
      body: data,
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async deleteApp(_workspaceId: string, appId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/app/${appId}`, {
      method: 'DELETE',
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async deployApp(_workspaceId: string, appId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceDeployment>(`/xspace/api/v1/app/${appId}/deploy`, {
      method: 'POST',
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async getDeploymentStatus(deploymentId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceDeployment>(`/xspace/api/v1/deployment/${deploymentId}`, {
      authToken: token,
    });
  }

  async previewApp(_workspaceId: string, appId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/app/${appId}/preview`, { authToken: token });
  }

  /* ──── Conversations (flat routes) ──── */

  async listConversations(workspaceId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<{ conversations: XspaceConversation[] }>(
      `/xspace/api/v1/conversations?workspaceId=${encodeURIComponent(workspaceId)}`,
      { authToken: token }
    );
  }

  async createConversation(
    workspaceId: string,
    data?: { title?: string; agentId?: string },
    authToken?: string
  ) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceConversation>('/xspace/api/v1/conversation', {
      method: 'POST',
      body: { ...data, workspaceId },
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async getConversation(_workspaceId: string, conversationId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceConversation>(`/xspace/api/v1/conversation/${conversationId}`, {
      authToken: token,
    });
  }

  async deleteConversation(_workspaceId: string, conversationId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/conversation/${conversationId}`, {
      method: 'DELETE',
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async updateConversationTitle(
    _workspaceId: string,
    conversationId: string,
    title: string,
    authToken?: string
  ) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/conversation/${conversationId}`, {
      method: 'PATCH',
      body: { title },
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async sendMessage(
    _workspaceId: string,
    conversationId: string,
    message: { content: string; role?: string },
    authToken?: string
  ) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/conversation/${conversationId}/message`, {
      method: 'POST',
      body: message,
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  /* ──── Generate (production uses WebSocket; HTTP fallback kept) ──── */

  async generateStream(
    workspaceId: string,
    prompt: string,
    options?: { model?: string; conversationId?: string; agentId?: string },
    authToken?: string
  ): Promise<Response> {
    const token = await this.resolveAuthToken(authToken);
    return this.requestRaw(`/xspace/api/v1/workspace/${workspaceId}/generate`, {
      method: 'POST',
      body: { prompt, ...options },
      headers: { Accept: 'text/event-stream' },
      authToken: token,
      timeoutProfile: 'stream',
    });
  }

  /* ──── Agents ──── */

  async listAgents(params?: { userId?: string }, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    const query = params?.userId ? `?userId=${encodeURIComponent(params.userId)}` : '';
    return this.request<{ agents: XspaceAgent[] }>(`/xspace/api/v1/agents${query}`, {
      authToken: token,
    });
  }

  async getAgent(agentId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceAgent>(`/xspace/api/v1/agent/${agentId}`, { authToken: token });
  }

  async createAgent(
    data: { name: string; description?: string; model?: string; workspaceId?: string },
    authToken?: string
  ) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceAgent>('/xspace/api/v1/agent', {
      method: 'POST',
      body: data,
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async updateAgent(agentId: string, data: Partial<XspaceAgent>, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceAgent>(`/xspace/api/v1/agent/${agentId}`, {
      method: 'PATCH',
      body: data,
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async deleteAgent(agentId: string, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request(`/xspace/api/v1/agent/${agentId}`, {
      method: 'DELETE',
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  async createAgentConversation(agentId: string, data?: { title?: string }, authToken?: string) {
    const token = await this.resolveAuthToken(authToken);
    return this.request<XspaceConversation>(`/xspace/api/v1/agent/${agentId}/conversation`, {
      method: 'POST',
      body: data ?? {},
      authToken: token,
      timeoutProfile: 'write',
    });
  }

  /* ──── Common ──── */

  async uploadFile(formData: FormData, authToken?: string): Promise<Response> {
    return this.requestRaw('/xspace/api/v1/common/upload', {
      method: 'POST',
      body: formData as unknown,
      headers: { Accept: 'application/json' },
      authToken,
      timeoutProfile: 'write',
    });
  }

  async listAvailableModels(authToken?: string) {
    return this.request('/xspace/api/v1/models', { authToken });
  }

  /* ──── WebSocket ──── */

  getWebSocketUrl(): string {
    const wsBase = this.baseUrl.replace(/^http/, 'ws');
    return `${wsBase}/xspace/api/v1/ws`;
  }

  /* ──── Health ──── */

  async healthCheck(): Promise<boolean> {
    if (!this.isConfigured()) return false;
    try {
      await this.request('/xspace/api/v1/common/health', { skipRetry: true });
      return true;
    } catch {
      return false;
    }
  }
}
