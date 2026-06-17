/**
 * OpenClaw Workspace API Client
 *
 * Wraps the /api/openclaw/workspace/* endpoints for the "造" (Build) feature.
 * 底层 request 由统一 httpClient 工厂提供。
 */

import { request } from './httpClient';

// ─── Types ─────────────────────────────────────────────────────────

export interface WorkspaceDTO {
  id: string;
  name: string;
  type: 'APP' | 'SKILL' | 'NORMAL' | 'AGENT';
  ownerId: string;
  tenantId: string;
  description: string;
  status: 'active' | 'archived';
  sourceChannel?: string;
  sourceConversationId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceConversationDTO {
  id: string;
  workspaceId: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  messageCount: number;
}

export interface WorkspaceAppDTO {
  id: string;
  workspaceId: string;
  name: string;
  description: string;
  status: string;
  deployUrl?: string;
}

export interface XspaceAgentDTO {
  id: string;
  name: string;
  description?: string;
  userId: string;
  workspaceId?: string;
  model?: string;
  status: string;
}

// ─── API ───────────────────────────────────────────────────────────

export const workspaceApi = {
  list(): Promise<{ workspaces: WorkspaceDTO[]; total: number }> {
    return request('/api/openclaw/workspace/list');
  },

  get(id: string): Promise<WorkspaceDTO> {
    return request(`/api/openclaw/workspace/${encodeURIComponent(id)}`);
  },

  getStatus(id: string): Promise<{ id: string; status: string; updatedAt: string }> {
    return request(`/api/openclaw/workspace/${encodeURIComponent(id)}/status`);
  },

  create(data: {
    name: string;
    type: WorkspaceDTO['type'];
    description?: string;
  }): Promise<WorkspaceDTO> {
    return request('/api/openclaw/workspace/create', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  createFromChat(data: {
    channelType: string;
    conversationId: string;
    prompt: string;
    type?: WorkspaceDTO['type'];
  }): Promise<WorkspaceDTO> {
    return request('/api/openclaw/workspace/create-from-chat', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async generateStream(
    workspaceId: string,
    prompt: string,
    options?: { model?: string; conversationId?: string; agentId?: string }
  ): Promise<Response> {
    return fetch(`/api/openclaw/workspace/${encodeURIComponent(workspaceId)}/generate`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
      body: JSON.stringify({ prompt, ...options }),
    });
  },

  listConversations(
    workspaceId: string
  ): Promise<{ conversations: WorkspaceConversationDTO[]; total: number }> {
    return request(`/api/openclaw/workspace/${encodeURIComponent(workspaceId)}/conversations`);
  },

  listApps(workspaceId: string): Promise<{ apps: WorkspaceAppDTO[]; total: number }> {
    return request(`/api/openclaw/workspace/${encodeURIComponent(workspaceId)}/apps`);
  },

  deployApp(
    workspaceId: string,
    appId: string
  ): Promise<{ success: boolean; deployment: unknown }> {
    return request(
      `/api/openclaw/workspace/${encodeURIComponent(workspaceId)}/apps/${encodeURIComponent(appId)}/deploy`,
      { method: 'POST' }
    );
  },

  installSkill(
    workspaceId: string,
    skillId: string
  ): Promise<{ success: boolean; result: unknown }> {
    return request(`/api/openclaw/workspace/${encodeURIComponent(workspaceId)}/skills`, {
      method: 'POST',
      body: JSON.stringify({ skillId }),
    });
  },

  listAgents(): Promise<{ agents: XspaceAgentDTO[]; total: number }> {
    return request('/api/openclaw/agents');
  },
};
