/**
 * ToolLoopExecutor — LLM 驱动的多轮工具循环执行器(不被模型绑定)。
 *
 * 实例任务真执行:经 ILLMClient(底层 LiteLLM,OpenAI 兼容,调任意国产模型)做多轮工具循环:
 *   1. discover 租户可用工具 → 转 OpenAI function schema 传 LLM
 *   2. LLM 返回 tool_calls → 解析 name→definitionId → registry.invoke 真执行(审批/凭证/租户隔离/计费/callLog 全生效)
 *   3. 工具结果回填 tool role 消息 → 续轮 LLM,直到无 tool_calls 或达 maxTurns
 *
 * 与 worker(claude-agent-sdk)路径A 区别:不经 SDK 协议,不被 Anthropic tool_use 绑定,
 * 国产模型(支持 OpenAI function calling)即可用。registry.invoke 复用 ToolRegistryService
 * 现有闭环(审批 gate/凭证解密/租户隔离/计费/callLog),执行器只编排不重写。
 *
 * 替代 CockpitAdapter 假桩(simulateProgress)接到 dispatchTask 主链路。
 */
import type { ILLMClient, ChatMessage, ToolDefinition } from './agent-executor.js';
import type {
  IToolRegistry,
  ToolEndpoint,
  ToolInvocationResult,
} from '../../tool-management/tool-registry.js';

export interface ToolLoopInput {
  prompt: string;
  tenantId: string;
  instanceId?: string;
  sessionId?: string;
  model?: string;
  maxTurns?: number;
}

export interface ToolCallLogEntry {
  toolName: string;
  toolCallId: string;
  success: boolean;
  result?: unknown;
  error?: string;
  logId?: string;
  pendingApproval?: { approvalId: string; reason: string };
}

export interface ToolLoopResult {
  conclusion: string;
  toolCallsLog: ToolCallLogEntry[];
  /** LLM 调用次数(含工具轮 + 最终结论轮) */
  turns: number;
  /** 累计 token 用量(各轮 prompt+completion 之和),供 adapter 透传 → bootstrap 入账统计/计费 */
  tokenUsage?: { prompt: number; completion: number };
}

const DEFAULT_MAX_TURNS = 8;
const SYSTEM_PROMPT =
  '你是一个能调用工具完成任务的 Agent。需要信息时调用工具,拿到结果后继续推理,最终给出结论。';

export class ToolLoopExecutor {
  constructor(
    private readonly llmClient: ILLMClient,
    private readonly registry: IToolRegistry
  ) {}

  async run(input: ToolLoopInput): Promise<ToolLoopResult> {
    if (!this.llmClient.isAvailable) {
      return {
        conclusion: 'LLM 服务不可用,无法执行任务(请检查 LiteLLM/模型配置)',
        toolCallsLog: [],
        turns: 0,
      };
    }

    const tenantId = input.tenantId;
    const callerId = input.instanceId ?? 'tool-loop-executor';
    const instanceId = input.instanceId;
    const maxTurns = input.maxTurns ?? DEFAULT_MAX_TURNS;

    // 1. discover 租户可用工具 → name→definitionId 映射 + OpenAI function schema
    const endpoints = await this.registry.discover({ tenantId, enabledOnly: true });
    const nameToDef: Map<string, ToolEndpoint> = new Map();
    const tools: ToolDefinition[] = [];
    for (const ep of endpoints) {
      nameToDef.set(ep.name, ep);
      tools.push({
        type: 'function',
        function: {
          name: ep.name,
          description: ep.description ?? ep.name,
          parameters: ep.inputSchema ?? { type: 'object', properties: {} },
        },
      });
    }

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: input.prompt },
    ];

    const toolCallsLog: ToolCallLogEntry[] = [];
    let conclusion = '';
    let turns = 0;
    let totalPromptTokens = 0;
    let totalCompletionTokens = 0;

    // 2. 多轮循环
    while (turns < maxTurns) {
      turns++;
      const result = await this.llmClient.chatCompletion(messages, { tools, toolChoice: 'auto' });
      if (!result) {
        // LLM 降级返回 null(底层异常/空响应)
        conclusion = conclusion || 'LLM 未返回有效响应,任务终止。';
        break;
      }
      // 累计 token 用量(各轮 LLM 真实消耗),供入账统计/计费
      if (result.usage) {
        totalPromptTokens += result.usage.promptTokens;
        totalCompletionTokens += result.usage.completionTokens;
      }

      const toolCalls = result.toolCalls;
      // 无工具调用 → content 即结论,结束循环
      if (!toolCalls || toolCalls.length === 0) {
        conclusion = result.content ?? '';
        break;
      }

      // 回填 assistant 的 tool_calls(OpenAI 协议要求 assistant 轮带 tool_calls 后跟 tool 轮)
      messages.push({
        role: 'assistant',
        content: result.content ?? '',
        toolCalls,
      });

      // 3. 逐个执行工具调用 → 回填 tool role
      for (const tc of toolCalls) {
        const ep = nameToDef.get(tc.function.name);
        if (!ep) {
          // 未注册工具 → 记失败,回填错误给 LLM(让其继续/改用其他工具)
          toolCallsLog.push({
            toolName: tc.function.name,
            toolCallId: tc.id,
            success: false,
            error: `tool "${tc.function.name}" not registered`,
          });
          messages.push({
            role: 'tool',
            content: JSON.stringify({ error: `tool "${tc.function.name}" not registered` }),
            toolCallId: tc.id,
          });
          continue;
        }

        const params = safeParseArgs(tc.function.arguments);
        let invokeResult: ToolInvocationResult;
        try {
          invokeResult = await this.registry.invoke({
            toolId: ep.definitionId,
            params,
            context: { tenantId, instanceId, callerId },
          });
        } catch (err) {
          invokeResult = {
            success: false,
            data: null,
            error: err instanceof Error ? err.message : String(err),
            durationMs: 0,
            logId: '',
          };
        }

        toolCallsLog.push({
          toolName: tc.function.name,
          toolCallId: tc.id,
          success: invokeResult.success,
          result: invokeResult.data,
          error: invokeResult.error,
          logId: invokeResult.logId || undefined,
          pendingApproval: invokeResult.pendingApproval,
        });

        // 回填工具结果(pendingApproval 也回填,让 LLM 知道待审批)
        const toolContent = invokeResult.pendingApproval
          ? JSON.stringify({ pendingApproval: invokeResult.pendingApproval })
          : invokeResult.success
            ? JSON.stringify(invokeResult.data ?? {})
            : JSON.stringify({ error: invokeResult.error ?? 'tool failed' });
        messages.push({
          role: 'tool',
          content: toolContent,
          toolCallId: tc.id,
        });
      }
      // 继续下一轮 LLM(带 tool 结果推理)
    }

    // maxTurns 用尽仍无 conclusion → 兜底
    if (!conclusion) {
      conclusion = `任务执行已达最大轮次(${maxTurns}),执行了 ${toolCallsLog.length} 次工具调用,未生成最终结论。`;
    }

    return {
      conclusion,
      toolCallsLog,
      turns,
      tokenUsage: { prompt: totalPromptTokens, completion: totalCompletionTokens },
    };
  }
}

/** 安全解析 LLM 返回的 arguments(JSON 字符串),失败返回空对象 */
function safeParseArgs(args: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(args);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}
