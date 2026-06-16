import { ApiError } from './dcfApiClient';

async function request<T>(path: string, init?: RequestInit, timeoutMs = 8_000): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () =>
      controller.abort(new DOMException(`Upstream timeout after ${timeoutMs}ms`, 'TimeoutError')),
    timeoutMs
  );
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

export const clawHubApi = {
  listSkills(q?: string): Promise<{ items: SkillItem[]; source: string }> {
    const qs = q ? `?q=${encodeURIComponent(q)}` : '';
    return request(`/api/proxy/clawhub/skills${qs}`);
  },

  getSkill(id: string): Promise<SkillItem> {
    return request(`/api/proxy/clawhub/skills/${encodeURIComponent(id)}`);
  },

  listAgents(): Promise<{ items: AgentItem[] }> {
    return request('/api/proxy/clawhub/agents');
  },

  listMcpTools(): Promise<{ tools: Record<string, unknown>[] }> {
    return request('/api/proxy/clawhub/mcp-tools');
  },

  search(q: string): Promise<{ results: Record<string, unknown>[] }> {
    return request(`/api/proxy/clawhub/search?q=${encodeURIComponent(q)}`);
  },
};

export const portalApi = {
  getProfile(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/portal/profile/${encodeURIComponent(userId)}`);
  },

  getJourney(userId: string): Promise<{ entries: Record<string, unknown>[] }> {
    return request(`/api/proxy/portal/journey/${encodeURIComponent(userId)}`);
  },

  getSettings(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/portal/settings/${encodeURIComponent(userId)}`);
  },

  updateSettings(userId: string, data: object): Promise<Record<string, unknown>> {
    return request(`/api/proxy/portal/settings/${encodeURIComponent(userId)}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
};

export const farmApi = {
  getProvisionStatus(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/farm/provision-status/${encodeURIComponent(userId)}`);
  },

  getRuntimeStatus(userId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/farm/runtime-status/${encodeURIComponent(userId)}`);
  },

  resetUser(userId: string): Promise<Record<string, unknown>> {
    return request('/api/proxy/farm/reset-user', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  newWorkspace(data: object): Promise<Record<string, unknown>> {
    return request('/api/proxy/farm/new-workspace', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  sendMessage(data: object): Promise<Record<string, unknown>> {
    return request('/api/proxy/farm/send-message', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  getDocContent(url: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/farm/doc-content?url=${encodeURIComponent(url)}`);
  },
};

export const xspaceApi = {
  listWorkspaces(): Promise<{ workspaces: Record<string, unknown>[] }> {
    return request('/api/proxy/xspace/workspaces');
  },

  createWorkspace(data: object): Promise<Record<string, unknown>> {
    return request('/api/proxy/xspace/workspaces', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  listConversations(workspaceId: string): Promise<{ conversations: Record<string, unknown>[] }> {
    return request(
      `/api/proxy/xspace/conversations?workspaceId=${encodeURIComponent(workspaceId)}`
    );
  },

  listApps(): Promise<{ apps: Record<string, unknown>[] }> {
    return request('/api/proxy/xspace/apps');
  },

  deployApp(appId: string): Promise<Record<string, unknown>> {
    return request(`/api/proxy/xspace/apps/${encodeURIComponent(appId)}/deploy`, {
      method: 'POST',
    });
  },

  generateStream(data: { workspaceId: string; prompt: string; model?: string }): string {
    const params = new URLSearchParams();
    params.set('workspaceId', data.workspaceId);
    params.set('prompt', data.prompt);
    if (data.model) params.set('model', data.model);
    return `/api/proxy/xspace/generate?${params.toString()}`;
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
