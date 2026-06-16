import { describe, it, expect } from 'vitest';
import { JudgmentRecord } from '../JudgmentRecord';
import { DecisionRequest } from '../DecisionRequest';

function makeDecision(overrides: Partial<Parameters<typeof DecisionRequest.create>[0]> = {}) {
  return DecisionRequest.create({
    id: 'dr-001',
    agentId: 'agent-alpha',
    title: '服务器扩容确认',
    context: 'CPU 使用率超过 90%',
    recommendation: {
      id: 'opt-1',
      label: '立即扩容',
      description: '增加 2 台实例',
      reasoning: 'CPU 持续高位',
      estimatedImpact: '成本增加 20%',
      riskLevel: 'low',
    },
    alternatives: [
      {
        id: 'opt-2',
        label: '观察 30 分钟',
        description: '暂不处理',
        reasoning: '可能是短期峰值',
        estimatedImpact: '无额外成本',
        riskLevel: 'medium',
      },
    ],
    urgency: 'high',
    deadline: Date.now() + 3600_000,
    responseStatus: 'pending',
    createdAt: Date.now() - 60_000,
    ...overrides,
  });
}

describe('JudgmentRecord', () => {
  it('creates from an accepted DecisionRequest', () => {
    const decision = makeDecision();
    const accepted = decision.accept();

    const record = JudgmentRecord.fromDecisionResponse(accepted, 'risk-rule-trigger');

    expect(record.decisionId).toBe('dr-001');
    expect(record.source).toBe('risk-rule-trigger');
    expect(record.action).toBe('accepted');
    expect(record.selectedOptionId).toBe('opt-1');
    expect(record.feedback).toBeUndefined();
    expect(record.respondedAt).toBeDefined();
    expect(record.contextSnapshot.title).toBe('服务器扩容确认');
    expect(record.contextSnapshot.urgency).toBe('high');
    expect(record.contextSnapshot.alternativeCount).toBe(1);
  });

  it('creates from a modified DecisionRequest with feedback', () => {
    const decision = makeDecision();
    const modified = decision.modify('opt-2', '先观察但设置告警');

    const record = JudgmentRecord.fromDecisionResponse(modified, 'agent-discovery');

    expect(record.action).toBe('modified');
    expect(record.selectedOptionId).toBe('opt-2');
    expect(record.feedback).toBe('先观察但设置告警');
  });

  it('creates from a declined DecisionRequest', () => {
    const decision = makeDecision();
    const declined = decision.decline('误触发，不需要扩容');

    const record = JudgmentRecord.fromDecisionResponse(declined, 'external-alarm');

    expect(record.action).toBe('declined');
    expect(record.feedback).toBe('误触发，不需要扩容');
    expect(record.selectedOptionId).toBeUndefined();
  });

  it('creates from a deferred DecisionRequest', () => {
    const decision = makeDecision();
    const deferUntil = Date.now() + 7200_000;
    const deferred = decision.defer(deferUntil);

    const record = JudgmentRecord.fromDecisionResponse(deferred, 'milestone-arrival');

    expect(record.action).toBe('deferred');
  });

  it('captures context snapshot immutably', () => {
    const decision = makeDecision();
    const accepted = decision.accept();
    const record = JudgmentRecord.fromDecisionResponse(accepted, 'risk-rule-trigger');

    expect(record.contextSnapshot.context).toBe('CPU 使用率超过 90%');
    expect(record.contextSnapshot.recommendationLabel).toBe('立即扩容');
  });

  it('calculates response duration', () => {
    const createdAt = Date.now() - 120_000;
    const decision = makeDecision({ createdAt });
    const accepted = decision.accept();
    const record = JudgmentRecord.fromDecisionResponse(accepted, 'risk-rule-trigger');

    expect(record.responseDurationMs).toBeGreaterThanOrEqual(120_000);
  });

  it('throws on pending DecisionRequest', () => {
    const decision = makeDecision();

    expect(() => JudgmentRecord.fromDecisionResponse(decision, 'risk-rule-trigger')).toThrow(
      'Cannot create JudgmentRecord from a pending DecisionRequest'
    );
  });

  it('generates unique IDs', () => {
    const decision = makeDecision();
    const accepted = decision.accept();
    const r1 = JudgmentRecord.fromDecisionResponse(accepted, 'risk-rule-trigger');
    const r2 = JudgmentRecord.fromDecisionResponse(accepted, 'risk-rule-trigger');

    expect(r1.id).not.toBe(r2.id);
  });
});
