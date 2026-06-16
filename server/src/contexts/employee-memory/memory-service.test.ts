import { describe, it, expect, vi } from 'vitest';
import { MemoryService } from './memory-service.js';
import type {
  MemoryStore,
  MemoryFragment,
  MemoryRule,
} from './domain/memory.js';
import { ORG_USER_ID } from './domain/memory.js';

/* ──── Mock Repository ──── */

function createMockRepo() {
  const stores = new Map<string, MemoryStore>();
  const fragments = new Map<string, MemoryFragment>();
  const rules = new Map<string, MemoryRule>();

  return {
    listStores: vi.fn(async (tenantId?: string) =>
      Array.from(stores.values()).filter((s) => !tenantId || s.tenantId === tenantId)
    ),
    findStoreById: vi.fn(async (id: string) => stores.get(id) ?? null),
    findStoreByInstanceId: vi.fn(async (instanceId: string) =>
      Array.from(stores.values()).find((s) => s.instanceId === instanceId) ?? null
    ),
    saveStore: vi.fn(async (store: MemoryStore) => { stores.set(store.id, store); }),
    deleteStore: vi.fn(async (id: string) => { stores.delete(id); }),
    listFragments: vi.fn(async (storeId: string) =>
      Array.from(fragments.values()).filter((f) => f.memoryStoreId === storeId)
    ),
    findFragmentById: vi.fn(async (id: string) => fragments.get(id) ?? null),
    saveFragment: vi.fn(async (frag: MemoryFragment) => { fragments.set(frag.id, frag); }),
    deleteFragment: vi.fn(async (id: string) => { fragments.delete(id); }),
    incrementFragmentAccess: vi.fn(async () => {}),
    countFragmentsByStore: vi.fn(async (storeId: string) =>
      Array.from(fragments.values()).filter((f) => f.memoryStoreId === storeId).length
    ),
    countDistinctUsersByStore: vi.fn(async (storeId: string) => {
      const userIds = new Set(
        Array.from(fragments.values())
          .filter((f) => f.memoryStoreId === storeId)
          .map((f) => f.userId)
      );
      return userIds.size;
    }),
    listRules: vi.fn(async (storeId: string) =>
      Array.from(rules.values()).filter((r) => r.memoryStoreId === storeId)
    ),
    findRuleById: vi.fn(async (id: string) => rules.get(id) ?? null),
    saveRule: vi.fn(async (rule: MemoryRule) => { rules.set(rule.id, rule); }),
    deleteRule: vi.fn(async (id: string) => { rules.delete(id); }),
    keywordSearch: vi.fn(async (storeId: string, keyword: string) => {
      return Array.from(fragments.values())
        .filter((f) => f.memoryStoreId === storeId && f.content.toLowerCase().includes(keyword.toLowerCase()))
        .map((f) => ({ ...f, keywordScore: f.importance / 10 }));
    }),
    _stores: stores,
    _fragments: fragments,
    _rules: rules,
  };
}

type MockRepo = ReturnType<typeof createMockRepo>;

/* ──── Mock Mem0Client ──── */

function createMockMem0() {
  return {
    isEnabled: vi.fn(() => true),
    add: vi.fn(async () => ({ results: [] })),
    addShared: vi.fn(async () => ({ results: [] })),
    addDeptShared: vi.fn(async () => ({ results: [] })),
    search: vi.fn(async () => ({ results: [] })),
    getAll: vi.fn(async () => []),
    delete: vi.fn(async () => {}),
    update: vi.fn(async () => ({})),
  };
}

type MockMem0 = ReturnType<typeof createMockMem0>;

/* ──── Tests ──── */

