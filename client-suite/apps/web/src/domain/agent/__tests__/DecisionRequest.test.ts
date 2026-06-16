import { describe, it, expect } from 'vitest';
import { DecisionRequest } from '../DecisionRequest';

describe('DecisionRequest — backward compatibility', () => {
  const BASE_PROPS = {
    id: 'dr-compat',
    agentId: 'agent-old',
    title: '老格式决策',
    context: '无新字段',
    recommendation: {
      id: 'opt-1',
      label: '默认方案',
      description: '描述',
      reasoning: '理由',
      estimatedImpact: '影响',
      riskLevel: 'low' as const,
    },
    alternatives: [],
    urgency: 'normal' as const,
    deadline: Date.now() + 3600_000,
    responseStatus: 'pending' as const,
    createdAt: Date.now(),
  };

  it('creates from props without new fields', () => {
    const decision = DecisionRequest.create(BASE_PROPS);

    expect(decision.id).toBe('dr-compat');
    expect(decision.impactScope).toBe(0);
    expect(decision.downstreamTaskIds).toEqual([]);
    expect(decision.downstreamGoalIds).toEqual([]);
  });

  it('preserves new field defaults through accept()', () => {
    const decision = DecisionRequest.create(BASE_PROPS);
    const accepted = decision.accept();

    expect(accepted.impactScope).toBe(0);
    expect(accepted.downstreamTaskIds).toEqual([]);
    expect(accepted.downstreamGoalIds).toEqual([]);
    expect(accepted.responseStatus).toBe('accepted');
  });

  it('preserves new field defaults through modify()', () => {
    const decision = DecisionRequest.create(BASE_PROPS);
    const modified = decision.modify('opt-1', '调整');

    expect(modified.impactScope).toBe(0);
    expect(modified.downstreamTaskIds).toEqual([]);
    expect(modified.downstreamGoalIds).toEqual([]);
  });

  it('preserves new field values through lifecycle methods', () => {
    const decision = DecisionRequest.create({
      ...BASE_PROPS,
      impactScope: 5,
      downstreamTaskIds: ['task-a', 'task-b'],
      downstreamGoalIds: ['goal-x'],
    });
    const accepted = decision.accept();

    expect(accepted.impactScope).toBe(5);
    expect(accepted.downstreamTaskIds).toEqual(['task-a', 'task-b']);
    expect(accepted.downstreamGoalIds).toEqual(['goal-x']);
  });

  it('relatedTaskIds defaults to empty array without explicit prop', () => {
    const decision = DecisionRequest.create(BASE_PROPS);
    expect(decision.relatedTaskIds).toEqual([]);
  });
});
