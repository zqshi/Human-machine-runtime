import { describe, it, expect } from 'vitest';
import { projectDecision } from './decision-projector.js';
import type { NormalizedMessage, MessageIntent, MessageUrgency } from './message-normalizer.js';
import type { Recommendation } from './recommendation-engine.js';

/**
 * projectDecision — 把「归一化消息 + 推荐」投影为待确认的 Decision。
 * 这是「消息 → 决策」链路的核心纯函数：runtime-engine 产出的高优消息，
 * 经 RecommendationEngine 生成推荐后，由它落成 Decision（待人工确认）。
 * 不依赖任何外部状态，便于单测。
 */

function makeMessage(
  over: {
    intent?: MessageIntent;
    urgency?: MessageUrgency;
    body?: string;
  } = {}
): NormalizedMessage {
  return {
    id: 'norm_1',
    originalId: 'msg_1',
    channelType: 'matrix',
    sender: { id: '@user:localhost', channel: 'matrix' },
    intent: over.intent ?? 'alert',
    urgency: over.urgency ?? 'critical',
    body: over.body ?? '生产环境 API 异常，请立即处理',
    entities: [],
    relatedMessageIds: [],
    receivedAt: new Date('2026-06-18T10:00:00Z'),
    normalizedAt: new Date('2026-06-18T10:00:01Z'),
    metadata: {},
  };
}

function makeRec(over: Partial<Recommendation> = {}): Recommendation {
  return {
    id: 'rec_1',
    action: '立即介入并启动应急预案',
    confidence: 0.8,
    reasoning: '基于告警意图判断',
    risks: ['误报导致资源浪费'],
    alternatives: [{ action: '暂缓观察', tradeoff: '可能延误窗口' }],
    estimatedImpact: 'high',
    ...over,
  };
}

describe('projectDecision', () => {
  const NOW = 1_700_000_000_000;

  it('投影为 pending Decision，含正确 urgency / title / context', () => {
    const dec = projectDecision({ message: makeMessage(), recommendation: makeRec() }, NOW);

    expect(dec.responseStatus).toBe('pending');
    expect(dec.urgency).toBe('critical');
    expect(dec.title).toBe('立即介入并启动应急预案'); // 取 recommendation.action
    expect(dec.context).toBe('生产环境 API 异常，请立即处理'); // 取 message.body
    expect(dec.userResponse).toBeNull();
    expect(dec.responseAt).toBeNull();
    expect(dec.createdAt).toBe(NOW);
    expect(dec.updatedAt).toBe(NOW);
  });

  it('deadline 按 urgency 推导（critical = 10 分钟）', () => {
    const dec = projectDecision(
      { message: makeMessage({ urgency: 'critical' }), recommendation: makeRec() },
      NOW
    );
    expect(dec.deadline).toBe(NOW + 10 * 60_000);
  });

  it('recommendation.suggestedDeadline 优先于 urgency 推导', () => {
    const dl = new Date(NOW + 30 * 60_000);
    const dec = projectDecision(
      {
        message: makeMessage({ urgency: 'critical' }),
        recommendation: makeRec({ suggestedDeadline: dl }),
      },
      NOW
    );
    expect(dec.deadline).toBe(dl.getTime());
  });

  it('recommendation 映射为推荐选项，riskLevel 按 urgency 推导（critical→high / high→medium / low→low）', () => {
    const high = projectDecision(
      { message: makeMessage({ urgency: 'critical' }), recommendation: makeRec() },
      NOW
    );
    expect(high.recommendation.label).toBe('立即介入并启动应急预案');
    expect(high.recommendation.reasoning).toBe('基于告警意图判断');
    expect(high.recommendation.riskLevel).toBe('high');
    expect(high.recommendation.id).toBeTruthy();

    const med = projectDecision(
      { message: makeMessage({ urgency: 'high' }), recommendation: makeRec() },
      NOW
    );
    expect(med.recommendation.riskLevel).toBe('medium');

    const low = projectDecision(
      { message: makeMessage({ urgency: 'low' }), recommendation: makeRec() },
      NOW
    );
    expect(low.recommendation.riskLevel).toBe('low');
  });

  it('alternatives 映射为备选选项（含 riskLevel）', () => {
    const dec = projectDecision({ message: makeMessage(), recommendation: makeRec() }, NOW);
    expect(dec.alternatives).toHaveLength(1);
    expect(dec.alternatives[0].label).toBe('暂缓观察');
    expect(['low', 'medium', 'high']).toContain(dec.alternatives[0].riskLevel);
  });

  it('agentId 按 intent 映射，非空', () => {
    const intents: MessageIntent[] = ['alert', 'approval', 'command', 'report', 'inquiry', 'chat'];
    for (const intent of intents) {
      const dec = projectDecision(
        { message: makeMessage({ intent }), recommendation: makeRec() },
        NOW
      );
      expect(dec.agentId, `intent=${intent}`).toBeTruthy();
    }
  });

  it('impactScope ≥ 1，downstream 默认空', () => {
    const dec = projectDecision({ message: makeMessage(), recommendation: makeRec() }, NOW);
    expect(dec.impactScope).toBeGreaterThanOrEqual(1);
    expect(dec.downstreamTaskIds).toEqual([]);
    expect(dec.downstreamGoalIds).toEqual([]);
  });

  it('每次调用生成不同的 id', () => {
    const a = projectDecision({ message: makeMessage(), recommendation: makeRec() }, NOW);
    const b = projectDecision({ message: makeMessage(), recommendation: makeRec() }, NOW);
    expect(a.id).not.toBe(b.id);
  });
});
