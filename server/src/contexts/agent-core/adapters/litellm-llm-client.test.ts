import { describe, it, expect, vi } from 'vitest';
import { LiteLlmClientAdapter } from './litellm-llm-client.js';
import type { ChatMessage } from '../domain/agent-executor.js';

/**
 * LiteLlmClientAdapter 单元测试
 *
 * 职责：把 gateway 层的 LiteLLMClient（OpenAI 兼容原始响应）
 * 适配成 domain 层的 ILLMClient（{content} | null）。
 * LiteLLM 的重试/超时由 BaseGatewayClient 承载，本 adapter 只负责
 * 契约转换 + 失败降级（返回 null，让 AgentExecutor 走关键词 fallback）。
 */

type LiteLlmLike = {
  chatCompletion: ReturnType<typeof vi.fn>;
};

function makeMockClient(behavior: {
  content?: string;
  raw?: unknown;
  reject?: Error;
}): LiteLlmLike {
  return {
    chatCompletion: vi.fn(async () => {
      if (behavior.reject) throw behavior.reject;
      if (behavior.raw !== undefined) return behavior.raw;
      return { choices: [{ message: { content: behavior.content ?? '' } }] };
    }),
  };
}

describe('LiteLlmClientAdapter', () => {
  it('正常调用：转换 messages 格式并提取 content', async () => {
    const mock = makeMockClient({ content: 'create-task' });
    const adapter = new LiteLlmClientAdapter(mock, 'qwen-plus');

    const messages: ChatMessage[] = [
      { role: 'system', content: '你是意图分类器' },
      { role: 'user', content: '帮我建一个任务' },
    ];
    const result = await adapter.chatCompletion(messages);

    expect(result).toEqual({ content: 'create-task' });
    expect(mock.chatCompletion).toHaveBeenCalledWith({
      model: 'qwen-plus',
      messages: [
        { role: 'system', content: '你是意图分类器' },
        { role: 'user', content: '帮我建一个任务' },
      ],
      temperature: undefined,
      max_tokens: undefined,
    });
  });

  it('LLM 抛错时返回 null（触发 Executor 关键词降级，不向上抛）', async () => {
    const mock = makeMockClient({ reject: new Error('upstream timeout') });
    const adapter = new LiteLlmClientAdapter(mock, 'qwen-plus');

    const result = await adapter.chatCompletion([{ role: 'user', content: 'x' }]);

    expect(result).toBeNull();
  });

  it('响应缺 choices / 结构异常时返回 null', async () => {
    const mockNoChoices = makeMockClient({ raw: {} });
    const mockEmptyChoices = makeMockClient({ raw: { choices: [] } });
    const mockNonString = makeMockClient({ raw: { choices: [{ message: { content: 123 } }] } });

    expect(
      await new LiteLlmClientAdapter(mockNoChoices, 'qwen-plus').chatCompletion([
        { role: 'user', content: 'x' },
      ])
    ).toBeNull();
    expect(
      await new LiteLlmClientAdapter(mockEmptyChoices, 'qwen-plus').chatCompletion([
        { role: 'user', content: 'x' },
      ])
    ).toBeNull();
    expect(
      await new LiteLlmClientAdapter(mockNonString, 'qwen-plus').chatCompletion([
        { role: 'user', content: 'x' },
      ])
    ).toBeNull();
  });

  it('isAvailable：model 非空为 true，空串/空白为 false', () => {
    const mock = makeMockClient({ content: 'x' });
    expect(new LiteLlmClientAdapter(mock, 'qwen-plus').isAvailable).toBe(true);
    expect(new LiteLlmClientAdapter(mock, '').isAvailable).toBe(false);
    expect(new LiteLlmClientAdapter(mock, '   ').isAvailable).toBe(false);
  });

  it('isAvailable 为 false 时 chatCompletion 直接返回 null，不调用底层', async () => {
    const mock = makeMockClient({ content: 'x' });
    const adapter = new LiteLlmClientAdapter(mock, '');

    const result = await adapter.chatCompletion([{ role: 'user', content: 'x' }]);

    expect(result).toBeNull();
    expect(mock.chatCompletion).not.toHaveBeenCalled();
  });

  it('透传调用方 options（temperature/maxTokens），缺省回退构造默认', async () => {
    const mock = makeMockClient({ content: 'x' });

    // 构造时给默认
    const adapterWithDefault = new LiteLlmClientAdapter(mock, 'qwen-plus', {
      temperature: 0.1,
      maxTokens: 512,
    });
    await adapterWithDefault.chatCompletion([{ role: 'user', content: 'x' }]);
    expect(mock.chatCompletion).toHaveBeenLastCalledWith(
      expect.objectContaining({ temperature: 0.1, max_tokens: 512 })
    );

    // 调用方显式覆盖默认
    await adapterWithDefault.chatCompletion([{ role: 'user', content: 'x' }], {
      temperature: 0.7,
      maxTokens: 100,
    });
    expect(mock.chatCompletion).toHaveBeenLastCalledWith(
      expect.objectContaining({ temperature: 0.7, max_tokens: 100 })
    );

    // 无默认、无 options 时为 undefined
    const adapterNoDefault = new LiteLlmClientAdapter(mock, 'qwen-plus');
    await adapterNoDefault.chatCompletion([{ role: 'user', content: 'x' }]);
    expect(mock.chatCompletion).toHaveBeenLastCalledWith(
      expect.objectContaining({ temperature: undefined, max_tokens: undefined })
    );
  });
});
