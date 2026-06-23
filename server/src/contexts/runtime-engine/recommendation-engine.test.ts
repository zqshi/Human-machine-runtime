import { describe, it, expect, vi } from 'vitest';
import {
  RecommendationEngine,
  type RecommendationLlmClient,
  type RecentDecisionsProvider,
} from './recommendation-engine.js';
import type { NormalizedMessage } from './message-normalizer.js';

function makeMsg(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    id: 'msg-1',
    originalId: 'orig-1',
    channelType: 'matrix',
    sender: { id: 'sender-1', name: 'Alice', channel: 'matrix' },
    intent: 'approval',
    urgency: 'high',
    body: '请审批采购单',
    entities: [],
    relatedMessageIds: [],
    receivedAt: new Date('2026-06-22'),
    normalizedAt: new Date('2026-06-22'),
    metadata: {},
    ...overrides,
  } as NormalizedMessage;
}

function makeLlmClient(response: string | null, available = true): RecommendationLlmClient {
  return {
    isAvailable: available,
    chatCompletion: vi.fn(async () => ({ content: response })),
  };
}

describe('RecommendationEngine', () => {
  describe('规则路径(无 LLM)', () => {
    it('生成主推荐 + 标识 contextUsed', async () => {
      const engine = new RecommendationEngine();
      const result = await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      expect(result.recommendations.length).toBeGreaterThanOrEqual(1);
      expect(result.contextUsed).toContain('message_intent');
      expect(result.contextUsed).toContain('message_urgency');
    });

    it('LLM 不可用(isAvailable=false)时降级规则', async () => {
      const llm = makeLlmClient(null, false);
      const engine = new RecommendationEngine(llm);
      const result = await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      expect(result.contextUsed).not.toContain('llm');
      expect(llm.chatCompletion).not.toHaveBeenCalled();
    });

    it('LLM 可用但返回 null 时降级规则', async () => {
      const llm = makeLlmClient(null, true);
      const engine = new RecommendationEngine(llm);
      const result = await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      // 规则路径执行
      expect(result.contextUsed).toContain('message_intent');
      expect(result.contextUsed).not.toContain('llm');
    });
  });

  describe('LLM 路径', () => {
    it('LLM 可用 + 返回合法 JSON → 走 LLM 推荐', async () => {
      const validResponse = JSON.stringify({
        recommendations: [
          {
            action: '审批通过并通知 Alice',
            confidence: 0.9,
            reasoning: '采购金额在阈值内',
            risks: ['合规校验未完成'],
            alternatives: [],
            estimatedImpact: 'medium',
          },
        ],
      });
      const llm = makeLlmClient(validResponse);
      const engine = new RecommendationEngine(llm);
      const result = await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      expect(result.contextUsed).toContain('llm');
      expect(result.recommendations[0]!.action).toBe('审批通过并通知 Alice');
      expect(llm.chatCompletion).toHaveBeenCalledTimes(1);
    });

    it('ctx.historicalDecisions 为空时,调 recentDecisionsProvider 取历史', async () => {
      const provider: RecentDecisionsProvider = vi.fn(async () => [
        {
          id: 'd-1',
          summary: '上次的采购审批',
          outcome: 'accepted',
          decidedAt: new Date(),
          similarity: 0.8,
        },
      ]);
      const llm = makeLlmClient(JSON.stringify({ recommendations: [] }));
      const engine = new RecommendationEngine(llm, provider);
      await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [], // 空 → 触发 provider
        dataPoints: [],
      });
      expect(provider).toHaveBeenCalledTimes(1);
    });

    it('ctx.historicalDecisions 非空时,不调 provider', async () => {
      const provider: RecentDecisionsProvider = vi.fn(async () => []);
      const llm = makeLlmClient(JSON.stringify({ recommendations: [] }));
      const engine = new RecommendationEngine(llm, provider);
      await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [
          { id: 'd', summary: 's', outcome: 'accepted', decidedAt: new Date(), similarity: 0.5 },
        ],
        dataPoints: [],
      });
      expect(provider).not.toHaveBeenCalled();
    });

    it('LLM 返回空 recommendations 时降级规则', async () => {
      const llm = makeLlmClient(JSON.stringify({ recommendations: [] }));
      const engine = new RecommendationEngine(llm);
      const result = await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      expect(result.contextUsed).not.toContain('llm');
    });

    it('LLM 抛异常时降级规则', async () => {
      const llm: RecommendationLlmClient = {
        isAvailable: true,
        chatCompletion: vi.fn(async () => {
          throw new Error('upstream timeout');
        }),
      };
      const engine = new RecommendationEngine(llm);
      const result = await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      expect(result.contextUsed).toContain('message_intent');
      expect(result.contextUsed).not.toContain('llm');
    });

    it('provider 抛异常时仍能调 LLM(空 historical)', async () => {
      const provider: RecentDecisionsProvider = vi.fn(async () => {
        throw new Error('db down');
      });
      const validResponse = JSON.stringify({
        recommendations: [
          {
            action: 'A',
            confidence: 0.5,
            reasoning: '',
            risks: [],
            alternatives: [],
            estimatedImpact: 'low',
          },
        ],
      });
      const llm = makeLlmClient(validResponse);
      const engine = new RecommendationEngine(llm, provider);
      const result = await engine.generateRecommendations({
        triggeredBy: makeMsg(),
        relatedMessages: [],
        historicalDecisions: [],
        dataPoints: [],
      });
      expect(result.contextUsed).toContain('llm');
      expect(result.recommendations[0]!.action).toBe('A');
    });
  });
});
