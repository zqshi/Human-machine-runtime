import { describe, it, expect, vi } from 'vitest';
import { createKnowledgeAuditRoutes } from './knowledge-audits.js';

function mockDocSvc() {
  return {
    listKnowledgeAudits: vi.fn().mockResolvedValue([
      { id: 'ka-1', operationType: 'create', operatorId: 'u-1', targetId: 'doc-1' },
    ]),
  };
}

describe('control knowledge-audit routes', () => {
  it('GET / returns audit list', async () => {
    const svc = mockDocSvc();
    const app = createKnowledgeAuditRoutes(svc as never);
    const res = await app.request('/');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
  });

  it('GET / passes filters', async () => {
    const svc = mockDocSvc();
    const app = createKnowledgeAuditRoutes(svc as never);
    await app.request('/?operationType=create&operatorId=u-1');
    expect(svc.listKnowledgeAudits).toHaveBeenCalledWith({
      operationType: 'create',
      operatorId: 'u-1',
      targetId: undefined,
    });
  });
});
