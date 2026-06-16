import { BaseGatewayClient } from './base-client.js';
import { config } from '../../../config/index.js';

/* ---------- WeKnora API Types ---------- */

export interface WkTenantRegistration {
  user_id: string;
  tenant_id: string;
  token?: string;
  api_key?: string;
}

export interface WkKnowledgeBase {
  id: string;
  name: string;
  description?: string;
  type?: string;
  document_count?: number;
  embedding_model_id?: string;
  vector_store_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface WkKnowledge {
  id: string;
  title: string;
  content?: string;
  source_type?: string;
  parse_status?: string;
  chunk_count?: number;
  file_size?: number;
  created_at?: string;
}

export interface WkChatEvent {
  type: 'thinking' | 'tool_call' | 'tool_result' | 'answer' | 'reflection' | 'done' | 'error';
  content?: string;
  metadata?: Record<string, unknown>;
}

export interface WkSearchResult {
  id?: string;
  title?: string;
  content?: string;
  score?: number;
  chunk_id?: string;
  knowledge_base_id?: string;
}

export interface WkApiResponse<T = unknown> {
  code?: number;
  message?: string;
  data?: T;
}

/* ---------- Client ---------- */

export class WeKnoraClient extends BaseGatewayClient {
  constructor() {
    super('weknora', config.weknora.apiUrl, {
      timeoutMs: config.gateway.writeTimeoutMs,
    });
  }

  /* ---- Tenant Provisioning ---- */

  async registerTenant(username: string, password: string): Promise<WkTenantRegistration> {
    return this.request<WkTenantRegistration>('/api/v1/auth/register', {
      method: 'POST',
      body: { username, password },
      headers: this.adminHeaders(),
      skipRetry: true,
    });
  }

  async getTenantApiKey(wkTenantId: string): Promise<{ api_key: string }> {
    return this.request<{ api_key: string }>(`/api/v1/tenants/${enc(wkTenantId)}/api-key`, {
      method: 'POST',
      headers: this.adminHeaders(),
    });
  }

  /* ---- Knowledge Base CRUD ---- */

  async listKnowledgeBases(apiKey: string): Promise<WkKnowledgeBase[]> {
    const res = await this.request<WkApiResponse<WkKnowledgeBase[]>>('/api/v1/knowledge-bases', {
      headers: this.tenantHeaders(apiKey),
    });
    return Array.isArray(res?.data) ? res.data : [];
  }

  async createKnowledgeBase(
    apiKey: string,
    input: {
      name: string;
      description?: string;
      type?: string;
      embedding_model_id?: string;
      chunking_config?: Record<string, unknown>;
    }
  ): Promise<WkKnowledgeBase> {
    const res = await this.request<WkApiResponse<WkKnowledgeBase>>('/api/v1/knowledge-bases', {
      method: 'POST',
      body: input,
      headers: this.tenantHeaders(apiKey),
    });
    return res?.data || (res as unknown as WkKnowledgeBase);
  }

  async getKnowledgeBase(apiKey: string, kbId: string): Promise<WkKnowledgeBase> {
    const res = await this.request<WkApiResponse<WkKnowledgeBase>>(
      `/api/v1/knowledge-bases/${enc(kbId)}`,
      { headers: this.tenantHeaders(apiKey) }
    );
    return res?.data || (res as unknown as WkKnowledgeBase);
  }

  async updateKnowledgeBase(
    apiKey: string,
    kbId: string,
    patch: Record<string, unknown>
  ): Promise<WkKnowledgeBase> {
    const res = await this.request<WkApiResponse<WkKnowledgeBase>>(
      `/api/v1/knowledge-bases/${enc(kbId)}`,
      {
        method: 'PUT',
        body: patch,
        headers: this.tenantHeaders(apiKey),
      }
    );
    return res?.data || (res as unknown as WkKnowledgeBase);
  }

  async deleteKnowledgeBase(apiKey: string, kbId: string): Promise<void> {
    await this.request(`/api/v1/knowledge-bases/${enc(kbId)}`, {
      method: 'DELETE',
      headers: this.tenantHeaders(apiKey),
    });
  }

  /* ---- Knowledge (Document) Management ---- */

  async uploadManualKnowledge(
    apiKey: string,
    kbId: string,
    input: { title: string; content: string; metadata?: Record<string, unknown> }
  ): Promise<WkKnowledge> {
    const res = await this.request<WkApiResponse<WkKnowledge>>(
      `/api/v1/knowledge-bases/${enc(kbId)}/knowledge/manual`,
      {
        method: 'POST',
        body: input,
        headers: this.tenantHeaders(apiKey),
      }
    );
    return res?.data || (res as unknown as WkKnowledge);
  }

