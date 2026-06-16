import { describe, it, expect, vi } from 'vitest';
import { createKnowledgeRoutes } from './knowledge.js';
import type { KnowledgeService } from '../../contexts/knowledge/knowledge-service.js';
import type { KnowledgeBase } from '../../contexts/knowledge/domain/knowledge.js';

const mockKb: KnowledgeBase = {
  id: 'kb-1',
  tenantId: 'tenant-1',
  wkKnowledgeBaseId: 'wk-kb-1',
  name: 'Test KB',
  description: 'desc',
  type: 'document',
  status: 'active',
  embeddingModelId: null,
  chunkingConfig: { chunkSize: 512, chunkOverlap: 64 },
  retrievalConfig: {
    topK: 5,
    scoreThreshold: 0.5,
    useHybridSearch: true,
    bm25Weight: 0.3,
    vectorWeight: 0.7,
  },
  documentCount: 0,
  boundInstanceIds: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
};

function mockService(): KnowledgeService {
  return {
    listKnowledgeBases: vi.fn().mockResolvedValue([mockKb]),
    getKnowledgeBase: vi.fn().mockResolvedValue(mockKb),
    createKnowledgeBase: vi.fn().mockResolvedValue(mockKb),
    updateKnowledgeBase: vi.fn().mockResolvedValue(mockKb),
    archiveKnowledgeBase: vi.fn().mockResolvedValue({ ...mockKb, status: 'archived' }),
    bindToInstances: vi.fn().mockResolvedValue({ ...mockKb, boundInstanceIds: ['inst-1'] }),
    unbindFromInstances: vi.fn().mockResolvedValue(mockKb),
    syncDocument: vi.fn().mockResolvedValue({ id: 'ke-1', title: 'doc' }),
    syncDocumentByUrl: vi.fn().mockResolvedValue({ id: 'ke-2', title: 'url-doc' }),
    query: vi.fn().mockResolvedValue({ answer: 'test answer', sources: [] }),
    search: vi
      .fn()
      .mockResolvedValue([{ knowledgeId: 'k1', title: 'hit', content: 'c', score: 0.9 }]),
    provisionTenant: vi.fn().mockResolvedValue({ wkTenantId: 'wk-t-1' }),
  } as unknown as KnowledgeService;
}

describe('knowledge routes', () => {
  describe('GET /bases', () => {
    it('returns 400 without tenantId', async () => {
      const app = createKnowledgeRoutes(mockService());
      const res = await app.request('/bases');
      expect(res.status).toBe(400);
    });

    it('lists knowledge bases for a tenant', async () => {
      const svc = mockService();
      const app = createKnowledgeRoutes(svc);
      const res = await app.request('/bases?tenantId=tenant-1');
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.data).toHaveLength(1);
      expect(svc.listKnowledgeBases).toHaveBeenCalledWith('tenant-1');
    });
  });

  describe('POST /bases', () => {
    it('returns 400 without required fields', async () => {
      const app = createKnowledgeRoutes(mockService());
      const res = await app.request('/bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it('creates a knowledge base', async () => {
      const svc = mockService();
      const app = createKnowledgeRoutes(svc);
      const res = await app.request('/bases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-1', name: 'Test KB' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
    });
  });

  describe('POST /bases/:id/bind-instances', () => {
    it('returns 400 for non-array instanceIds', async () => {
      const app = createKnowledgeRoutes(mockService());
      const res = await app.request('/bases/kb-1/bind-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceIds: 'not-array' }),
      });
      expect(res.status).toBe(400);
    });

    it('binds instances', async () => {
      const svc = mockService();
      const app = createKnowledgeRoutes(svc);
      const res = await app.request('/bases/kb-1/bind-instances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ instanceIds: ['inst-1'] }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.boundInstanceIds).toContain('inst-1');
    });
  });

  describe('POST /query', () => {
    it('returns 400 without required fields', async () => {
      const app = createKnowledgeRoutes(mockService());
      const res = await app.request('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-1' }),
      });
      expect(res.status).toBe(400);
    });

    it('performs a RAG query', async () => {
      const svc = mockService();
      const app = createKnowledgeRoutes(svc);
      const res = await app.request('/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-1', query: 'what is DCF?' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data.answer).toBe('test answer');
    });
  });

  describe('POST /search', () => {
    it('returns search hits', async () => {
      const svc = mockService();
      const app = createKnowledgeRoutes(svc);
      const res = await app.request('/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-1', query: 'keyword' }),
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.total).toBe(1);
    });
  });

  describe('POST /provision', () => {
    it('returns 400 without required fields', async () => {
      const app = createKnowledgeRoutes(mockService());
      const res = await app.request('/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-1' }),
      });
      expect(res.status).toBe(400);
    });

    it('provisions a WeKnora tenant', async () => {
      const svc = mockService();
      const app = createKnowledgeRoutes(svc);
      const res = await app.request('/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId: 'tenant-1', tenantSlug: 'test', tenantName: 'Test' }),
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.data.wkTenantId).toBe('wk-t-1');
    });
  });
});
