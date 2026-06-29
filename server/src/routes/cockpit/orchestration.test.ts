import { describe, it, expect, vi } from 'vitest';
import { createCockpitOrchestrationRoutes } from './orchestration.js';
import { OrchestrationChain } from '../../contexts/cockpit/domain/orchestration/orchestration-chain.js';
import { Escalation } from '../../contexts/cockpit/domain/orchestration/escalation.js';
import { OrchestrationAgent } from '../../contexts/cockpit/domain/orchestration/orchestration-agent.js';

const fixedDate = new Date('2026-01-01T00:00:00Z');

function makeChain() {
  return OrchestrationChain.fromProps({
    id: 'orch-1',
    name: '链',
    steps: [{ s: 1 }],
    currentStep: 0,
    status: 'active',
    agentId: 'a1',
    tenantId: 't1',
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}
function makeEscalation() {
  return Escalation.fromProps({
    id: 'esc-1',
    status: 'open',
    severity: 'high',
    metadata: { k: 'v' },
    tenantId: 't1',
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}
function makeAgent() {
  return OrchestrationAgent.fromProps({
    id: 'oag-1',
    agentId: 'a1',
    role: 'executor',
    status: 'registered',
    metadata: {},
    tenantId: 't1',
    registeredAt: fixedDate,
  });
}

function mockService() {
  const service = {
    listChains: vi.fn(),
    createChain: vi.fn(),
    getChain: vi.fn(),
    advanceChain: vi.fn(),
    listEscalations: vi.fn(),
    createEscalation: vi.fn(),
    updateEscalation: vi.fn(),
    listAgents: vi.fn(),
    createAgent: vi.fn(),
  };
  const app = createCockpitOrchestrationRoutes(service as never);
  return { app, service };
}

describe('cockpit orchestration routes（薄层，守 §12信号6）', () => {
  it('GET /orchestration/chains 透传 status filter + 分页，序列化 Date→ms', async () => {
    const { app, service } = mockService();
    service.listChains.mockResolvedValue({ items: [makeChain()], total: 1, limit: 10, offset: 0 });
    const res = await app.request('/orchestration/chains?status=active&limit=10&offset=0');
    expect(res.status).toBe(200);
    expect(service.listChains).toHaveBeenCalledWith({
      status: 'active',
      agentId: undefined,
      tenantId: undefined,
      limit: 10,
      offset: 0,
    });
    const body = await res.json();
    expect(body.items[0].createdAt).toBeTypeOf('number');
    expect(body.total).toBe(1);
  });

  it('POST /orchestration/chains 调 service.createChain 返回 201', async () => {
    const { app, service } = mockService();
    service.createChain.mockResolvedValue(makeChain());
    const res = await app.request('/orchestration/chains', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '链' }),
    });
    expect(res.status).toBe(201);
    expect(service.createChain).toHaveBeenCalledWith({ name: '链' });
  });

  it('GET /orchestration/chains/:id 不存在 → 404', async () => {
    const { app, service } = mockService();
    service.getChain.mockResolvedValue(null);
    const res = await app.request('/orchestration/chains/x');
    expect(res.status).toBe(404);
  });

  it('POST /orchestration/chains/:id/advance 调 service.advanceChain', async () => {
    const { app, service } = mockService();
    service.advanceChain.mockResolvedValue(makeChain());
    const res = await app.request('/orchestration/chains/orch-1/advance', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(service.advanceChain).toHaveBeenCalledWith('orch-1');
  });

  it('POST /orchestration/chains/:id/advance 不存在 → 404', async () => {
    const { app, service } = mockService();
    service.advanceChain.mockResolvedValue(null);
    const res = await app.request('/orchestration/chains/x/advance', { method: 'POST' });
    expect(res.status).toBe(404);
  });

  it('GET /orchestration/escalations 透传 status filter', async () => {
    const { app, service } = mockService();
    service.listEscalations.mockResolvedValue({
      items: [makeEscalation()],
      total: 1,
      limit: 50,
      offset: 0,
    });
    const res = await app.request('/orchestration/escalations?status=open');
    expect(res.status).toBe(200);
    expect(service.listEscalations).toHaveBeenCalledWith({
      status: 'open',
      tenantId: undefined,
      limit: undefined,
      offset: undefined,
    });
  });

  it('POST /orchestration/escalations 调 service.createEscalation 返回 201', async () => {
    const { app, service } = mockService();
    service.createEscalation.mockResolvedValue(makeEscalation());
    const res = await app.request('/orchestration/escalations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ severity: 'high' }),
    });
    expect(res.status).toBe(201);
    expect(service.createEscalation).toHaveBeenCalledWith({ severity: 'high' });
  });

  it('PATCH /orchestration/escalations/:id 缺 status → 400', async () => {
    const { app, service } = mockService();
    const res = await app.request('/orchestration/escalations/esc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ metadata: {} }),
    });
    expect(res.status).toBe(400);
    expect(service.updateEscalation).not.toHaveBeenCalled();
  });

  it('PATCH /orchestration/escalations/:id 透传 status+metadata', async () => {
    const { app, service } = mockService();
    service.updateEscalation.mockResolvedValue(makeEscalation());
    const res = await app.request('/orchestration/escalations/esc-1', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'acknowledged', metadata: { k: 'v' } }),
    });
    expect(res.status).toBe(200);
    expect(service.updateEscalation).toHaveBeenCalledWith('esc-1', {
      status: 'acknowledged',
      metadata: { k: 'v' },
    });
  });

  it('PATCH /orchestration/escalations/:id 不存在 → 404', async () => {
    const { app, service } = mockService();
    service.updateEscalation.mockResolvedValue(null);
    const res = await app.request('/orchestration/escalations/x', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'resolved' }),
    });
    expect(res.status).toBe(404);
  });

  it('GET /orchestration/agents 透传 agentId filter，序列化 registeredAt→ms', async () => {
    const { app, service } = mockService();
    service.listAgents.mockResolvedValue({ items: [makeAgent()], total: 1, limit: 50, offset: 0 });
    const res = await app.request('/orchestration/agents?agentId=a1');
    expect(res.status).toBe(200);
    expect(service.listAgents).toHaveBeenCalledWith({
      agentId: 'a1',
      status: undefined,
      tenantId: undefined,
      limit: undefined,
      offset: undefined,
    });
    const body = await res.json();
    expect(body.items[0].registeredAt).toBeTypeOf('number');
  });

  it('POST /orchestration/agents 调 service.createAgent 返回 201', async () => {
    const { app, service } = mockService();
    service.createAgent.mockResolvedValue(makeAgent());
    const res = await app.request('/orchestration/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: 'a1' }),
    });
    expect(res.status).toBe(201);
    expect(service.createAgent).toHaveBeenCalledWith({ agentId: 'a1' });
  });
});
