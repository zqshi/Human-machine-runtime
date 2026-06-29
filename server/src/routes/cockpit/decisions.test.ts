import { describe, it, expect, vi } from 'vitest';
import { createCockpitDecisionRoutes } from './decisions.js';
import { Decision } from '../../contexts/cockpit/domain/judgment/decision.js';
import { JudgmentRecord } from '../../contexts/cockpit/domain/judgment/judgment-record.js';

function makeDecision(): Decision {
  return Decision.fromProps({
    id: 'd-1',
    agentId: 'agent-1',
    title: '是否扩容',
    context: 'CPU >90%',
    recommendation: {
      id: 'rec-1',
      label: '扩容',
      description: 'd',
      reasoning: 'r',
      estimatedImpact: 'i',
      riskLevel: 'high',
    },
    alternatives: [],
    urgency: 'high',
    deadline: Date.now() + 60_000,
    responseStatus: 'pending',
    impactScope: 0,
    downstreamTaskIds: [],
    downstreamGoalIds: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  });
}

function mockServiceAndRepo() {
  const service = {
    listDecisions: vi.fn(),
    respondDecision: vi.fn(),
    listJudgmentRecords: vi.fn(),
    createJudgmentRecord: vi.fn(),
    getJudgmentAnalytics: vi.fn(),
    createDecision: vi.fn(),
    getDecision: vi.fn(),
    deleteDecision: vi.fn(),
  };
  const cockpitRepo = { list: vi.fn().mockResolvedValue([]) };
  const app = createCockpitDecisionRoutes(service as never, cockpitRepo as never);
  return { app, service, cockpitRepo };
}

describe('cockpit decision routes（薄层，守 §12信号6）', () => {
  it('GET /decisions 透传 status filter + 分页，序列化 Date→ms', async () => {
    const { app, service } = mockServiceAndRepo();
    service.listDecisions.mockResolvedValue({
      items: [makeDecision()],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const res = await app.request('/decisions?status=pending&limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(service.listDecisions).toHaveBeenCalledWith({
      responseStatus: 'pending',
      agentId: undefined,
      tenantId: undefined,
      limit: 10,
      offset: 0,
    });
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].responseStatus).toBe('pending');
    expect(body.items[0].createdAt).toBeTypeOf('number'); // Date→ms
    expect(body.total).toBe(1);
  });

  it('GET /decisions 无参时 limit/offset undefined（service 默认 50）', async () => {
    const { app, service } = mockServiceAndRepo();
    service.listDecisions.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    await app.request('/decisions');
    expect(service.listDecisions).toHaveBeenCalledWith({
      responseStatus: undefined,
      agentId: undefined,
      tenantId: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it('POST /decisions/:id/respond 透传 action+params，返回 { decision }', async () => {
    const { app, service } = mockServiceAndRepo();
    const responded = makeDecision();
    service.respondDecision.mockResolvedValue(responded);
    const res = await app.request('/decisions/d-1/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'accept', feedback: '同意' }),
    });
    expect(res.status).toBe(200);
    expect(service.respondDecision).toHaveBeenCalledWith('d-1', 'accept', {
      feedback: '同意',
      optionId: undefined,
      deferUntil: undefined,
    });
    const body = await res.json();
    expect(body.decision.id).toBe('d-1');
  });

  it('POST /decisions/:id/respond decision 不存在 → 404', async () => {
    const { app, service } = mockServiceAndRepo();
    service.respondDecision.mockResolvedValue(null);
    const res = await app.request('/decisions/d-999/respond', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'decline' }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /judgment-records 透传 decisionId filter', async () => {
    const { app, service } = mockServiceAndRepo();
    service.listJudgmentRecords.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    const res = await app.request('/judgment-records?decisionId=d-1');
    expect(res.status).toBe(200);
    expect(service.listJudgmentRecords).toHaveBeenCalledWith({
      decisionId: 'd-1',
      source: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it('POST /judgment-records 调 service.createJudgmentRecord 返回 201', async () => {
    const { app, service } = mockServiceAndRepo();
    const record = JudgmentRecord.create({
      decisionId: 'd-1',
      source: 'agent-discovery',
      action: 'accepted',
    });
    service.createJudgmentRecord.mockResolvedValue(record);
    const res = await app.request('/judgment-records', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decisionId: 'd-1', source: 'agent-discovery', action: 'accepted' }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.action).toBe('accepted');
  });

  it('GET /judgment-analytics 返回 snapshot', async () => {
    const { app, service } = mockServiceAndRepo();
    service.getJudgmentAnalytics.mockResolvedValue({
      totalRecords: 0,
      responseTime: { mean: 0, median: 0, p90: 0, min: 0, max: 0 },
      actionDistribution: { accepted: 0, modified: 0, declined: 0, deferred: 0, expired: 0 },
      sourceDistribution: {},
      timeliness: { onTime: 0, late: 0, total: 0, onTimeRate: 0 },
      averageAlternativeCount: 0,
      computedAt: 1000,
    });
    const res = await app.request('/judgment-analytics');
    expect(res.status).toBe(200);
    expect(service.getJudgmentAnalytics).toHaveBeenCalled();
    const body = await res.json();
    expect(body.totalRecords).toBe(0);
  });

  it('GET /inbox 跨聚合聚合 workorder/goal（留 route 调 cockpitRepo）', async () => {
    const { app, cockpitRepo } = mockServiceAndRepo();
    cockpitRepo.list.mockImplementation((type: string) => {
      if (type === 'workorder') return Promise.resolve([{ status: 'pending' }, { status: 'done' }]);
      if (type === 'goal') return Promise.resolve([{ id: 'g-1' }]);
      return Promise.resolve([]);
    });
    const res = await app.request('/inbox');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.goalCount).toBe(1);
    expect(body.pendingCount).toBe(1);
  });
});
