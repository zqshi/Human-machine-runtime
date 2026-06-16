import { describe, it, expect } from 'vitest';
import { RiskRuleTrigger } from '../RiskRuleTrigger';
import type { DecisionTrigger } from '../../../domain/agent/DecisionHub';

function riskTrigger(severity: string): DecisionTrigger {
  return {
    source: 'risk-rule-trigger',
    sourceId: 'rule-001',
    title: '风险规则命中',
    context: `severity: ${severity}\n检测到敏感内容`,
    urgency: 'normal',
    deadline: Date.now() + 3600_000,
    relatedEntities: { traceId: 'trace-1' },
  };
}

describe('RiskRuleTrigger', () => {
  const handler = new RiskRuleTrigger();

  describe('preprocess', () => {
    it('critical severity → critical urgency, impactScope=8', async () => {
      const result = await handler.preprocess(riskTrigger('critical'));
      expect(result.urgency).toBe('critical');
      expect(result.impactScope).toBe(8);
    });

    it('high severity → high urgency, impactScope=4', async () => {
      const result = await handler.preprocess(riskTrigger('high'));
      expect(result.urgency).toBe('high');
      expect(result.impactScope).toBe(4);
    });

    it('medium severity → normal urgency, impactScope=2', async () => {
      const result = await handler.preprocess(riskTrigger('medium'));
      expect(result.urgency).toBe('normal');
      expect(result.impactScope).toBe(2);
    });

    it('low severity → low urgency', async () => {
      const result = await handler.preprocess(riskTrigger('low'));
      expect(result.urgency).toBe('low');
    });

    it('unknown severity defaults to medium/normal', async () => {
      const result = await handler.preprocess(riskTrigger('unknown'));
      expect(result.urgency).toBe('normal');
    });

    it('no severity in context defaults to medium', async () => {
      const t: DecisionTrigger = {
        source: 'risk-rule-trigger',
        sourceId: 'rule-x',
        title: 'test',
        context: '无等级信息',
        urgency: 'normal',
        deadline: Date.now(),
        relatedEntities: {},
      };
      const result = await handler.preprocess(t);
      expect(result.urgency).toBe('normal');
    });

    it('generates recommendation with proper label for critical', async () => {
      const result = await handler.preprocess(riskTrigger('critical'));
      expect(result.recommendation!.label).toBe('立即阻断操作');
    });

    it('generates recommendation with proper label for low', async () => {
      const result = await handler.preprocess(riskTrigger('low'));
      expect(result.recommendation!.label).toBe('记录并允许');
    });

    it('low risk adds "允许通过" alternative', async () => {
      const result = await handler.preprocess(riskTrigger('low'));
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).toContain('允许通过');
    });

    it('high risk does not add "允许通过" alternative', async () => {
      const result = await handler.preprocess(riskTrigger('high'));
      const labels = result.alternatives!.map((a) => a.label);
      expect(labels).not.toContain('允许通过');
    });
  });

  describe('createFromRiskHit', () => {
    it('creates trigger from RiskRuleHit', () => {
      const t = RiskRuleTrigger.createFromRiskHit({
        ruleId: 'r1',
        ruleName: '敏感词过滤',
        severity: 'high',
        action: 'block',
        matchSummary: '检测到敏感关键词',
      });
      expect(t.source).toBe('risk-rule-trigger');
      expect(t.sourceId).toBe('r1');
      expect(t.title).toContain('敏感词过滤');
      expect(t.urgency).toBe('high');
    });

    it('includes extraData in context', () => {
      const t = RiskRuleTrigger.createFromRiskHit(
        {
          ruleId: 'r2',
          ruleName: 'test',
          severity: 'medium',
          action: 'review',
          matchSummary: 'match',
        },
        { userId: 'u1', traceId: 't1', taskId: 'task-1' }
      );
      expect(t.context).toContain('u1');
      expect(t.relatedEntities.traceId).toBe('t1');
      expect(t.relatedEntities.taskId).toBe('task-1');
    });

    it('unknown severity defaults to normal urgency', () => {
      const t = RiskRuleTrigger.createFromRiskHit({
        ruleId: 'r3',
        ruleName: 'test',
        severity: 'exotic',
        action: 'allow',
        matchSummary: '',
      });
      expect(t.urgency).toBe('normal');
    });
  });

  describe('postprocess', () => {
    it('is a no-op', async () => {
      await expect(handler.postprocess({} as never)).resolves.toBeUndefined();
    });
  });
});
