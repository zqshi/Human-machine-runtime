import { describe, it, expect, vi } from 'vitest';
import { DocumentService, type IDocumentRepository, type Document } from './document-service.js';

function makeDoc(overrides: Partial<Document> = {}): Document {
  return {
    id: 'doc-1',
    roomId: null,
    type: 'doc',
    title: '测试文档',
    content: {},
    status: 'draft',
    categoryId: null,
    departmentId: null,
    ownerId: 'admin',
    permissions: [],
    createdBy: 'admin',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

function makeRepo(docs: Document[] = []): IDocumentRepository {
  const store = new Map(docs.map((d) => [d.id, { ...d }]));
  const versions: any[] = [];
  const repo: IDocumentRepository = {
    listDocuments: vi.fn(async () => Array.from(store.values())),
    getDocument: vi.fn(async (id: string) => store.get(id) || null),
    saveDocument: vi.fn(async (doc: Document) => {
      store.set(doc.id, doc);
    }),
    deleteDocument: vi.fn(async (id: string) => {
      store.delete(id);
      return true;
    }),
    listVersions: vi.fn(async () => [...versions]),
    getVersion: vi.fn(async (id: string) => versions.find((v) => v.id === id) || null),
    saveVersion: vi.fn(async (v) => {
      versions.push(v);
    }),
    listDocumentPermissions: vi.fn(async () => []),
    saveDocumentPermissions: vi.fn(async () => {}),
    appendKnowledgeAudit: vi.fn(async () => {}),
    withTransaction: vi.fn(async (fn: (tx: IDocumentRepository) => Promise<unknown>) => fn(repo)),
  };
  return repo;
}

describe('DocumentService', () => {
  describe('list', () => {
    it('returns all documents', async () => {
      const svc = new DocumentService(makeRepo([makeDoc()]));
      const result = await svc.list();
      expect(result).toHaveLength(1);
    });

    it('filters by status', async () => {
      const docs = [
        makeDoc({ id: 'd1', status: 'draft' }),
        makeDoc({ id: 'd2', status: 'published' }),
      ];
      const svc = new DocumentService(makeRepo(docs));
      const result = await svc.list(undefined, { status: 'published' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('d2');
    });

    it('filters by search query', async () => {
      const docs = [
        makeDoc({ id: 'd1', title: 'API文档' }),
        makeDoc({ id: 'd2', title: '部署手册' }),
      ];
      const svc = new DocumentService(makeRepo(docs));
      const result = await svc.list(undefined, { search: 'api' });
      expect(result).toHaveLength(1);
    });
  });

  describe('get', () => {
    it('returns document by id', async () => {
      const svc = new DocumentService(makeRepo([makeDoc()]));
      const result = await svc.get('doc-1');
      expect(result.title).toBe('测试文档');
    });

    it('throws 404 for unknown id', async () => {
      const svc = new DocumentService(makeRepo());
      await expect(svc.get('nope')).rejects.toThrow('document not found');
    });
  });

  describe('create', () => {
    it('creates a document with defaults', async () => {
      const repo = makeRepo();
      const svc = new DocumentService(repo);
      const doc = await svc.create({ title: '新文档', createdBy: 'admin' });
      expect(doc.title).toBe('新文档');
      expect(doc.status).toBe('draft');
      expect(doc.version).toBe(1);
      expect(repo.saveDocument).toHaveBeenCalled();
      expect(repo.saveVersion).toHaveBeenCalled();
    });

    it('throws for invalid type', async () => {
      const svc = new DocumentService(makeRepo());
      await expect(svc.create({ type: 'invalid' })).rejects.toThrow('invalid document type');
    });

    it('defaults title to 未命名文档', async () => {
      const svc = new DocumentService(makeRepo());
      const doc = await svc.create({});
      expect(doc.title).toBe('未命名文档');
    });
  });

  describe('update', () => {
    it('updates title and increments version', async () => {
      const svc = new DocumentService(makeRepo([makeDoc()]));
      const updated = await svc.update('doc-1', { title: '更新标题' });
      expect(updated.title).toBe('更新标题');
      expect(updated.version).toBe(2);
    });

    it('throws on version conflict', async () => {
      const svc = new DocumentService(makeRepo([makeDoc({ version: 3 })]));
      await expect(svc.update('doc-1', { title: 'x', version: 2 })).rejects.toThrow(
        'version conflict'
      );
    });
  });

  describe('delete', () => {
    it('deletes an existing document', async () => {
      const repo = makeRepo([makeDoc()]);
      const svc = new DocumentService(repo);
      const result = await svc.delete('doc-1');
      expect(result).toBe(true);
      expect(repo.deleteDocument).toHaveBeenCalledWith('doc-1');
    });
  });

  describe('transitionStatus', () => {
    it('transitions draft → published', async () => {
      const svc = new DocumentService(makeRepo([makeDoc({ status: 'draft' })]));
      const result = await svc.transitionStatus('doc-1', 'published', { name: 'reviewer' });
      expect(result.status).toBe('published');
      expect(result.publishedAt).toBeDefined();
    });

    it('transitions draft → pending_review', async () => {
      const svc = new DocumentService(makeRepo([makeDoc({ status: 'draft' })]));
      const result = await svc.transitionStatus('doc-1', 'pending_review');
      expect(result.status).toBe('pending_review');
      expect(result.submittedAt).toBeDefined();
    });

    it('rejects invalid transition', async () => {
      const svc = new DocumentService(makeRepo([makeDoc({ status: 'archived' })]));
      await expect(svc.transitionStatus('doc-1', 'published')).rejects.toThrow(
        'invalid transition'
      );
    });
  });
});
