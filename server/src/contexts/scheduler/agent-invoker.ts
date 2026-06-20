/**
 * AgentInvoker —— 「主动触发数字员工执行」的抽象接口
 *
 * 背景：项目当前无统一的「主动驱动数字员工实例执行任意 prompt 任务」入口
 * （AgentRuntimeService.execute 是对话副产物提取；ClusterInstanceClient 无任务接口；
 * EvalService 直接调 LLM）。故定义此接口隔离，先给基于 LiteLLMClient 的默认实现
 * （LlmAgentInvoker，见 app/bootstrap 组装），待数字员工主动执行能力就绪后替换实现。
 */

export interface AgentInvokeInput {
  /** 数字员工/实例 ID */
  instanceId: string;
  /** 本次执行的用户指令 */
  prompt: string;
  /** 会话 ID（可选，用于隔离上下文） */
  sessionId?: string;
  /** 指定模型 ID（可选，否则用实例默认） */
  modelId?: string;
}

export interface AgentInvokeOutput {
  /** 产出结论（Agent 回复文本） */
  conclusion: string;
  /** 结构化产出（如解析出的结构化结果） */
  outputPayload?: Record<string, unknown>;
  /** 扩展元数据（token/cost/traceId） */
  metadata?: Record<string, unknown>;
}

export interface AgentInvoker {
  invoke(input: AgentInvokeInput): Promise<AgentInvokeOutput>;
}
