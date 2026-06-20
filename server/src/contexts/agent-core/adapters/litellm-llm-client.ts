/**
 * LiteLlmClientAdapter — gateway 层 LiteLLMClient → domain 层 ILLMClient 的适配器。
 *
 * 职责边界：
 * - 重试 / 超时由 BaseGatewayClient 承载（LiteLLMClient.chatCompletion 已带 timeout）
 * - 本 adapter 只做契约转换 + 失败降级：把 OpenAI 兼容原始响应提炼为 { content }，
 *   任何异常或缺结构返回 null，让 AgentExecutor 走关键词 fallback。
 * - 不引入任何 LLM SDK，符合 domain 零外部依赖。
 */

import type { LiteLLMClient } from '../../gateway/clients/litellm-client.js';
import type {
  ILLMClient,
  ChatMessage,
  ChatCompletionOptions,
  ChatCompletionResult,
} from '../domain/agent-executor.js';
import { llmCallsTotal, llmCallDurationSeconds } from '../../../shared/metrics.js';

export interface LiteLlmAdapterDefaults {
  temperature?: number;
  maxTokens?: number;
}

/** 结构化依赖：任何带 chatCompletion 的对象，便于测试注入 mock 而无需构造完整 client */
export interface LiteLlmChatClient {
  chatCompletion: LiteLLMClient['chatCompletion'];
}

export class LiteLlmClientAdapter implements ILLMClient {
  constructor(
    private readonly client: LiteLlmChatClient,
    private readonly model: string,
    private readonly defaults?: LiteLlmAdapterDefaults
  ) {}

  get isAvailable(): boolean {
    return this.model.trim().length > 0;
  }

  async chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult | null> {
    if (!this.isAvailable) return null;
    const start = Date.now();
    try {
      // .call 保留底层 client 的 this（LiteLLMClient.chatCompletion 依赖 this.request）
      const res = await this.client.chatCompletion.call(this.client, {
        model: this.model,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
        temperature: options?.temperature ?? this.defaults?.temperature,
        max_tokens: options?.maxTokens ?? this.defaults?.maxTokens,
      });
      const content = extractContent(res);
      if (content === null) {
        llmCallsTotal.labels(this.model, 'empty').inc();
        return null;
      }
      llmCallsTotal.labels(this.model, 'success').inc();
      llmCallDurationSeconds.labels(this.model, 'success').observe((Date.now() - start) / 1000);
      return { content };
    } catch {
      // 降级：返回 null，交由 AgentExecutor 走关键词 fallback，绝不向上抛打断主流程
      llmCallsTotal.labels(this.model, 'error').inc();
      llmCallDurationSeconds.labels(this.model, 'error').observe((Date.now() - start) / 1000);
      return null;
    }
  }
}

/** 从 OpenAI 兼容响应中安全提取文本，结构异常一律视为不可用 */
function extractContent(res: unknown): string | null {
  if (!res || typeof res !== 'object') return null;
  const choices = (res as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { content?: unknown } } | undefined)?.message;
  const content = message?.content;
  return typeof content === 'string' ? content : null;
}
