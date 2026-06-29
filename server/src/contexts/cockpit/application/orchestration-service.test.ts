import { describe, it, expect, vi } from 'vitest';
import { OrchestrationService } from './orchestration-service.js';
import { OrchestrationChain } from '../domain/orchestration/orchestration-chain.js';
import { Escalation } from '../domain/orchestration/escalation.js';
import { OrchestrationAgent } from '../domain/orchestration/orchestration-agent.js';

function mockRepos() {
  const chainRepo = { listPaged: vi.fn(), findById: vi.fn(), save: vi.fn() };
  const escalationRepo = { listPaged: vi.fn(), findById: vi.fn(), save: vi.fn() };
  const agentRepo = { listPaged: vi.fn(), findById: vi.fn(), save: vi.fn() };
  const eventBus = { publish: vi.fn() };
  const service = new OrchestrationService(
    chainRepo as never,
    escalationRepo as never,
    agentRepo as never,
    eventBus as never
  );
  return { service, chainRepo, escalationRepo, agentRepo, eventBus };
}

const fixedDate = new Date('2026-01-01T00:00:00Z');

function makeChain() {
  return OrchestrationChain.fromProps({
    id: 'orch-1',
    steps: [{ s: 1 }, { s: 2 }],
    currentStep: 0,
    status: 'active',
    createdAt: fixedDate,
    updatedAt: fixedDate,
  });
}

describe('OrchestrationService', () => {
  it('createChain 调 repo.save + 发布 chain-created 事件', async () => {
    const { service, chainRepo, eventBus } = mockRepos();
    const c = await service.createChain({ name: '链', steps: [{ s: 1 }] });
    expect(c).toBeInstanceOf(OrchestrationChain);
    expect(chainRepo.save).toHaveBeenCalledWith(c);
    expect(eventBus.publish).toHaveBeenCalledWith('orchestration:chain-created', c.toProps());
  });

  it('listChains 透传 listPaged opts', async () => {
    const { service, chainRepo } = mockRepos();
    chainRepo.listPaged.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    await service.listChains({ status: 'active', limit: 10 });
    expect(chainRepo.listPaged).toHaveBeenCalledWith({ status: 'active', limit: 10 });
  });

  it('advanceChain 调 domain.advance + save + 发布 step-advanced', async () => {
    const { service, chainRepo, eventBus } = mockRepos();
    chainRepo.findById.mockResolvedValue(makeChain());
    const advanced = await service.advanceChain('orch-1');
    expect(advanced?.currentStep).toBe(1);
    expect(advanced?.status).toBe('active');
    expect(chainRepo.save).toHaveBeenCalledWith(advanced);
    expect(eventBus.publish).toHaveBeenCalledWith('orchestration:step-advanced', {
      chainId: 'orch-1',
      step: 1,
    });
  });

  it('advanceChain 不存在返 null', async () => {
    const { service, chainRepo } = mockRepos();
    chainRepo.findById.mockResolvedValue(null);
    expect(await service.advanceChain('x')).toBeNull();
  });

  it('createEscalation 调 repo.save + 发布 escalation-created', async () => {
    const { service, escalationRepo, eventBus } = mockRepos();
    const e = await service.createEscalation({ severity: 'high' });
    expect(e).toBeInstanceOf(Escalation);
    expect(escalationRepo.save).toHaveBeenCalledWith(e);
    expect(eventBus.publish).toHaveBeenCalledWith('orchestration:escalation-created', e.toProps());
  });

  it('updateEscalation 走 domain 状态机 transition', async () => {
    const { service, escalationRepo } = mockRepos();
    const e = Escalation.create({ status: 'open' });
    escalationRepo.findById.mockResolvedValue(e);
    const updated = await service.updateEscalation(e.id, { status: 'acknowledged' });
    expect(updated?.status).toBe('acknowledged');
    expect(escalationRepo.save).toHaveBeenCalledWith(updated);
  });

  it('updateEscalation 不存在返 null', async () => {
    const { service, escalationRepo } = mockRepos();
    escalationRepo.findById.mockResolvedValue(null);
    expect(await service.updateEscalation('x', { status: 'resolved' })).toBeNull();
  });

  it('updateEscalation 非法 status 抛错（domain.transition asStatus 校验）', async () => {
    const { service, escalationRepo } = mockRepos();
    escalationRepo.findById.mockResolvedValue(Escalation.create({}));
    await expect(service.updateEscalation('esc-1', { status: 'foobar' as never })).rejects.toThrow(
      /invalid status/
    );
  });

  it('updateEscalation 合并 metadata patch', async () => {
    const { service, escalationRepo } = mockRepos();
    const e = Escalation.create({ metadata: { a: 1 } });
    escalationRepo.findById.mockResolvedValue(e);
    const updated = await service.updateEscalation(e.id, {
      status: 'resolved',
      metadata: { b: 2 },
    });
    expect(updated?.metadata).toEqual({ a: 1, b: 2 });
  });

  it('createAgent 调 repo.save（不发事件，守原 route 行为）', async () => {
    const { service, agentRepo, eventBus } = mockRepos();
    const a = await service.createAgent({ agentId: 'a1' });
    expect(a).toBeInstanceOf(OrchestrationAgent);
    expect(agentRepo.save).toHaveBeenCalledWith(a);
    expect(eventBus.publish).not.toHaveBeenCalled();
  });

  it('listAgents 透传 listPaged opts', async () => {
    const { service, agentRepo } = mockRepos();
    agentRepo.listPaged.mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    await service.listAgents({ agentId: 'a1' });
    expect(agentRepo.listPaged).toHaveBeenCalledWith({ agentId: 'a1' });
  });
});
