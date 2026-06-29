import { describe, it, expect, vi } from 'vitest';
import {
  decodeStrategy,
  generateInsights,
  extractJsonObject,
  extractJsonStringArray,
  type DecodedStrategy,
} from './llm-analysis.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';

/** 构造 mock LiteLLMClient(只暴露 decodeStrategy/generateInsights 用到的方法) */
function mockLlm(content: string | null, configured = true) {
  return {
    isConfigured: () => configured,
    chatCompletion: vi.fn().mockResolvedValue({
      choices: content === null ? [] : [{ message: { content } }],
    }),
  } as unknown as LiteLLMClient;
}

function mockThrowingLlm() {
  return {
    isConfigured: () => true,
    chatCompletion: vi.fn().mockRejectedValue(new Error('upstream down')),
  } as unknown as LiteLLMClient;
}

const VALID_DECODED: DecodedStrategy = {
  questions: [{ id: 'q1', question: '核心目标是什么?', purpose: 'clarify' }],
  hypotheses: [{ id: 'h1', statement: '可实现 80%', baselineValue: 50, targetValue: 80 }],
  constraints: ['资源有限'],
  suggestedL1Objectives: [{ title: '明确指标', keyQuestion: '哪些指标?' }],
};

describe('extractJsonObject', () => {
  it('parses bare JSON', () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
  });
  it('parses ```json fenced block', () => {
    expect(extractJsonObject('```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('parses ``` fenced block without lang tag', () => {
    expect(extractJsonObject('结果:\n```\n{"a":1}\n```')).toEqual({ a: 1 });
  });
  it('parses by brace extraction when surrounding text', () => {
    expect(extractJsonObject('好的,{"a":1} 这就是')).toEqual({ a: 1 });
  });
  it('returns null for non-JSON', () => {
    expect(extractJsonObject('not json at all')).toBeNull();
  });
  it('returns null for empty/null', () => {
    expect(extractJsonObject('')).toBeNull();
    expect(extractJsonObject(null)).toBeNull();
    expect(extractJsonObject(undefined)).toBeNull();
  });
});

describe('extractJsonStringArray', () => {
  it('parses bare string array', () => {
    expect(extractJsonStringArray('["a","b"]')).toEqual(['a', 'b']);
  });
  it('parses object with insights field', () => {
    expect(extractJsonStringArray('{"insights":["x","y"]}')).toEqual(['x', 'y']);
  });
  it('filters non-string and empty', () => {
    expect(extractJsonStringArray('["a","",1,null,"b"]')).toEqual(['a', 'b']);
  });
  it('returns [] for non-array', () => {
    expect(extractJsonStringArray('{"foo":1}')).toEqual([]);
    expect(extractJsonStringArray('not json')).toEqual([]);
  });
});

describe('decodeStrategy', () => {
  it('returns 503 when llm is null', async () => {
    const r = await decodeStrategy('intent', null, 'glm-4-flash');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });
  it('returns 503 when llm not configured', async () => {
    const llm = mockLlm(JSON.stringify(VALID_DECODED), false);
    const r = await decodeStrategy('intent', llm, 'glm-4-flash');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });
  it('returns 503 when model empty', async () => {
    const llm = mockLlm(JSON.stringify(VALID_DECODED));
    const r = await decodeStrategy('intent', llm, '');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(503);
  });
  it('returns decoded data for bare JSON', async () => {
    const llm = mockLlm(JSON.stringify(VALID_DECODED));
    const r = await decodeStrategy('东南亚营收翻倍', llm, 'glm-4-flash');
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.questions).toHaveLength(1);
      expect(r.data.hypotheses[0].targetValue).toBe(80);
      expect(llm.chatCompletion).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'glm-4-flash' })
      );
    }
  });
  it('returns decoded data for ```json fenced output', async () => {
    const llm = mockLlm('```json\n' + JSON.stringify(VALID_DECODED) + '\n```');
    const r = await decodeStrategy('intent', llm, 'glm-4-flash');
    expect(r.ok).toBe(true);
  });
  it('returns 502 when LLM output not parseable', async () => {
    const llm = mockLlm('无法解析的文本');
    const r = await decodeStrategy('intent', llm, 'glm-4-flash');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(502);
  });
  it('returns 502 when all decoded fields empty', async () => {
    const llm = mockLlm(JSON.stringify({ questions: [], hypotheses: [], constraints: [] }));
    const r = await decodeStrategy('intent', llm, 'glm-4-flash');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(502);
  });
  it('returns 502 when chatCompletion throws', async () => {
    const llm = mockThrowingLlm();
    const r = await decodeStrategy('intent', llm, 'glm-4-flash');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(502);
  });
  it('returns 502 when choices empty (null content)', async () => {
    const llm = mockLlm(null);
    const r = await decodeStrategy('intent', llm, 'glm-4-flash');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.status).toBe(502);
  });
});

describe('generateInsights', () => {
  const human = [{ score: 70 }, { score: 80 }];
  const ai = [{ score: 85 }];

  it('returns [] when llm is null', async () => {
    expect(await generateInsights(human, ai, null, 'glm-4-flash')).toEqual([]);
  });
  it('returns [] when no metrics data', async () => {
    const llm = mockLlm('["a"]');
    expect(await generateInsights([], [], llm, 'glm-4-flash')).toEqual([]);
  });
  it('returns insights string array for valid output', async () => {
    const llm = mockLlm('["Agent 效率更高","人工质量更稳"]');
    const r = await generateInsights(human, ai, llm, 'glm-4-flash');
    expect(r).toEqual(['Agent 效率更高', '人工质量更稳']);
  });
  it('returns insights from object.insights field', async () => {
    const llm = mockLlm('{"insights":["洞察一"]}');
    const r = await generateInsights(human, ai, llm, 'glm-4-flash');
    expect(r).toEqual(['洞察一']);
  });
  it('returns [] when chatCompletion throws', async () => {
    const llm = mockThrowingLlm();
    expect(await generateInsights(human, ai, llm, 'glm-4-flash')).toEqual([]);
  });
  it('returns [] when output not parseable', async () => {
    const llm = mockLlm('随便一段文字');
    expect(await generateInsights(human, ai, llm, 'glm-4-flash')).toEqual([]);
  });
});
