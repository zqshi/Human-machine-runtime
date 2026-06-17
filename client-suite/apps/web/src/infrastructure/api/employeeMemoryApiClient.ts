import { request } from './httpClient';

/* ──── Types ──── */

export interface RetrievalConfig {
  topK: number;
  scoreThreshold: number;
  maxMemoryAge: number;
  memoryTypes: string[];
  useKeywordSearch: boolean;
  useVectorSearch: boolean;
  keywordWeight: number;
  vectorWeight: number;
}

export interface MemoryStore {
  id: string;
  instanceId: string;
  tenantId: string;
  name: string;
  description: string;
  retrievalConfig: RetrievalConfig;
  status: string;
  totalFragments: number;
  totalProfiles: number;
  orgFragmentCount: number;
  personalFragmentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryFragment {
  id: string;
  memoryStoreId: string;
  tenantId: string;
  userId: string;
  type: string;
  content: string;
  source: string;
  importance: number;
  accessCount: number;
  lastAccessedAt: string | null;
  expiresAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface MemoryRule {
  id: string;
  memoryStoreId: string;
  tenantId: string;
  ruleType: string;
  name: string;
  description: string;
  trigger: { event?: string; conditions?: Record<string, unknown> };
  action: { type?: string; params?: Record<string, unknown> };
  priority: number;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MemorySearchHit {
  fragmentId: string;
  userId: string;
  type: string;
  content: string;
  importance: number;
  score: number;
  keywordScore?: number;
  vectorScore?: number;
  source: string;
  createdAt: string;
}

export interface MemorySearchResult {
  hits: MemorySearchHit[];
  total: number;
  channels: { keyword: boolean; vector: boolean };
}

/* ──── API ──── */

const BASE = '/api/admin/employee-memory';

export const employeeMemoryApi = {
  /* Store */
  listStores(tenantId?: string, instanceId?: string): Promise<MemoryStore[]> {
    const params = new URLSearchParams();
    if (tenantId) params.set('tenantId', tenantId);
    if (instanceId) params.set('instanceId', instanceId);
    const qs = params.toString();
    return request(`${BASE}/stores${qs ? `?${qs}` : ''}`);
  },

  createStore(data: {
    instanceId: string;
    name: string;
    description?: string;
    retrievalConfig?: Partial<RetrievalConfig>;
  }): Promise<MemoryStore> {
    return request(`${BASE}/stores`, { method: 'POST', body: JSON.stringify(data) });
  },

  getStore(storeId: string): Promise<MemoryStore> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}`);
  },

  updateRetrievalConfig(storeId: string, config: Partial<RetrievalConfig>): Promise<MemoryStore> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/retrieval-config`, {
      method: 'PUT',
      body: JSON.stringify(config),
    });
  },

  deleteStore(storeId: string): Promise<{ success: boolean }> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}`, { method: 'DELETE' });
  },

  archiveStore(storeId: string): Promise<MemoryStore> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'archived' }),
    });
  },

  restoreStore(storeId: string): Promise<MemoryStore> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: 'active' }),
    });
  },

  /* Fragment */
  listFragments(
    storeId: string,
    opts?: { userId?: string; type?: string; keyword?: string; limit?: number; offset?: number; scope?: 'org' | 'personal' }
  ): Promise<MemoryFragment[]> {
    const params = new URLSearchParams();
    if (opts?.userId) params.set('userId', opts.userId);
    if (opts?.type) params.set('type', opts.type);
    if (opts?.keyword) params.set('keyword', opts.keyword);
    if (opts?.limit) params.set('limit', String(opts.limit));
    if (opts?.offset) params.set('offset', String(opts.offset));
    if (opts?.scope) params.set('scope', opts.scope);
    const qs = params.toString();
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/fragments${qs ? `?${qs}` : ''}`);
  },

  addFragment(
    storeId: string,
    data: {
      userId: string;
      type: string;
      content: string;
      source?: string;
      importance?: number;
      expiresAt?: string | null;
      metadata?: Record<string, unknown>;
    }
  ): Promise<MemoryFragment> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/fragments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  deleteFragment(storeId: string, fragmentId: string): Promise<{ success: boolean }> {
    return request(
      `${BASE}/stores/${encodeURIComponent(storeId)}/fragments/${encodeURIComponent(fragmentId)}`,
      { method: 'DELETE' }
    );
  },

  /* Rule */
  listRules(storeId: string, opts?: { ruleType?: string }): Promise<MemoryRule[]> {
    const qs = opts?.ruleType ? `?ruleType=${encodeURIComponent(opts.ruleType)}` : '';
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/rules${qs}`);
  },

  createRule(
    storeId: string,
    data: {
      ruleType: string;
      name: string;
      description?: string;
      trigger?: MemoryRule['trigger'];
      action?: MemoryRule['action'];
      priority?: number;
      enabled?: boolean;
    }
  ): Promise<MemoryRule> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/rules`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  updateRule(
    storeId: string,
    ruleId: string,
    data: Partial<Pick<MemoryRule, 'name' | 'description' | 'trigger' | 'action' | 'priority' | 'enabled'>>
  ): Promise<MemoryRule> {
    return request(
      `${BASE}/stores/${encodeURIComponent(storeId)}/rules/${encodeURIComponent(ruleId)}`,
      { method: 'PUT', body: JSON.stringify(data) }
    );
  },

  deleteRule(storeId: string, ruleId: string): Promise<{ success: boolean }> {
    return request(
      `${BASE}/stores/${encodeURIComponent(storeId)}/rules/${encodeURIComponent(ruleId)}`,
      { method: 'DELETE' }
    );
  },

  /* Search & Verify */
  search(
    storeId: string,
    query: string,
    opts?: { userId?: string; topK?: number }
  ): Promise<MemorySearchResult> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/search`, {
      method: 'POST',
      body: JSON.stringify({ query, ...opts }),
    });
  },

  verify(
    storeId: string,
    query: string,
    opts?: { userId?: string; topK?: number }
  ): Promise<MemorySearchResult & { query: string }> {
    return request(`${BASE}/stores/${encodeURIComponent(storeId)}/verify`, {
      method: 'POST',
      body: JSON.stringify({ query, ...opts }),
    });
  },
};
