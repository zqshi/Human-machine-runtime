import { config } from '../../config/index.js';
import { logger } from '../../app/logger.js';

/* ──── Types ──── */

export interface Mem0Memory {
  id: string;
  memory: string;
  user_id: string;
  categories?: string[];
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  score?: number;
}

export interface Mem0SearchResult {
  results: Mem0Memory[];
}

export interface Mem0AddParams {
  messages: Array<{ role: string; content: string }>;
  userId?: string;
  agentId?: string;
  orgId?: string;
  projectId?: string;
  appId?: string;
  metadata?: Record<string, unknown>;
  categories?: string[];
}

export interface Mem0SearchParams {
  query: string;
  userId?: string;
  agentId?: string;
  runId?: string;
  orgId?: string;
  projectId?: string;
  appId?: string;
  filters?: Record<string, unknown>;
  limit?: number;
}

/* ──── Client ──── */

export class Mem0Client {
  private apiKey: string;
  private baseUrl: string;
  private enabled: boolean;

  constructor() {
    this.apiKey = config.mem0.apiKey;
    this.baseUrl = config.mem0.baseUrl;
    this.enabled = config.mem0.enabled;
  }

  isEnabled(): boolean {
    return this.enabled && !!this.apiKey;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    if (!this.isEnabled()) {
      throw new Error('Mem0 is not configured');
    }

    const url = `${this.baseUrl}${path}`;
    const res = await fetch(url, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Token ${this.apiKey}`,
        ...init.headers,
      },
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      logger.warn({ status: res.status, body }, `[mem0] request failed: ${path}`);
      throw new Error(`Mem0 API error: ${res.status} ${res.statusText}`);
    }

    const text = await res.text();
    return text ? JSON.parse(text) : (undefined as T);
  }

  /* ──── Add (personal memory scoped to user + agent) ──── */

  async add(params: Mem0AddParams): Promise<{ results: Mem0Memory[] }> {
    const body: Record<string, unknown> = {
      messages: params.messages,
    };
    if (params.userId) body.user_id = params.userId;
    if (params.agentId) body.agent_id = params.agentId;
    if (params.orgId) body.org_id = params.orgId;
    if (params.projectId) body.project_id = params.projectId;
    if (params.appId) body.app_id = params.appId;
    if (params.metadata) body.metadata = params.metadata;
    if (params.categories) body.categories = params.categories;

    return this.request('/v1/memories', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /* ──── Add Shared (agent-level memory, no user_id) ──── */

  async addShared(params: Omit<Mem0AddParams, 'userId'>): Promise<{ results: Mem0Memory[] }> {
    const body: Record<string, unknown> = {
      messages: params.messages,
    };
    // Intentionally omit user_id — Mem0 treats this as agent-level shared memory
    if (params.agentId) body.agent_id = params.agentId;
    if (params.orgId) body.org_id = params.orgId;
    if (params.projectId) body.project_id = params.projectId;
    if (params.appId) body.app_id = params.appId;
    if (params.metadata) body.metadata = params.metadata;
    if (params.categories) body.categories = params.categories;

    return this.request('/v1/memories', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /* ──── Add Department-Shared (app-level, omits agent_id/user_id) ──── */

  async addDeptShared(params: {
    messages: Array<{ role: string; content: string }>;
    appId: string;
    orgId: string;
    projectId: string;
    metadata?: Record<string, unknown>;
    categories?: string[];
  }): Promise<{ results: Mem0Memory[] }> {
    const body: Record<string, unknown> = {
      messages: params.messages,
      // Intentionally omit agent_id and user_id — Mem0 treats this as
      // app-level shared memory, visible to every agent under this app (department).
      app_id: params.appId,
      org_id: params.orgId,
      project_id: params.projectId,
    };
    if (params.metadata) body.metadata = params.metadata;
    if (params.categories) body.categories = params.categories;

    return this.request('/v1/memories', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /* ──── Search ──── */

  async search(params: Mem0SearchParams): Promise<Mem0SearchResult> {
    const filters: Record<string, unknown> = { ...params.filters };
    if (params.userId) filters.user_id = params.userId;
    if (params.agentId) filters.agent_id = params.agentId;
    if (params.runId) filters.run_id = params.runId;
    if (params.orgId) filters.org_id = params.orgId;
    if (params.projectId) filters.project_id = params.projectId;
    if (params.appId) filters.app_id = params.appId;

    const body: Record<string, unknown> = {
      query: params.query,
      filters,
    };
    if (params.limit) body.limit = params.limit;

    return this.request('/v1/memories/search', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  }

  /* ──── Get All ──── */

  async getAll(opts: {
    userId?: string;
    agentId?: string;
    orgId?: string;
    projectId?: string;
    appId?: string;
  }): Promise<Mem0Memory[]> {
    const params = new URLSearchParams();
    if (opts.userId) params.set('user_id', opts.userId);
    if (opts.agentId) params.set('agent_id', opts.agentId);
    if (opts.orgId) params.set('org_id', opts.orgId);
    if (opts.projectId) params.set('project_id', opts.projectId);
    if (opts.appId) params.set('app_id', opts.appId);
    const qs = params.toString();
    return this.request(`/v1/memories${qs ? `?${qs}` : ''}`, { method: 'GET' });
  }

  /* ──── Delete ──── */

  async delete(memoryId: string): Promise<void> {
    await this.request(`/v1/memories/${encodeURIComponent(memoryId)}`, { method: 'DELETE' });
  }

  /* ──── Update ──── */

  async update(memoryId: string, data: { memory?: string; metadata?: Record<string, unknown> }): Promise<Mem0Memory> {
    return this.request(`/v1/memories/${encodeURIComponent(memoryId)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }
}