describe('MemoryService', () => {
  function createService() {
    const repo = createMockRepo();
    const service = new MemoryService(repo as any, null);
    return { service, repo };
  }

  describe('createStore', () => {
    it('creates and persists a memory store', async () => {
      const { service, repo } = createService();
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });
      expect(store.id).toMatch(/^mem_/);
      expect(store.instanceId).toBe('inst_1');
      expect(store.name).toBe('Test Store');
      expect(repo.saveStore).toHaveBeenCalledOnce();
    });

    it('rejects invalid retrieval config', async () => {
      const { service } = createService();
      await expect(
        service.createStore({
          instanceId: 'inst_1',
          tenantId: 'tn_1',
          name: 'Test',
          retrievalConfig: { topK: 0 },
        })
      ).rejects.toThrow('topK must be between 1 and 50');
    });
  });

  describe('addFragment', () => {
    it('adds a fragment and updates store counters', async () => {
      const { service, repo } = createService();
      // Create store first
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });

      const frag = await service.addFragment({
        storeId: store.id,
        tenantId: 'tn_1',
        userId: 'user_1',
        type: 'preference',
        content: 'Likes dark mode',
      });

      expect(frag.id).toMatch(/^mf_/);
      expect(frag.userId).toBe('user_1');
      expect(frag.content).toBe('Likes dark mode');
    });
  });

  describe('createRule', () => {
    it('creates a memory rule', async () => {
      const { service } = createService();
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });

      const rule = await service.createRule({
        storeId: store.id,
        tenantId: 'tn_1',
        ruleType: 'fragment_rule',
        name: 'Extract preference',
        trigger: { event: 'feedback_received' },
        action: { type: 'extract_preference' },
      });

      expect(rule.id).toMatch(/^mr_/);
      expect(rule.ruleType).toBe('fragment_rule');
      expect(rule.trigger.event).toBe('feedback_received');
    });
  });

  describe('search', () => {
    it('performs keyword search and returns hits', async () => {
      const { service, repo } = createService();
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });

      await service.addFragment({
        storeId: store.id,
        tenantId: 'tn_1',
        userId: 'user_1',
        type: 'fact',
        content: 'User prefers dark mode for IDE',
        importance: 8,
      });

      await service.addFragment({
        storeId: store.id,
        tenantId: 'tn_1',
        userId: 'user_1',
        type: 'preference',
        content: 'Prefers concise responses',
        importance: 6,
      });

      const result = await service.search(store.id, 'prefers');
      expect(result.hits.length).toBeGreaterThan(0);
      expect(result.channels.keyword).toBe(true);
      expect(result.channels.vector).toBe(false);
      // Higher importance should rank first
      if (result.hits.length >= 2) {
        expect(result.hits[0].importance).toBeGreaterThanOrEqual(result.hits[1].importance);
      }
    });

    it('returns empty when no match', async () => {
      const { service } = createService();
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });

      const result = await service.search(store.id, 'nonexistent_query_xyz');
      expect(result.hits.length).toBe(0);
    });
  });

  describe('deleteStore', () => {
    it('deletes a store by id', async () => {
      const { service, repo } = createService();
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });

      await service.deleteStore(store.id);
      expect(repo.deleteStore).toHaveBeenCalledWith(store.id);
    });

    it('throws on not found', async () => {
      const { service } = createService();
      await expect(service.deleteStore('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('archiveStore', () => {
    it('archives an active store', async () => {
      const { service, repo } = createService();
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });

      const archived = await service.archiveStore(store.id);
      expect(archived.status).toBe('archived');
      expect(repo.saveStore).toHaveBeenCalledWith(expect.objectContaining({ id: store.id, status: 'archived' }));
    });

    it('throws on not found', async () => {
      const { service } = createService();
      await expect(service.archiveStore('nonexistent')).rejects.toThrow('not found');
    });
  });

  describe('restoreStore', () => {
    it('restores an archived store to active', async () => {
      const { service } = createService();
      const store = await service.createStore({
        instanceId: 'inst_1',
        tenantId: 'tn_1',
        name: 'Test Store',
      });
      await service.archiveStore(store.id);

      const restored = await service.restoreStore(store.id);
      expect(restored.status).toBe('active');
    });

    it('throws on not found', async () => {
      const { service } = createService();
      await expect(service.restoreStore('nonexistent')).rejects.toThrow('not found');
    });
  });

  /* ──── Mem0 Integration ──── */

  describe('Mem0 dual-write', () => {
    function createServiceWithMem0() {
      const repo = createMockRepo();
      const mem0 = createMockMem0();
      const service = new MemoryService(repo as any, null, mem0 as any);
      return { service, repo, mem0 };
    }

    it('addFragment passes agentId and orgId to mem0.add for personal memory', async () => {
      const { service, mem0 } = createServiceWithMem0();
      const store = await service.createStore({
        instanceId: 'inst_agent_1',
        tenantId: 'tn_org_1',
        name: 'Test Store',
      });

      await service.addFragment({
        storeId: store.id,
        tenantId: 'tn_org_1',
        userId: 'user_alice',
        type: 'preference',
        content: 'Likes dark mode',
      });

      expect(mem0.add).toHaveBeenCalledOnce();
      const callArgs = mem0.add.mock.calls[0][0];
      expect(callArgs.userId).toBe('user_alice');
      expect(callArgs.agentId).toBe('inst_agent_1');
      expect(callArgs.orgId).toBe('tn_org_1');
    });

    it('addFragment calls mem0.addShared (no userId) for shared memory', async () => {
      const { service, mem0 } = createServiceWithMem0();
      const store = await service.createStore({
        instanceId: 'inst_agent_1',
        tenantId: 'tn_org_1',
        name: 'Test Store',
      });

      await service.addFragment({
        storeId: store.id,
        tenantId: 'tn_org_1',
        userId: ORG_USER_ID,
        type: 'fact',
        content: 'Company policy: respond formally',
      });

      // Should NOT call add (personal), should call addShared
      expect(mem0.add).not.toHaveBeenCalled();
      expect(mem0.addShared).toHaveBeenCalledOnce();
      const callArgs = mem0.addShared.mock.calls[0][0];
      expect(callArgs.userId).toBeUndefined();
      expect(callArgs.agentId).toBe('inst_agent_1');
      expect(callArgs.orgId).toBe('tn_org_1');
      expect(callArgs.metadata?.consensus).toBe(true);
    });

    it('search performs layered Mem0 retrieval (personal + agent shared)', async () => {
      const { service, mem0 } = createServiceWithMem0();
      const store = await service.createStore({
        instanceId: 'inst_agent_1',
        tenantId: 'tn_org_1',
        name: 'Test Store',
        retrievalConfig: { useKeywordSearch: false },
      });

      await service.search(store.id, 'dark mode');

      // 无 departmentId（instanceRepo 未注入）→ personal + agent 两层；dept 层需 deptId
      expect(mem0.search).toHaveBeenCalledTimes(2);
      const personalCall = mem0.search.mock.calls[0][0];
      expect(personalCall.agentId).toBe('inst_agent_1');
      expect(personalCall.orgId).toBe('tn_org_1');
      const agentCall = mem0.search.mock.calls[1][0];
      expect(agentCall.agentId).toBe('inst_agent_1');
    });

    it('listFragments passes agentId and orgId to mem0.getAll', async () => {
      const { service, mem0 } = createServiceWithMem0();
      const store = await service.createStore({
        instanceId: 'inst_agent_1',
        tenantId: 'tn_org_1',
        name: 'Test Store',
      });

      await service.listFragments(store.id, { userId: 'user_alice' });

      expect(mem0.getAll).toHaveBeenCalledOnce();
      const callArgs = mem0.getAll.mock.calls[0][0];
      expect(callArgs.userId).toBe('user_alice');
      expect(callArgs.agentId).toBe('inst_agent_1');
      expect(callArgs.orgId).toBe('tn_org_1');
    });

    it('addDeptSharedFragment calls mem0.addDeptShared (app-level, omits agent/user)', async () => {
      const { service, mem0 } = createServiceWithMem0();
      const store = await service.createStore({
        instanceId: 'inst_agent_1',
        tenantId: 'tn_org_1',
        name: 'Test Store',
      });

      const frag = await service.addDeptSharedFragment({
        storeId: store.id,
        departmentId: 'dept_finance',
        content: 'Company fiscal year starts in April',
      });

      expect(frag.scope).toBe('dept_shared');
      expect(frag.departmentId).toBe('dept_finance');
      expect(mem0.addDeptShared).toHaveBeenCalledOnce();
      const args = mem0.addDeptShared.mock.calls[0][0];
      expect(args.appId).toBe('app_dept_finance');
      expect(args.projectId).toBe('dept_finance');
      expect(args.orgId).toBe('tn_org_1');
    });
  });
});
