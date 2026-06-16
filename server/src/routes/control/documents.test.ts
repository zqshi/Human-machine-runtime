import { describe, it, expect, vi } from 'vitest';
import { createDocumentRoutes } from './documents.js';

function mockDocumentService(overrides: Record<string, unknown> = {}) {
  const doc = { id: 'doc-1', title: 'Test Doc', type: 'doc', status: 'draft' };
  return {
    list: vi.fn().mockResolvedValue([doc]),
    get: vi.fn().mockResolvedValue(doc),
    create: vi.fn().mockResolvedValue({ ...doc, id: 'doc-2', title: 'New' }),
    update: vi.fn().mockResolvedValue({ ...doc, title: 'Updated' }),
    delete: vi.fn().mockResolvedValue(doc),
    submitForReview: vi.fn().mockResolvedValue({ ...doc, status: 'review' }),
    ...overrides,
  } as never;
}

describe('control document routes', () => {
  it('GET / returns document list', async () => {
    const app = createDocumentRoutes(mockDocumentService());
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data).toHaveLength(1);
  });

  it('GET /:id returns single document', async () => {
    const svc = mockDocumentService();
    const app = createDocumentRoutes(svc);
    const res = await app.request('/doc-1');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.data.id).toBe('doc-1');
  });

  it('POST / creates a document', async () => {
    const svc = mockDocumentService();
    const app = createDocumentRoutes(svc);
    const res = await app.request('/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'New', type: 'doc' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it('DELETE /:id deletes a document', async () => {
    const svc = mockDocumentService();
    const app = createDocumentRoutes(svc);
    const res = await app.request('/doc-1', { method: 'DELETE' });
    expect(res.status).toBe(200);
    expect(svc.delete).toHaveBeenCalledWith('doc-1');
  });
});
