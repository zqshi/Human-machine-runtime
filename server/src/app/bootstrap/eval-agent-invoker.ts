/**
 * eval Agent 执行器(v1.7)— 实现 IEvalAgentPort,Agent 多轮工具调用循环。
 *
 * 放 bootstrap(组装根)而非 eval-benchmark domain:它依赖 LiteLLMClient + ToolManagementService
 * (跨聚合),eval-benchmark domain 只依赖 IEvalAgentPort 接口(守 §1.3)。
 *
 * 流程:ToolDefinition → OpenAI tools schema → 多轮 chatCompletion(首回带 tools)→
 * 解析 tool_calls → 调真实 ToolManagementService.executeTool → 累积轨迹 → 二次调 → 至 conclusion。
 * maxRounds 防失控(默认 5)。
 */
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import type { ToolDefinitionRepository } from '../../db/repositories/tool-registry-repository.js';
import type {
  IEvalAgentPort,
  EvalAgentExecuteInput,
  EvalAgentExecuteResult,
  EvalToolCall,
} from '../../contexts/eval-benchmark/eval-agent-port.js';

/** OpenAI tool_calls 格式(LLM 返回) */
interface LlmToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface ChatChoice {
  message?: {
    content?: string | null;
    tool_calls?: LlmToolCall[];
  };
}
interface ChatResponse {
  choices?: ChatChoice[];
  usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number };
}

const DEFAULT_MAX_ROUNDS = 5;
const ROUND_TIMEOUT_MS = 60_000;

export class EvalAgentInvoker implements IEvalAgentPort {
  constructor(
    private readonly litellm: LiteLLMClient,
    private readonly toolMgmt: ToolManagementService,
    private readonly toolDefRepo: ToolDefinitionRepository
  ) {}

  async execute(input: EvalAgentExecuteInput): Promise<EvalAgentExecuteResult> {
    const { tenantId, instanceId, prompt, modelId } = input;
    const model = modelId;
    if (!model) {
      return {
        conclusion: '',
        toolCalls: [],
        tokenUsage: { prompt: 0, completion: 0, total: 0 },
        status: 'error',
        errorMessage: 'modelId required',
      };
    }

    // 加载可用工具定义(按 toolDefinitionIds,空则无工具纯文本回复)
    const defIds = input.toolDefinitionIds ?? [];
    const definitions = defIds.length > 0 ? await this.toolDefRepo.findByIds(defIds) : [];
    // ToolDefinition → OpenAI tools schema(只取 enabled + tenantId 匹配的)
    const tools = definitions
      .filter((d) => d.enabled && d.tenantId === tenantId)
      .map((d) => ({
        type: 'function' as const,
        function: {
          name: d.name,
          description: d.description ?? d.name,
          parameters: d.inputSchema ?? { type: 'object', properties: {} },
        },
      }));
    // name → definitionId 映射(执行时按 name 找 id)
    const nameToDefId = new Map(definitions.map((d) => [d.name, d.id]));

    const messages: unknown[] = [{ role: 'user', content: prompt }];
    const toolCalls: EvalToolCall[] = [];
    let totalPrompt = 0;
    let totalCompletion = 0;
    const maxRounds = input.maxRounds ?? DEFAULT_MAX_ROUNDS;

    for (let round = 0; round < maxRounds; round++) {
      const res = (await this.litellm.chatCompletion({
        model,
        messages: messages as never,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? 'auto' : undefined,
        timeout: ROUND_TIMEOUT_MS,
      } as never)) as ChatResponse;

      const usage = res.usage;
      totalPrompt += usage?.prompt_tokens ?? 0;
      totalCompletion += usage?.completion_tokens ?? 0;

      const msg = res.choices?.[0]?.message;
      // 无 tool_calls → 最终 conclusion
      if (!msg?.tool_calls || msg.tool_calls.length === 0) {
        return {
          conclusion: msg?.content ?? '',
          toolCalls,
          tokenUsage: {
            prompt: totalPrompt,
            completion: totalCompletion,
            total: totalPrompt + totalCompletion,
          },
          status: 'ok',
        };
      }

      // 有 tool_calls → 追加 assistant message + 执行工具 + 追加 tool results
      messages.push({
        role: 'assistant',
        content: msg.content ?? null,
        tool_calls: msg.tool_calls,
      });
      for (const tc of msg.tool_calls) {
        const defId = nameToDefId.get(tc.function.name);
        let parsedArgs: Record<string, unknown>;
        try {
          parsedArgs = JSON.parse(tc.function.arguments || '{}');
        } catch {
          parsedArgs = { _raw: tc.function.arguments };
        }
        const toolCall: EvalToolCall = {
          toolName: tc.function.name,
          definitionId: defId ?? tc.function.name,
          arguments: parsedArgs,
          result: null,
          status: 'success',
        };
        if (!defId) {
          toolCall.status = 'error';
          toolCall.result = { error: `tool ${tc.function.name} not available` };
        } else {
          try {
            const result = await this.toolMgmt.executeTool(defId, parsedArgs, {
              tenantId,
              callerId: 'eval',
              instanceId,
            });
            toolCall.result = result;
            toolCall.status = result.success ? 'success' : 'error';
          } catch (err) {
            toolCall.status = 'error';
            toolCall.result = { error: err instanceof Error ? err.message : String(err) };
          }
        }
        toolCalls.push(toolCall);
        // 回传 tool result(OpenAI 格式:role=tool, tool_call_id, content)
        messages.push({
          role: 'tool',
          tool_call_id: tc.id,
          content:
            typeof toolCall.result === 'string' ? toolCall.result : JSON.stringify(toolCall.result),
        });
      }
    }

    // 达 maxRounds 仍未 conclusion → timeout
    return {
      conclusion: '',
      toolCalls,
      tokenUsage: {
        prompt: totalPrompt,
        completion: totalCompletion,
        total: totalPrompt + totalCompletion,
      },
      status: 'timeout',
      errorMessage: `agent did not conclude within ${maxRounds} rounds`,
    };
  }
}
