import { describe, it, expect } from 'vitest';
import { buildPrompt, parseLlmResponse } from './recommendation-prompt.js';
import type { NormalizedMessage } from './message-normalizer.js';
import type { HistoricalDecision } from './recommendation-engine.js';

function makeMsg(overrides: Partial<NormalizedMessage> = {}): NormalizedMessage {
  return {
    id: 'msg-1',
    originalId: 'orig-1',
    channelType: 'matrix',
    sender: { id: 'sender-1', name: 'Alice', channel: 'matrix' },
    intent: 'approval',
    urgency: 'high',
    body: '请审批这份采购单',
    entities: [],
    relatedMessageIds: [],
    receivedAt: new Date('2026-06-22'),
    normalizedAt: new Date('2026-06-22'),
    metadata: {},
    ...overrides,
  } as NormalizedMessage;
}

describe('buildPrompt', () => {
  it('system 提示词要求严格 JSON 输出', () => {
    const [system] = buildPrompt(makeMsg(), []);
    expect(system.role).toBe('system');
    expect(system.content).toContain('JSON');
    expect(system.content).toContain('recommendations');
    expect(system.content).toContain('confidence');
  });

  it('user 消息包含 channelType / sender / intent / urgency / content', () => {
    const [, user] = buildPrompt(makeMsg(), []);
    expect(user.role).toBe('user');
    expect(user.content).toContain('matrix');
    expect(user.content).toContain('Alice');
    expect(user.content).toContain('approval');
    expect(user.content).toContain('high');
    expect(user.content).toContain('请审批这份采购单');
  });

  it('无历史决策时显示 (无历史决策)', () => {
    const [, user] = buildPrompt(makeMsg(), []);
    expect(user.content).toContain('(无历史决策)');
  });

  it('有历史决策时按序号列出(最多 10 条)', () => {
    const history: HistoricalDecision[] = Array.from({ length: 15 }, (_, i) => ({
      id: `d-${i}`,
      summary: `历史决策 ${i}`,
      outcome: 'accepted' as const,
      decidedAt: new Date(),
      similarity: 0.5 + i * 0.01,
    }));
    const [, user] = buildPrompt(makeMsg(), history);
    expect(user.content).toContain('1. 历史决策 0');
    expect(user.content).toContain('10. 历史决策 9');
    expect(user.content).not.toContain('11. 历史决策 10');
  });

  it('content 过长被截断', () => {
    const long = 'x'.repeat(800);
    const [, user] = buildPrompt(makeMsg({ body: long }), []);
    expect(user.content).toContain('...');
    expect(user.content.length).toBeLessThan(long.length + 500);
  });
});

describe('parseLlmResponse', () => {
  it('解析合法 JSON 返回 Recommendation 数组', () => {
    const text = JSON.stringify({
      recommendations: [
        {
          action: '审批通过',
          confidence: 0.85,
          reasoning: '金额在阈值内',
          risks: ['合规校验未完成'],
          alternatives: [{ action: '人工复核', tradeoff: '延迟 1 天' }],
          estimatedImpact: 'medium',
        },
      ],
    });
    const recs = parseLlmResponse(text);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.action).toBe('审批通过');
    expect(recs[0]!.confidence).toBeCloseTo(0.85);
    expect(recs[0]!.risks).toEqual(['合规校验未完成']);
    expect(recs[0]!.alternatives).toEqual([{ action: '人工复核', tradeoff: '延迟 1 天' }]);
    expect(recs[0]!.estimatedImpact).toBe('medium');
    expect(recs[0]!.id).toMatch(/^rec_llm_\d+_0$/);
  });

  it('剥离 ```json 围栏', () => {
    const text =
      '```json\n{"recommendations":[{"action":"a","confidence":0.5,"reasoning":"","risks":[],"alternatives":[],"estimatedImpact":"low"}]}\n```';
    const recs = parseLlmResponse(text);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.action).toBe('a');
  });

  it('剥离前后噪声文本', () => {
    const text =
      '好的,以下是建议:\n{"recommendations":[{"action":"a","confidence":0.5,"reasoning":"","risks":[],"alternatives":[],"estimatedImpact":"low"}]}\n以上为参考。';
    const recs = parseLlmResponse(text);
    expect(recs).toHaveLength(1);
  });

  it('解析多条推荐', () => {
    const text = JSON.stringify({
      recommendations: [
        {
          action: 'A',
          confidence: 0.8,
          reasoning: '',
          risks: [],
          alternatives: [],
          estimatedImpact: 'high',
        },
        {
          action: 'B',
          confidence: 0.5,
          reasoning: '',
          risks: [],
          alternatives: [],
          estimatedImpact: 'low',
        },
      ],
    });
    const recs = parseLlmResponse(text);
    expect(recs).toHaveLength(2);
  });

  it('null/undefined/空字符串返回空数组', () => {
    expect(parseLlmResponse(null)).toEqual([]);
    expect(parseLlmResponse(undefined)).toEqual([]);
    expect(parseLlmResponse('')).toEqual([]);
  });

  it('非 JSON 文本返回空数组', () => {
    expect(parseLlmResponse('抱歉,我无法处理这个请求')).toEqual([]);
  });

  it('JSON 缺失 recommendations 字段返回空数组', () => {
    expect(parseLlmResponse(JSON.stringify({ foo: 'bar' }))).toEqual([]);
  });

  it('单条推荐缺失 action 字段被丢弃', () => {
    const text = JSON.stringify({
      recommendations: [
        { confidence: 0.5 }, // 无 action
        {
          action: 'valid',
          confidence: 0.5,
          reasoning: '',
          risks: [],
          alternatives: [],
          estimatedImpact: 'low',
        },
      ],
    });
    const recs = parseLlmResponse(text);
    expect(recs).toHaveLength(1);
    expect(recs[0]!.action).toBe('valid');
  });

  it('confidence 超出 [0,1] 被 clamp', () => {
    const text = JSON.stringify({
      recommendations: [
        {
          action: 'a',
          confidence: 1.5,
          reasoning: '',
          risks: [],
          alternatives: [],
          estimatedImpact: 'low',
        },
        {
          action: 'b',
          confidence: -0.3,
          reasoning: '',
          risks: [],
          alternatives: [],
          estimatedImpact: 'low',
        },
      ],
    });
    const recs = parseLlmResponse(text);
    expect(recs[0]!.confidence).toBe(1);
    expect(recs[1]!.confidence).toBe(0);
  });

  it('estimatedImpact 非法值降级为 medium', () => {
    const text = JSON.stringify({
      recommendations: [
        {
          action: 'a',
          confidence: 0.5,
          reasoning: '',
          risks: [],
          alternatives: [],
          estimatedImpact: 'invalid',
        },
      ],
    });
    const recs = parseLlmResponse(text);
    expect(recs[0]!.estimatedImpact).toBe('medium');
  });
});
