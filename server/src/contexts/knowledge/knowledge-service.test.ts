import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KnowledgeService } from './knowledge-service.js';
import type { IKnowledgeBaseRepository, IKnowledgeEntryRepository } from './knowledge-service.js';
import type {
  IWkMappingRepository,
  WkTenantMapping,
} from '../../db/repositories/weknora-mapping-repository.js';
import type { KnowledgeBase } from './domain/knowledge.js';

function makeMockClient() {
  return {
    registerTenant: vi.fn().mockResolvedValue({
      user_id: 'wk-user-1',
      tenant_id: 'wk-tenant-1',
      api_key: 'sk-test-key',
    }),
    getTenantApiKey: vi.fn().mockResolvedValue({ api_key: 'sk-test-key' }),
    createKnowledgeBase: vi.fn().mockResolvedValue({ id: 'wk-kb-1', name: 'test' }),
    updateKnowledgeBase: vi.fn().mockResolvedValue({ id: 'wk-kb-1' }),
    deleteKnowledgeBase: vi.fn().mockResolvedValue(undefined),
    listKnowledgeBases: vi.fn().mockResolvedValue([]),
    uploadManualKnowledge: vi.fn().mockResolvedValue({
      id: 'wk-doc-1',
      title: 'test',
      parse_status: 'completed',
      chunk_count: 3,
      file_size: 1024,
    }),
    deleteKnowledge: vi.fn().mockResolvedValue(undefined),
    chat: vi.fn().mockResolvedValue({ answer: '答案', sources: [] }),
    crossKbSearch: vi.fn().mockResolvedValue([]),
    hybridSearch: vi.fn().mockResolvedValue([]),
  } as unknown as Parameters<(typeof KnowledgeService.prototype)['provisionTenant']> extends never[]
    ? never
    : Record<string, unknown>;
}

function makeMockMappingRepo(): IWkMappingRepository {
  const store = new Map<string, WkTenantMapping>();
  return {
    getByDcfTenantId: vi.fn(async (id: string) => store.get(id) ?? null),
    save: vi.fn(async (m: WkTenantMapping) => {
      store.set(m.dcfTenantId, m);
    }),
    updateApiKey: vi.fn(),
    updateDefaultKbId: vi.fn(),
    updateStatus: vi.fn(),
    delete: vi.fn(),
    listAll: vi.fn(async () => [...store.values()]),
  };
}

function makeMockKbRepo(): IKnowledgeBaseRepository {
  const store = new Map<string, KnowledgeBase>();
  return {
    findByTenantId: vi.fn(async (tid: string) =>
      [...store.values()].filter((kb) => kb.tenantId === tid)
    ),
    findById: vi.fn(async (id: string) => store.get(id) ?? null),
    findByWkId: vi.fn(
      async (wkId: string) =>
        [...store.values()].find((kb) => kb.wkKnowledgeBaseId === wkId) ?? null
    ),
    save: vi.fn(async (kb: KnowledgeBase) => {
      store.set(kb.id, kb);
    }),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
  };
}

function makeMockEntryRepo(): IKnowledgeEntryRepository {
  const store = new Map<string, Record<string, unknown>>();
  return {
    findByKbId: vi.fn(
      async (kbId: string) =>
        [...store.values()].filter((e) => e.knowledgeBaseId === kbId) as never[]
    ),
    findById: vi.fn(async (id: string) => (store.get(id) as never) ?? null),
    findByDcfDocumentId: vi.fn(
      async (docId: string) =>
        ([...store.values()].find((e) => e.dcfDocumentId === docId) as never) ?? null
    ),
    save: vi.fn(async (entry: Record<string, unknown>) => {
      store.set(entry.id as string, entry);
    }),
    updateSyncStatus: vi.fn(),
    delete: vi.fn(async (id: string) => {
      store.delete(id);
    }),
  };
}

