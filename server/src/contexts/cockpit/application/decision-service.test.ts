import { describe, it, expect, vi } from 'vitest';
import { DecisionService } from './decision-service.js';
import { Decision } from '../domain/judgment/decision.js';
import { JudgmentRecord } from '../domain/judgment/judgment-record.js';

function makeDecision(overrides: Record<string, unknown> = {}): Decision {
  return Decision.fromProps({
    id: 'dec-1',
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
    alternatives: [
      {
        id: 'alt-1',
        label: '等待',
        description: 'd',
        reasoning: 'r',
        estimatedImpact: 'i',
        riskLevel: 'low',
      },
    ],
    urgency: 'high',
    deadline: Date.now() + 60_000,
    responseStatus: 'pending',
    impactScope: 1,
    downstreamTaskIds: [],
    downstreamGoalIds: [],
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    ...overrides,
  });
}

function mockDeps() {
  const decisionRepo = {
    findById: vi.fn(),
    listPaged: vi.fn(),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  };
  const judgmentRepo = {
    findById: vi.fn(),
    listPaged: vi.fn(),
    list: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
    remove: vi.fn(),
  };
  const eventBus = { publish: vi.fn() };
  const service = new DecisionService(
    decisionRepo as never,
    judgmentRepo as never,
    eventBus as never
  );
  return { service, decisionRepo, judgmentRepo, eventBus };
}

describe('DecisionService', () => {
  describe('createDecision', () => {
    it('create + save + publish decision:created', async () => {
      const { service, decisionRepo, eventBus } = mockDeps();
      const d = await service.createDecision({ title: 'T', agentId: 'a1' });
      expect(d.title).toBe('T');
      expect(d.responseStatus).toBe('pending');
      expect(decisionRepo.save).toHaveBeenCalledWith(d);
      expect(eventBus.publish).toHaveBeenCalledWith('decision:created', d.toProps());
    });
  });

  describe('getDecision / deleteDecision', () => {
    it('getDecision 委托 findById', async () => {
      const { service, decisionRepo } = mockDeps();
      const d = makeDecision();
      decisionRepo.findById.mockResolvedValue(d);
      expect(await service.getDecision('dec-1')).toBe(d);
    });

    it('deleteDecision 委托 remove', async () => {
      const { service, decisionRepo } = mockDeps();
      decisionRepo.remove.mockResolvedValue(true);
      expect(await service.deleteDecision('dec-1')).toBe(true);
    });
  });

  describe('respondDecision', () => {
    it('decision 不存在返回 null', async () => {
      const { service, decisionRepo } = mockDeps();
      decisionRepo.findById.mockResolvedValue(null);
      expect(await service.respondDecision('dec-999', 'accept')).toBeNull();
    });

    it('accept → 状态机 + 自动生成 record + 双事件发布', async () => {
      const { service, decisionRepo, judgmentRepo, eventBus } = mockDeps();
      decisionRepo.findById.mockResolvedValue(makeDecision());
      const responded = await service.respondDecision('dec-1', 'accept', { feedback: '同意' });
      expect(responded?.responseStatus).toBe('accepted');
      expect(responded?.userResponse).toBe('同意');
      // decision 落库
      expect(decisionRepo.save).toHaveBeenCalledWith(responded);
      // 自动生成审计 record
      expect(judgmentRepo.save).toHaveBeenCalledTimes(1);
      const savedRecord = judgmentRepo.save.mock.calls[0][0] as JudgmentRecord;
      expect(savedRecord.decisionId).toBe('dec-1');
      expect(savedRecord.action).toBe('accepted');
      expect(savedRecord.selectedOptionId).toBe('rec-1');
      // 双事件
      const events = eventBus.publish.mock.calls.map((c) => c[0]);
      expect(events).toContain('decision:updated');
      expect(events).toContain('judgment:recorded');
    });

    it('decline → record action=declined, selectedOptionId undefined', async () => {
      const { service, decisionRepo, judgmentRepo } = mockDeps();
      decisionRepo.findById.mockResolvedValue(makeDecision());
      await service.respondDecision('dec-1', 'decline', { feedback: '风险高' });
      const savedRecord = judgmentRepo.save.mock.calls[0][0] as JudgmentRecord;
      expect(savedRecord.action).toBe('declined');
      expect(savedRecord.selectedOptionId).toBeUndefined();
      expect(savedRecord.feedback).toBe('风险高');
    });

    it('defer → deadline 更新为 deferUntil', async () => {
      const { service, decisionRepo } = mockDeps();
      const base = makeDecision();
      decisionRepo.findById.mockResolvedValue(base);
      const responded = await service.respondDecision('dec-1', 'defer', {
        deferUntil: base.deadline + 3_600_000,
      });
      expect(responded?.responseStatus).toBe('deferred');
      expect(responded?.deadline).toBe(base.deadline + 3_600_000);
    });
  });

  describe('listDecisions / listJudgmentRecords', () => {
    it('listDecisions 委托 listPaged', async () => {
      const { service, decisionRepo } = mockDeps();
      const result = { items: [makeDecision()], total: 1, limit: 50, offset: 0 };
      decisionRepo.listPaged.mockResolvedValue(result);
      expect(await service.listDecisions({ responseStatus: 'pending' })).toBe(result);
      expect(decisionRepo.listPaged).toHaveBeenCalledWith({ responseStatus: 'pending' });
    });

    it('listJudgmentRecords 委托 judgmentRepo.listPaged', async () => {
      const { service, judgmentRepo } = mockDeps();
      const result = { items: [], total: 0, limit: 50, offset: 0 };
      judgmentRepo.listPaged.mockResolvedValue(result);
      expect(await service.listJudgmentRecords({ decisionId: 'dec-1' })).toBe(result);
    });
  });

  describe('createJudgmentRecord', () => {
    it('create + save + publish judgment:recorded', async () => {
      const { service, judgmentRepo, eventBus } = mockDeps();
      const r = await service.createJudgmentRecord({
        decisionId: 'dec-1',
        source: 'agent-discovery',
        action: 'accepted',
      });
      expect(r.action).toBe('accepted');
      expect(judgmentRepo.save).toHaveBeenCalledWith(r);
      expect(eventBus.publish).toHaveBeenCalledWith('judgment:recorded', r.toProps());
    });
  });

  describe('getJudgmentAnalytics', () => {
    it('全量 list + compute 返回 snapshot', async () => {
      const { service, judgmentRepo } = mockDeps();
      judgmentRepo.list.mockResolvedValue([
        JudgmentRecord.create({
          decisionId: 'dec-1',
          source: 'agent-discovery',
          action: 'accepted',
          respondedAt: 1_000,
          createdAt: 0,
          contextSnapshot: {
            title: 'T',
            context: 'C',
            urgency: 'normal',
            recommendationLabel: 'L',
            alternativeCount: 1,
          },
        }),
      ]);
      const snapshot = await service.getJudgmentAnalytics();
      expect(snapshot.totalRecords).toBe(1);
      expect(snapshot.actionDistribution.accepted).toBe(1);
      expect(snapshot.responseTime.min).toBe(1_000);
    });

    it('空 record 返回 empty snapshot', async () => {
      const { service } = mockDeps();
      const snapshot = await service.getJudgmentAnalytics();
      expect(snapshot.totalRecords).toBe(0);
    });
  });
});
