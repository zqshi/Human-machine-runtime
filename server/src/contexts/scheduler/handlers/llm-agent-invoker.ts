/**
 * LlmAgentInvoker —— AgentInvoker 的默认实现
 *
 * 背景：项目当前无统一的「主动驱动数字员工实例」入口，故先用 LiteLLM 直接
 * 发起一次 chat 调用作为占位实现，跑通定时任务闭环。
 * 待数字员工主动执行能力就绪后，替换本实现即可（接口不变）。
 */

import type { LiteLLMClient } from '../../gateway/clients/litellm-client.js';
import type { AgentInvoker, AgentInvokeInput, AgentInvokeOutput } from '../agent-invoker.js';

export interface LlmAgentInvokerOptions {
  /** 兜底模型：payload 未指定 modelId 时使用 */
  defaultModel?: string;
}

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: unknown } }>;
  usage?: Record<string, unknown>;
}

export class LlmAgentInvoker implements AgentInvoker {
  constructor(private litellm: LiteLLMClient, private opts: LlmAgentInvokerOptions = {}) {}

  async invoke(input: AgentInvokeInput): Promise<AgentInvokeOutput> {
    const model = input.modelId || this.opts.defaultModel;
    if (!model) {
      throw new Error('agent 任务缺少 modelId，且系统未配置默认模型');
    }

    const res = (await this.litellm.chatCompletion({
      model,
      messages: [{ role: 'user', content: input.prompt }],
      metadata: {
        instance_id: input.instanceId,
        ...(input.sessionId ? { session_id: input.sessionId } : {}),
        source: 'scheduled_task',
      },
    })) as ChatCompletionResponse;

    const rawContent = res?.choices?.[0]?.message?.content;
    const conclusion =
      typeof rawContent === 'string' ? rawContent : JSON.stringify(rawContent ?? '');

    return {
      conclusion,
      outputPayload: { model, instanceId: input.instanceId, choice: res?.choices?.[0] ?? null },
      metadata: { model, usage: res?.usage ?? null },
    };
  }
}
