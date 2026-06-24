/**
 * eval Agent 执行 port(v1.7)— eval 触发真实 Agent 执行取 conclusion + toolCalls。
 *
 * 守 §1.3:eval-benchmark 不直接依赖 agent-core/scheduler。bootstrap 用 LlmAgentInvoker
 * (扩工具循环,真实 ToolManagementService.executeTool 执行工具)适配实现。
 *
 * 设计:execute 同步返回 conclusion + toolCalls(内部多轮工具调用循环),非 dispatchTask 异步。
 * eval 需同步拿结果评分,故用 AgentInvoker 模式(同步),工具执行接真实 tool-management。
 */

export interface EvalAgentExecuteInput {
  /** 数字员工/实例 ID(工具调用 callerId/鉴权) */
  instanceId: string;
  /** tenantId(工具鉴权 + ToolCallLog 归属) */
  tenantId: string;
  /** 评测任务描述(Agent prompt) */
  prompt: string;
  /** 指定模型(可选) */
  modelId?: string;
  /** 可用工具 definitionId 列表(限定 Agent 可调工具集,按 case expectedTools) */
  toolDefinitionIds?: string[];
  /** 最大工具调用轮次(防失控,默认 5) */
  maxRounds?: number;
}

export interface EvalToolCall {
  toolName: string;
  /** 工具 definitionId */
  definitionId: string;
  /** 调用参数 */
  arguments: Record<string, unknown>;
  /** 执行结果 */
  result: unknown;
  /** 状态 success/error */
  status: string;
}

export interface EvalAgentExecuteResult {
  /** Agent 最终回复文本(conclusion) */
  conclusion: string;
  /** 工具调用轨迹(trajectory 评测用) */
  toolCalls: EvalToolCall[];
  /** token 用量(累计各轮) */
  tokenUsage: { prompt: number; completion: number; total: number };
  /** 状态 ok/error/timeout */
  status: 'ok' | 'error' | 'timeout';
  /** 失败原因(status!=ok) */
  errorMessage?: string;
}

export interface IEvalAgentPort {
  execute(input: EvalAgentExecuteInput): Promise<EvalAgentExecuteResult>;
}
