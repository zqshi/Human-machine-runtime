import { request } from './httpClient';

export interface SkillItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  version?: string;
  status?: string;
  source?: string;
  [key: string]: unknown;
}

export interface AgentItem {
  id: string;
  name: string;
  description?: string;
  category?: string;
  status?: string;
  source?: string;
  [key: string]: unknown;
}

export const marketplaceApi = {
  listSkills(q?: string): Promise<{ items: SkillItem[]; source: string }> {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/proxy/marketplace/skills${qs}`);
  },

  getSkill(id: string): Promise<SkillItem> {
    return request(`/api/proxy/marketplace/skills/${encodeURIComponent(id)}`);
  },

  listAgents(): Promise<{ items: AgentItem[] }> {
    return request('/api/proxy/marketplace/agents');
  },

  listMcpTools(): Promise<{ tools: Record<string, unknown>[] }> {
    return request('/api/proxy/marketplace/mcp-tools');
  },

  search(q: string): Promise<{ results: Record<string, unknown>[] }> {
    return request(`/api/proxy/marketplace/search?q=${encodeURIComponent(q)}`);
  },
};

export const profileApi = {
  getProfile(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/profile/profile/${encodeURIComponent(userId)}`);
  },

  getJourney(userId: string): Promise<{ entries: Record<string, unknown>[] }> {
    return request(`/api/proxy/profile/journey/${encodeURIComponent(userId)}`);
  },

  getSettings(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/profile/settings/${encodeURIComponent(userId)}`);
  },

  updateSettings(userId: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/proxy/profile/settings/${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const channelApi = {
  getProvisionStatus(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/channel/provision-status/${encodeURIComponent(userId)}`);
  },

  getRuntimeStatus(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/channel/runtime-status/${encodeURIComponent(userId)}`);
  },

  resetUser(userId: string): Promise<Record<string, unknown>> {
    return request('/api/proxy/channel/reset-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  newWorkspace(data: object): Promise<Record<string, unknown>> {
    return request('/api/proxy/channel/new-workspace', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  sendMessage(data: object): Promise<Record<string, unknown>> {
    return request('/api/proxy/channel/send-message', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getDocContent(url: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/channel/doc-content?url=${encodeURIComponent(url)}`);
  },
};

export const workspaceApi = {
  listWorkspaces(): Promise<{ workspaces: Record<string, unknown>[] }> {
    return request('/api/proxy/workspace/workspaces');
  },

  createWorkspace(data: object): Promise<Record<string, unknown>> {
    return request('/api/proxy/workspace/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listConversations(workspaceId: string): Promise<{ conversations: Record<string, unknown>[] }> {
    return request(
      `/api/proxy/workspace/conversations?workspaceId=${encodeURIComponent(workspaceId)}`
    );
  },

  listApps(): Promise<{ apps: Record<string, unknown>[] }> {
    return request('/api/proxy/workspace/apps');
  },

  deployApp(appId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/workspace/apps/${encodeURIComponent(appId)}/deploy`, {
      method: 'POST',
    });
  },

  generateStream(data: { workspaceId: string; prompt: string; model?: string }): string {
    const params = new URLSearchParams();
    params.set('workspaceId', data.workspaceId);
    params.set('prompt', data.prompt);
    if (data.model) params.set('model', data.model);
    return `/api/proxy/workspace/generate?${params.toString()}`;
  },
};

export const mcpApi = {
  listTools(): Promise<{ tools: Record<string, unknown>[] }> {
    return request('/api/proxy/mcp/tools');
  },

  getToolSchema(toolName: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/mcp/tools/${encodeURIComponent(toolName)}`);
  },

  callTool(tool: string, args: object): Promise<Record<string, unknown>> {
    return request('/api/proxy/mcp/call', {
      method: 'POST',
      body: JSON.stringify({ tool, arguments: args }),
    });
  },
};
