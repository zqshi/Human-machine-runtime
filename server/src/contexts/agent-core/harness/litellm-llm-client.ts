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
      // 保留 tool_calls(tool role 回填 + assistant 工具请求),透传 tools/tool_choice(底层 v1.7 已支持)
      const mappedMessages = messages.map((m) => {
        if (m.role === 'tool') {
          return { role: 'tool', content: m.content, tool_call_id: m.toolCallId };
        }
        if (m.role === 'assistant' && m.toolCalls?.length) {
          return { role: 'assistant', content: m.content, tool_calls: m.toolCalls };
        }
        return { role: m.role, content: m.content };
      });
      const res = await this.client.chatCompletion.call(this.client, {
        model: this.model,
        messages: mappedMessages,
        temperature: options?.temperature ?? this.defaults?.temperature,
        max_tokens: options?.maxTokens ?? this.defaults?.maxTokens,
        tools: options?.tools,
        tool_choice: options?.toolChoice,
      });
      const content = extractContent(res);
      const toolCalls = extractToolCalls(res);
      const usage = extractUsage(res);
      // 无内容也无工具调用 → 视为空(交由调用方 fallback)
      if (content === null && (!toolCalls || toolCalls.length === 0)) {
        llmCallsTotal.labels(this.model, 'empty').inc();
        return null;
      }
      llmCallsTotal.labels(this.model, 'success').inc();
      llmCallDurationSeconds.labels(this.model, 'success').observe((Date.now() - start) / 1000);
      return { content, toolCalls: toolCalls ?? undefined, usage: usage ?? undefined };
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

/**
 * 从 OpenAI 兼容响应提取工具调用(解析 choices[0].message.tool_calls)。
 * 结构异常/无 tool_calls 返回 null。ToolLoopExecutor 据此决定是否进入工具执行轮。
 */
function extractToolCalls(res: unknown): import('../domain/agent-executor.js').ToolCall[] | null {
  if (!res || typeof res !== 'object') return null;
  const choices = (res as { choices?: unknown }).choices;
  if (!Array.isArray(choices) || choices.length === 0) return null;
  const message = (choices[0] as { message?: { tool_calls?: unknown } } | undefined)?.message;
  const raw = message?.tool_calls;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const calls: import('../domain/agent-executor.js').ToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const tc = item as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    if (typeof tc.id !== 'string' || tc.type !== 'function') continue;
    if (!tc.function || typeof tc.function.name !== 'string') continue;
    calls.push({
      id: tc.id,
      type: 'function',
      function: {
        name: tc.function.name,
        arguments: typeof tc.function.arguments === 'string' ? tc.function.arguments : '{}',
      },
    });
  }
  return calls.length > 0 ? calls : null;
}

/**
 * 从 OpenAI 兼容响应提取 token 用量(usage.prompt_tokens / completion_tokens)。
 * 结构异常/无 usage 返回 null。ToolLoopExecutor 据此累计各轮用量入账统计/计费。
 */
function extractUsage(res: unknown): { promptTokens: number; completionTokens: number } | null {
  if (!res || typeof res !== 'object') return null;
  const u = (res as { usage?: { prompt_tokens?: unknown; completion_tokens?: unknown } }).usage;
  if (!u) return null;
  const promptTokens = Number(u.prompt_tokens);
  const completionTokens = Number(u.completion_tokens);
  if (!Number.isFinite(promptTokens) || !Number.isFinite(completionTokens)) return null;
  return { promptTokens, completionTokens };
}