const encryption = {
  encrypt: (s: string) => Buffer.from(s).toString('base64'),
  decrypt: (s: string) => Buffer.from(s, 'base64').toString('utf8'),
};

const silentLogger = {
  info: () => {},
  warn: () => {},
  error: () => {},
};

describe('KnowledgeService', () => {
  let service: KnowledgeService;
  let client: ReturnType<typeof makeMockClient>;
  let mappingRepo: IWkMappingRepository;
  let kbRepo: IKnowledgeBaseRepository;
  let entryRepo: IKnowledgeEntryRepository;

  beforeEach(() => {
    client = makeMockClient();
    mappingRepo = makeMockMappingRepo();
    kbRepo = makeMockKbRepo();
    entryRepo = makeMockEntryRepo();
    service = new KnowledgeService({
      client: client as never,
      mappingRepo,
      kbRepo,
      entryRepo,
      encryption,
      logger: silentLogger,
    });
  });

  describe('provisionTenant', () => {
    it('registers tenant and saves mapping', async () => {
      const mapping = await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      expect(mapping.dcfTenantId).toBe('tn_1');
      expect(mapping.wkTenantId).toBe('wk-tenant-1');
      expect(client.registerTenant).toHaveBeenCalledWith('dcf-acme', expect.any(String));
      expect(mappingRepo.save).toHaveBeenCalled();
    });

    it('returns existing mapping if already provisioned', async () => {
      await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      const second = await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      expect(second.wkTenantId).toBe('wk-tenant-1');
      expect(client.registerTenant).toHaveBeenCalledTimes(1);
    });
  });

  describe('createKnowledgeBase', () => {
    it('creates KB locally and remotely', async () => {
      await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      const kb = await service.createKnowledgeBase({
        tenantId: 'tn_1',
        name: '测试知识库',
      });
      expect(kb.id).toMatch(/^kb_/);
      expect(kb.wkKnowledgeBaseId).toBe('wk-kb-1');
      expect(client.createKnowledgeBase).toHaveBeenCalled();
      expect(kbRepo.save).toHaveBeenCalled();
    });

    it('rejects invalid chunking config', async () => {
      await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      await expect(
        service.createKnowledgeBase({
          tenantId: 'tn_1',
          name: 'test',
          chunkingConfig: { chunkSize: 10, chunkOverlap: 0 },
        })
      ).rejects.toThrow('chunkSize must be between');
    });

    it('throws if tenant not provisioned', async () => {
      await expect(
        service.createKnowledgeBase({ tenantId: 'tn_unknown', name: 'test' })
      ).rejects.toThrow('not provisioned');
    });
  });

  describe('syncDocument', () => {
    it('syncs document and creates entry', async () => {
      await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      const kb = await service.createKnowledgeBase({ tenantId: 'tn_1', name: 'test' });
      const entry = await service.syncDocument('tn_1', kb.id, {
        id: 'doc_1',
        title: '测试文档',
        content: '内容',
      });
      expect(entry.wkKnowledgeId).toBe('wk-doc-1');
      expect(entry.dcfDocumentId).toBe('doc_1');
      expect(client.uploadManualKnowledge).toHaveBeenCalled();
    });

    it('rejects tenant mismatch', async () => {
      await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      const kb = await service.createKnowledgeBase({ tenantId: 'tn_1', name: 'test' });
      await expect(
        service.syncDocument('tn_other', kb.id, { id: 'd', title: 't', content: 'c' })
      ).rejects.toThrow('does not belong to tenant');
    });
  });

  describe('query', () => {
    it('returns answer from WeKnora', async () => {
      await service.provisionTenant('tn_1', 'acme', 'Acme Inc');
      const result = await service.query('tn_1', '什么是 DCF？');
      expect(result.answer).toBe('答案');
      expect(client.chat).toHaveBeenCalled();
    });

    it('throws if tenant not provisioned', async () => {
      await expect(service.query('tn_unknown', 'test')).rejects.toThrow('not provisioned');
    });
  });
});
