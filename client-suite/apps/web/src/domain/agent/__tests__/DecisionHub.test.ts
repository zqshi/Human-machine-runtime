import { describe, it, expect, beforeEach } from 'vitest';
import { DecisionHub, type DecisionTrigger, type DecisionTriggerHandler } from '../DecisionHub';
import type { DecisionUrgency } from '../DecisionRequest';

function makeTrigger(overrides: Partial<DecisionTrigger> = {}): DecisionTrigger {
  return {
    source: 'risk-rule-trigger',
    sourceId: 'rule-001',
    title: '测试决策',
    context: '测试上下文',
    urgency: 'high' as DecisionUrgency,
    deadline: Date.now() + 3_600_000,
    relatedEntities: { taskId: 'task-001' },
    ...overrides,
  };
}

describe('DecisionHub', () => {
  beforeEach(() => {
    DecisionHub.unregisterTrigger('risk-rule-trigger');
    DecisionHub.unregisterTrigger('milestone-arrival');
    DecisionHub.unregisterTrigger('collaboration-node');
    DecisionHub.unregisterTrigger('agent-discovery');
    DecisionHub.unregisterTrigger('external-alarm');
  });

  it('trigger creates a DecisionRequest without handler', async () => {
    const result = await DecisionHub.trigger(makeTrigger());
    expect(result.id).toMatch(/^dr-/);
    expect(result.title).toBe('测试决策');
    expect(result.urgency).toBe('high');
  });

  it('trigger uses registered handler preprocess', async () => {
    const handler: DecisionTriggerHandler = {
      preprocess: async (trigger) => ({ ...trigger, title: '已预处理' }),
    };
    DecisionHub.registerTrigger('risk-rule-trigger', handler);
    const result = await DecisionHub.trigger(makeTrigger());
    expect(result.title).toBe('已预处理');
  });

  it('trigger calls handler postprocess', async () => {
    let postprocessed = false;
    const handler: DecisionTriggerHandler = {
      preprocess: async (t) => t,
      postprocess: async () => {
        postprocessed = true;
      },
    };
    DecisionHub.registerTrigger('risk-rule-trigger', handler);
    await DecisionHub.trigger(makeTrigger());
    expect(postprocessed).toBe(true);
  });

  it('hasHandler returns correct state', () => {
    expect(DecisionHub.hasHandler('risk-rule-trigger')).toBe(false);
    DecisionHub.registerTrigger('risk-rule-trigger', { preprocess: async (t) => t });
    expect(DecisionHub.hasHandler('risk-rule-trigger')).toBe(true);
  });

  it('unregisterTrigger removes handler', () => {
    DecisionHub.registerTrigger('milestone-arrival', { preprocess: async (t) => t });
    DecisionHub.unregisterTrigger('milestone-arrival');
    expect(DecisionHub.hasHandler('milestone-arrival')).toBe(false);
  });

  it('getRegisteredSources lists all registered', () => {
    DecisionHub.registerTrigger('risk-rule-trigger', { preprocess: async (t) => t });
    DecisionHub.registerTrigger('external-alarm', { preprocess: async (t) => t });
    const sources = DecisionHub.getRegisteredSources();
    expect(sources).toContain('risk-rule-trigger');
    expect(sources).toContain('external-alarm');
  });

  it('generates default recommendation per source', async () => {
    const result = await DecisionHub.trigger(makeTrigger({ source: 'milestone-arrival' }));
    expect(result.recommendation.label).toBe('继续下一个里程碑');
  });

  it('triggerBatch handles multiple triggers', async () => {
    const triggers = [makeTrigger(), makeTrigger({ title: '第二个决策' })];
    const results = await DecisionHub.triggerBatch(triggers);
    expect(results).toHaveLength(2);
  });

  it('trigger calculates impactScope from downstream arrays', async () => {
    const result = await DecisionHub.trigger(
      makeTrigger({
        downstreamTaskIds: ['t1', 't2'],
        downstreamGoalIds: ['g1'],
      })
    );
    expect(result.impactScope).toBe(3);
  });

  it('setEventEmitter fires on decision creation', async () => {
    let emitted: { decisionId: string; agentId: string; urgency: string } | null = null;
    DecisionHub.setEventEmitter({
      emitDecisionCreated: (p) => {
        emitted = p;
      },
    });
    const result = await DecisionHub.trigger(makeTrigger());
    expect(emitted).not.toBeNull();
    expect(emitted!.decisionId).toBe(result.id);
    DecisionHub.setEventEmitter({ emitDecisionCreated: () => {} });
  });
});
