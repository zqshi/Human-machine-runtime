import { describe, it, expect, vi } from 'vitest';
import { createSkillRoutes } from './skills.js';

function mockSkillSvc() {
  return {
    listReportsByStatus: vi.fn().mockResolvedValue([{ id: 'r-1', status: 'pending' }]),
    listReportsByType: vi.fn().mockResolvedValue([{ id: 'r-1', assetType: 'skill' }]),
    reportAsset: vi.fn().mockResolvedValue({ id: 'r-2' }),
    reviewReport: vi.fn().mockResolvedValue({ id: 'r-1', status: 'approved' }),
    listSharedAssets: vi.fn().mockResolvedValue([{ id: 'a-1', name: 'Common Skill' }]),
    bindSharedAsset: vi.fn().mockResolvedValue({ id: 'b-1' }),
    listAssetBindings: vi.fn().mockResolvedValue([{ id: 'b-1' }]),
  };
}

describe('control skill routes', () => {
  it('GET /reports returns skill reports', async () => {
    const svc = mockSkillSvc();
    const app = createSkillRoutes(svc as never);
    const res = await app.request('/reports');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('GET /reports filters by status', async () => {
    const svc = mockSkillSvc();
    const app = createSkillRoutes(svc as never);
    await app.request('/reports?status=pending');
    expect(svc.listReportsByStatus).toHaveBeenCalledWith('pending');
  });

  it('POST /reports creates report', async () => {
    const svc = mockSkillSvc();
    const app = createSkillRoutes(svc as never);
    const res = await app.request('/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetType: 'skill', assetId: 'a-1', reason: 'outdated' }),
    });
    expect(res.status).toBe(201);
    expect(svc.reportAsset).toHaveBeenCalled();
  });

  it('GET /shared returns shared assets', async () => {
    const svc = mockSkillSvc();
    const app = createSkillRoutes(svc as never);
    const res = await app.request('/shared');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it('GET /bindings returns asset bindings', async () => {
    const svc = mockSkillSvc();
    const app = createSkillRoutes(svc as never);
    const res = await app.request('/bindings');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });
});
