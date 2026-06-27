/**
 * AgentRuntimePort — Agent 对话运行时抽象(治本 D8)。
 *
 * useAgentChat 经此 port 调用对话后端,不硬绑 weKnoraApi/cockpitApiAdapter,
 * 运行时可按 AgentDefinition.runtime.runtimeType 替换(claude/cockpit/hermes)。
 *
 * 与 AgentRuntime.ts(运行状态实体)区分:本文件是「对话运行时」接口,彼为「运行状态」值对象。
 * 命名同为 AgentRuntime* 但语义不同,按文件后缀(Port vs 实体类)区分。
 */
export type GuardrailType = 'keyword' | 'regex' | 'intent';
export type GuardrailAction = 'block' | 'review';

export interface GuardrailRule {
  id: string;
  type: GuardrailType;
  /** 匹配模式:keyword=关键词、regex=正则源码、intent=意图描述 */
  pattern: string;
  action: GuardrailAction;
  /** 拒答原因(记审计/回显) */
  reason: string;
}

/** Agent 人设与拒答声明(对齐后端 AgentPersonaSpec) */
export interface PersonaSpec {
  /** 人设 system prompt(软约束,注入 prompt;空则不注入) */
  systemPrompt: string;
  /** 拒答规则(硬约束;空=不拦截) */
  guardrails: GuardrailRule[];
  /** 命中拒答时的回复话术 */
  refusalResponse: string;
}

export interface GuardrailCheckResult {
  /** 是否直接拒答(block 命中) */
  blocked: boolean;
  /** 命中的规则(block 或 review;null=无命中) */
  matchedRule: GuardrailRule | null;
  /** 是否需要 LLM 复核(review 命中) */
  needReview: boolean;
}

/** 对话流式回调(port 实现透传给调用方) */
export interface AgentChatCallbacks {
  onChunk: (text: string) => void;
  onSources?: (sources: { title: string; id: string }[]) => void;
  onDone: () => void;
  onError: (err: Error) => void;
  signal?: AbortSignal;
}

export interface AgentChatInput {
  sessionId: string;
  prompt: string;
  /** 当前实例 id(cockpit chat fallback body 需要) */
  instanceId?: string | null;
  /** 人设(软约束 systemPrompt 注入 prompt;guardrails 由调用方先拦截) */
  persona?: PersonaSpec;
  /**
   * 对话历史(多轮记忆,修复"无记忆"缺陷)。OpenAI messages 格式:
   * role='user'|'assistant',content 为消息文本。后端 /api/cockpit/chat
   * 已支持 body.history(chat.ts),前端此前不传致每轮失忆。
   * 由 useAgentChat 从 store 历史消息转换(CoTMessage role 'agent' → 'assistant')。
   */
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

/**
 * Agent 对话运行时 port(治本 D8:运行时可替换)。
 *
 * 实现位于 infrastructure 层(WeKnoraRuntimePort/CockpitRuntimePort),
 * 按 AgentDefinition.runtime.runtimeType 路由。
 */
export interface IAgentRuntimePort {
  /** 流式对话。注入 persona.systemPrompt(软约束)到 prompt 前置。 */
  chat(input: AgentChatInput, cb: AgentChatCallbacks): Promise<void>;
  /** 非流式 fallback(可选,WeKnora ask 模式) */
  ask?(prompt: string): Promise<{ answer: string; sources: { title: string; id: string }[] }>;
}
