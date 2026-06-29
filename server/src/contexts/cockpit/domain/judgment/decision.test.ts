import { describe, it, expect } from 'vitest';
import { Decision, type DecisionProps, type RecommendationOption } from './decision.js';

const rec = (
  id: string,
  riskLevel: RecommendationOption['riskLevel'] = 'high'
): RecommendationOption => ({
  id,
  label: `label-${id}`,
  description: 'desc',
  reasoning: 'reason',
  estimatedImpact: 'impact',
  riskLevel,
});

const baseProps = (): DecisionProps => ({
  id: 'dec-1',
  agentId: 'agent-1',
  title: '是否扩容',
  context: 'CPU 持续 >90%',
  recommendation: rec('rec-1'),
  alternatives: [rec('alt-1', 'low')],
  urgency: 'high',
  deadline: Date.now() + 60_000,
  responseStatus: 'pending',
  impactScope: 2,
  downstreamTaskIds: ['t1'],
  downstreamGoalIds: ['g1'],
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

describe('Decision', () => {
  describe('create', () => {
    it('默认 responseStatus=pending / urgency=normal / impactScope=0 / alternatives 空 / id dec- 前缀', () => {
      const d = Decision.create({ title: 'G' });
      expect(d.id).toMatch(/^dec-\d+-[a-z0-9]+$/);
      expect(d.responseStatus).toBe('pending');
      expect(d.urgency).toBe('normal');
      expect(d.impactScope).toBe(0);
      expect(d.alternatives).toEqual([]);
      expect(d.downstreamTaskIds).toEqual([]);
      expect(d.downstreamGoalIds).toEqual([]);
      expect(d.deadline).toBe(0);
      expect(d.createdAt).toBeInstanceOf(Date);
      expect(d.recommendation).toEqual({
        id: '',
        label: '',
        description: '',
        reasoning: '',
        estimatedImpact: '',
        riskLevel: 'medium',
      });
    });

    it('透传字段 + urgency 枚举校验 + impactScope clamp >= 0', () => {
      const d = Decision.create({
        agentId: 'a1',
        title: 'T',
        context: 'C',
        recommendation: rec('r1'),
        alternatives: [rec('a1')],
        urgency: 'critical',
        deadline: 1000,
        impactScope: 5,
        downstreamTaskIds: ['t1', 't2'],
        downstreamGoalIds: ['g1'],
        tenantId: 'tenant-1',
      });
      expect(d.agentId).toBe('a1');
      expect(d.urgency).toBe('critical');
      expect(d.deadline).toBe(1000);
      expect(d.impactScope).toBe(5);
      expect(d.tenantId).toBe('tenant-1');
      expect(d.alternatives).toHaveLength(1);
    });

    it('impactScope 负值 clamp 到 0', () => {
      const d = Decision.create({ impactScope: -3 });
      expect(d.impactScope).toBe(0);
    });

    it('无效 urgency 抛错', () => {
      expect(() => Decision.create({ urgency: 'urgent' as never })).toThrow(/invalid urgency/);
    });

    it('无效 responseStatus 抛错', () => {
      expect(() => Decision.create({ responseStatus: 'done' as never })).toThrow(
        /invalid responseStatus/
      );
    });
  });

  describe('fromProps', () => {
    it('校验通过 + 规整 recommendation/alternatives（脏字段补默认）', () => {
      const d = Decision.fromProps({
        ...baseProps(),
        recommendation: { id: 'r', label: 'L' } as unknown as RecommendationOption,
        alternatives: [{ id: 'a' } as unknown as RecommendationOption],
      });
      expect(d.recommendation).toEqual({
        id: 'r',
        label: 'L',
        description: '',
        reasoning: '',
        estimatedImpact: '',
        riskLevel: 'medium',
      });
      expect(d.alternatives[0]).toEqual({
        id: 'a',
        label: '',
        description: '',
        reasoning: '',
        estimatedImpact: '',
        riskLevel: 'medium',
      });
    });

    it('脏枚举拒建：invalid urgency', () => {
      expect(() => Decision.fromProps({ ...baseProps(), urgency: 'urgent' as never })).toThrow(
        /invalid urgency/
      );
    });

    it('脏枚举拒建：invalid responseStatus', () => {
      expect(() => Decision.fromProps({ ...baseProps(), responseStatus: 'done' as never })).toThrow(
        /invalid responseStatus/
      );
    });
  });

  describe('respond 状态机', () => {
    it('accept 无参 → accepted, userResponse=accept', () => {
      const d = Decision.fromProps(baseProps()).respond('accept');
      expect(d.responseStatus).toBe('accepted');
      expect(d.userResponse).toBe('accept');
      expect(d.responseAt).toBeTypeOf('number');
    });

    it('accept + feedback → userResponse=feedback（优先 feedback）', () => {
      const d = Decision.fromProps(baseProps()).respond('accept', {
        feedback: '同意',
        optionId: 'opt-1',
      });
      expect(d.responseStatus).toBe('accepted');
      expect(d.userResponse).toBe('同意');
    });

    it('accept + optionId（无 feedback）→ userResponse=optionId', () => {
      const d = Decision.fromProps(baseProps()).respond('accept', { optionId: 'opt-1' });
      expect(d.userResponse).toBe('opt-1');
    });

    it('decline → declined, userResponse=feedback', () => {
      const d = Decision.fromProps(baseProps()).respond('decline', { feedback: '风险过高' });
      expect(d.responseStatus).toBe('declined');
      expect(d.userResponse).toBe('风险过高');
    });

    it('decline 无 feedback → userResponse=decline', () => {
      const d = Decision.fromProps(baseProps()).respond('decline');
      expect(d.userResponse).toBe('decline');
    });

    it('defer + deferUntil → deferred, deadline 更新为 deferUntil', () => {
      const base = baseProps();
      const d = Decision.fromProps(base).respond('defer', {
        deferUntil: base.deadline + 3_600_000,
      });
      expect(d.responseStatus).toBe('deferred');
      expect(d.deadline).toBe(base.deadline + 3_600_000);
    });

    it('defer 无 deferUntil → deadline 保持原值', () => {
      const base = baseProps();
      const d = Decision.fromProps(base).respond('defer');
      expect(d.responseStatus).toBe('deferred');
      expect(d.deadline).toBe(base.deadline);
    });

    it('modify → modified, userResponse=feedback ?? optionId', () => {
      const d1 = Decision.fromProps(baseProps()).respond('modify', {
        feedback: '改用方案B',
        optionId: 'alt-1',
      });
      expect(d1.responseStatus).toBe('modified');
      expect(d1.userResponse).toBe('改用方案B');
      const d2 = Decision.fromProps(baseProps()).respond('modify', { optionId: 'alt-1' });
      expect(d2.userResponse).toBe('alt-1');
    });

    it('respond 返回新实例，原实例 immutable', () => {
      const original = Decision.fromProps(baseProps());
      const responded = original.respond('accept');
      expect(original.responseStatus).toBe('pending');
      expect(responded.responseStatus).toBe('accepted');
      expect(responded).not.toBe(original);
    });
  });

  describe('expire / 派生查询', () => {
    it('expire → expired', () => {
      const d = Decision.fromProps(baseProps()).expire();
      expect(d.responseStatus).toBe('expired');
    });

    it('isPending / isTerminal', () => {
      expect(Decision.fromProps(baseProps()).isPending).toBe(true);
      expect(Decision.fromProps(baseProps()).isTerminal).toBe(false);
      expect(Decision.fromProps(baseProps()).respond('accept').isTerminal).toBe(true);
      expect(Decision.fromProps(baseProps()).respond('defer').isTerminal).toBe(false);
    });

    it('isExpired：pending + deadline 已过 → true', () => {
      const expired = Decision.fromProps({ ...baseProps(), deadline: Date.now() - 1 });
      expect(expired.isExpired).toBe(true);
    });

    it('isExpired：deadline=0（未设）→ false（不误判）', () => {
      const d = Decision.create({ title: 'T' });
      expect(d.isExpired).toBe(false);
    });

    it('timeRemaining：未过期返回剩余 ms，过期返回 0', () => {
      const future = Decision.fromProps({ ...baseProps(), deadline: Date.now() + 5_000 });
      expect(future.timeRemaining).toBeGreaterThan(0);
      const past = Decision.fromProps({ ...baseProps(), deadline: Date.now() - 5_000 });
      expect(past.timeRemaining).toBe(0);
    });
  });

  describe('toProps round-trip', () => {
    it('toProps → fromProps 重建等价', () => {
      const d = Decision.fromProps(baseProps());
      const rebuilt = Decision.fromProps(d.toProps());
      expect(rebuilt.toProps()).toEqual(d.toProps());
    });
  });
});
