import { describe, it, expect } from 'vitest';
import { JudgmentRecord, type JudgmentRecordProps } from './judgment-record.js';
import { Decision, type DecisionProps } from './decision.js';

const decisionProps = (): DecisionProps => ({
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
});

const baseProps = (): JudgmentRecordProps => ({
  id: 'jr-1',
  decisionId: 'dec-1',
  source: 'agent-discovery',
  action: 'accepted',
  selectedOptionId: 'rec-1',
  feedback: '同意扩容',
  respondedAt: 1_000_000,
  createdAt: 900_000,
  contextSnapshot: {
    title: '是否扩容',
    context: 'CPU >90%',
    urgency: 'high',
    recommendationLabel: '扩容',
    alternativeCount: 1,
  },
});

describe('JudgmentRecord', () => {
  describe('create', () => {
    it('默认 id jr- 前缀 + 时间戳 now', () => {
      const r = JudgmentRecord.create({
        decisionId: 'dec-1',
        source: 'agent-discovery',
        action: 'accepted',
      });
      expect(r.id).toMatch(/^jr-\d+-[a-z0-9]+$/);
      expect(r.respondedAt).toBeTypeOf('number');
      expect(r.createdAt).toBeTypeOf('number');
    });

    it('透传字段 + 枚举校验', () => {
      const r = JudgmentRecord.create({
        decisionId: 'dec-1',
        source: 'risk-rule-trigger',
        action: 'declined',
        selectedOptionId: 'opt-1',
        feedback: '拒',
        respondedAt: 5_000,
        createdAt: 1_000,
        contextSnapshot: {
          title: 'T',
          context: 'C',
          urgency: 'high',
          recommendationLabel: 'L',
          alternativeCount: 2,
        },
      });
      expect(r.source).toBe('risk-rule-trigger');
      expect(r.action).toBe('declined');
      expect(r.contextSnapshot.alternativeCount).toBe(2);
    });

    it('无效 source 抛错', () => {
      expect(() =>
        JudgmentRecord.create({
          decisionId: 'dec-1',
          source: 'manual' as never,
          action: 'accepted',
        })
      ).toThrow(/invalid source/);
    });

    it('无效 action 抛错', () => {
      expect(() =>
        JudgmentRecord.create({
          decisionId: 'dec-1',
          source: 'agent-discovery',
          action: 'done' as never,
        })
      ).toThrow(/invalid action/);
    });

    it('contextSnapshot alternativeCount 非数字补 0', () => {
      const r = JudgmentRecord.create({
        decisionId: 'dec-1',
        source: 'agent-discovery',
        action: 'accepted',
        contextSnapshot: {
          title: 'T',
          context: 'C',
          urgency: 'normal',
          recommendationLabel: 'L',
          alternativeCount: 'abc' as unknown as number,
        },
      });
      expect(r.contextSnapshot.alternativeCount).toBe(0);
    });
  });

  describe('fromProps', () => {
    it('校验通过 + 脏枚举拒建', () => {
      expect(() => JudgmentRecord.fromProps({ ...baseProps(), source: 'manual' as never })).toThrow(
        /invalid source/
      );
      expect(() => JudgmentRecord.fromProps({ ...baseProps(), action: 'done' as never })).toThrow(
        /invalid action/
      );
    });
  });

  describe('rehydrate（脏数据容错）', () => {
    it('非法 source → fallback agent-discovery；非法 action → fallback expired', () => {
      const r = JudgmentRecord.rehydrate({
        id: 'jr-x',
        decisionId: 'dec-x',
        source: 'unknown-source',
        action: 'weird',
        respondedAt: 1_000,
        createdAt: 0,
        contextSnapshot: {
          title: 'T',
          context: 'C',
          urgency: 'normal',
          recommendationLabel: 'L',
          alternativeCount: 0,
        },
      });
      expect(r.source).toBe('agent-discovery');
      expect(r.action).toBe('expired');
    });

    it('合法枚举原样保留', () => {
      const r = JudgmentRecord.rehydrate({ ...baseProps() });
      expect(r.source).toBe('agent-discovery');
      expect(r.action).toBe('accepted');
    });
  });

  describe('fromDecisionResponse', () => {
    it('pending decision 拒生成', () => {
      const d = Decision.fromProps(decisionProps());
      expect(() => JudgmentRecord.fromDecisionResponse(d, 'agent-discovery')).toThrow(
        /pending Decision/
      );
    });

    it('accepted decision → selectedOptionId=recommendation.id + contextSnapshot 快照', () => {
      const d = Decision.fromProps(decisionProps()).respond('accept', { feedback: '同意' });
      const r = JudgmentRecord.fromDecisionResponse(d, 'agent-discovery');
      expect(r.decisionId).toBe('dec-1');
      expect(r.action).toBe('accepted');
      expect(r.selectedOptionId).toBe('rec-1');
      expect(r.feedback).toBe('同意');
      expect(r.contextSnapshot).toEqual({
        title: '是否扩容',
        context: 'CPU >90%',
        urgency: 'high',
        recommendationLabel: '扩容',
        alternativeCount: 1,
      });
      expect(r.createdAt).toBe(d.createdAt.getTime());
    });

    it('modified decision → selectedOptionId=recommendation.id', () => {
      const d = Decision.fromProps(decisionProps()).respond('modify', { optionId: 'alt-1' });
      const r = JudgmentRecord.fromDecisionResponse(d, 'milestone-arrival');
      expect(r.action).toBe('modified');
      expect(r.selectedOptionId).toBe('rec-1');
      expect(r.source).toBe('milestone-arrival');
    });

    it('declined decision → selectedOptionId undefined', () => {
      const d = Decision.fromProps(decisionProps()).respond('decline', { feedback: '拒' });
      const r = JudgmentRecord.fromDecisionResponse(d, 'risk-rule-trigger');
      expect(r.action).toBe('declined');
      expect(r.selectedOptionId).toBeUndefined();
    });
  });

  describe('responseDurationMs', () => {
    it('respondedAt - createdAt', () => {
      const r = JudgmentRecord.fromProps(baseProps());
      expect(r.responseDurationMs).toBe(100_000);
    });
  });
});