  async uploadUrlKnowledge(
    apiKey: string,
    kbId: string,
    input: { url: string; metadata?: Record<string, unknown> }
  ): Promise<WkKnowledge> {
    const res = await this.request<WkApiResponse<WkKnowledge>>(
      `/api/v1/knowledge-bases/${enc(kbId)}/knowledge/url`,
      {
        method: 'POST',
        body: input,
        headers: this.tenantHeaders(apiKey),
      }
    );
    return res?.data || (res as unknown as WkKnowledge);
  }

  async listKnowledge(apiKey: string, kbId: string): Promise<WkKnowledge[]> {
    const res = await this.request<WkApiResponse<WkKnowledge[]>>(
      `/api/v1/knowledge-bases/${enc(kbId)}/knowledge`,
      { headers: this.tenantHeaders(apiKey) }
    );
    return Array.isArray(res?.data) ? res.data : [];
  }

  async deleteKnowledge(apiKey: string, kbId: string, knowledgeId: string): Promise<void> {
    await this.request(`/api/v1/knowledge-bases/${enc(kbId)}/knowledge/${enc(knowledgeId)}`, {
      method: 'DELETE',
      headers: this.tenantHeaders(apiKey),
    });
  }

  /* ---- RAG Query ---- */

  async chat(
    apiKey: string,
    sessionId: string,
    input: {
      query: string;
      knowledge_base_ids?: string[];
      stream?: boolean;
    }
  ): Promise<{ answer: string; sources?: WkSearchResult[] }> {
    return this.request(`/api/v1/knowledge-chat/${enc(sessionId)}`, {
      method: 'POST',
      body: { ...input, stream: false },
      headers: this.tenantHeaders(apiKey),
      timeoutProfile: 'stream',
    });
  }

  async chatStream(
    apiKey: string,
    sessionId: string,
    input: {
      query: string;
      knowledge_base_ids?: string[];
    }
  ): Promise<Response> {
    return this.requestRaw(`/api/v1/knowledge-chat/${enc(sessionId)}`, {
      method: 'POST',
      body: { ...input, stream: true },
      headers: this.tenantHeaders(apiKey),
      timeoutProfile: 'stream',
    });
  }

  async agentChat(
    apiKey: string,
    sessionId: string,
    input: {
      query: string;
      knowledge_base_ids?: string[];
    }
  ): Promise<Response> {
    return this.requestRaw(`/api/v1/agent-chat/${enc(sessionId)}`, {
      method: 'POST',
      body: { ...input, stream: true },
      headers: this.tenantHeaders(apiKey),
      timeoutProfile: 'stream',
    });
  }

  /* ---- Search ---- */

  async hybridSearch(
    apiKey: string,
    kbId: string,
    query: string,
    opts?: { top_k?: number; score_threshold?: number }
  ): Promise<WkSearchResult[]> {
    const qs = new URLSearchParams({ query });
    if (opts?.top_k) qs.set('top_k', String(opts.top_k));
    if (opts?.score_threshold) qs.set('score_threshold', String(opts.score_threshold));
    const res = await this.request<WkApiResponse<WkSearchResult[]>>(
      `/api/v1/knowledge-bases/${enc(kbId)}/hybrid-search?${qs}`,
      { headers: this.tenantHeaders(apiKey) }
    );
    return Array.isArray(res?.data) ? res.data : [];
  }

  async crossKbSearch(apiKey: string, query: string, kbIds?: string[]): Promise<WkSearchResult[]> {
    const qs = new URLSearchParams({ query });
    if (kbIds?.length) qs.set('knowledge_base_ids', kbIds.join(','));
    const res = await this.request<WkApiResponse<WkSearchResult[]>>(
      `/api/v1/knowledge/search?${qs}`,
      { headers: this.tenantHeaders(apiKey) }
    );
    return Array.isArray(res?.data) ? res.data : [];
  }

  /* ---- Session Management ---- */

  async createSession(
    apiKey: string,
    input: { knowledge_base_id?: string; name?: string }
  ): Promise<{ id: string }> {
    const res = await this.request<WkApiResponse<{ id: string }>>('/api/v1/sessions', {
      method: 'POST',
      body: input,
      headers: this.tenantHeaders(apiKey),
    });
    return res?.data || (res as unknown as { id: string });
  }

  async deleteSession(apiKey: string, sessionId: string): Promise<void> {
    await this.request(`/api/v1/sessions/${enc(sessionId)}`, {
      method: 'DELETE',
      headers: this.tenantHeaders(apiKey),
    });
  }

  /* ---- Health ---- */

  override async checkHealth(): Promise<boolean> {
    return super.checkHealth('/api/v1/system/info');
  }

  /* ---- Internals ---- */

  private adminHeaders(): Record<string, string> {
    const key = config.weknora.adminApiKey;
    return key ? { 'X-API-Key': key } : {};
  }

  private tenantHeaders(apiKey: string): Record<string, string> {
    return { 'X-API-Key': apiKey };
  }
}

function enc(s: string): string {
  return encodeURIComponent(s);
}
