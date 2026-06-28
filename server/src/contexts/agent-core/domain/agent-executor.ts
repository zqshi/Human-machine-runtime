/**
 * AgentExecutor — LLM 驱动的意图分析 + Artifact 生成引擎
 *
 * 接收用户消息 + AI 回复，调 LLM 判断是否需要创建执行产物（task/app/doc/board），
 * 创建后通过 broadcast 推送 SSE 事件驱动前端更新。
 *
 * LLM 不可用时 fallback 到关键词规则匹配。
 */

import { newId } from '../../../shared/utils.js';
import type { IToolRegistry, ToolEndpoint } from '../../tool-management/tool-registry.js';

// ── Types ────────────────────────────────────────────────────────────

export type ArtifactIntent = 'task' | 'app' | 'doc' | 'board';

export interface IntentResult {
  intent: ArtifactIntent | null;
  name?: string;
  description?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** assistant 轮携带的工具调用请求(OpenAI tool_calls 格式,仅 role='assistant' 时有值) */
  toolCalls?: ToolCall[];
  /** tool 轮回填的工具调用 id(仅 role='tool' 时有值,与 assistant.toolCalls[].id 对应) */
  toolCallId?: string;
}

/** OpenAI function calling 工具调用请求(LLM 返回,要求执行某工具)。 */
export interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

/** OpenAI function calling 工具定义(传给 LLM 供其选择)。 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    /** JSON Schema(OpenAI parameters 格式) */
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
  /** v1.7+ 扩展:工具定义(OpenAI function calling),ToolLoopExecutor 用 */
  tools?: ToolDefinition[];
  /** 工具选择策略('auto'/'none'/{type:'function',function:{name}}) */
  toolChoice?: string | { type: string; function?: { name: string } };
}

export interface ChatCompletionResult {
  content: string | null;
  /** LLM 要求的工具调用(解析自响应 message.tool_calls);无则 undefined */
  toolCalls?: ToolCall[];
  /** LLM 返回的 token 用量(OpenAI usage);LiteLlmClientAdapter 提取,供 ToolLoopExecutor 累计入账统计/计费 */
  usage?: { promptTokens: number; completionTokens: number };
}

/** LLM 客户端接口 — domain 只依赖此抽象，不引入任何 SDK */
export interface ILLMClient {
  isAvailable: boolean;
  chatCompletion(
    messages: ChatMessage[],
    options?: ChatCompletionOptions
  ): Promise<ChatCompletionResult | null>;
}

export interface IMapStore<V> {
  get(key: string): V | undefined;
  set(key: string, value: V): void;
}

export type BroadcastFn = (event: string, data: unknown) => void;

export interface AgentExecutorStores {
  tasks: IMapStore<TaskArtifact>;
}

// ── Artifact data shapes ─────────────────────────────────────────────

export interface SubtaskEntry {
  id: string;
  name: string;
  status: 'running' | 'pending' | 'success';
}

export interface LogEntry {
  timestamp: number;
  level: string;
  message: string;
}

export interface TaskArtifact {
  id: string;
  agentId: string;
  todoId: string;
  name: string;
  status: 'queued' | 'running' | 'completed';
  progress: number;
  subtasks: SubtaskEntry[];
  logs: LogEntry[];
  color: string;
  createdAt: number;
  updatedAt: number;
}

export interface CodeSnapshot {
  html: string;
  css: string;
  js: string;
  timestamp: number;
}

export interface AppArtifact {
  id: string;
  name: string;
  description: string;
  stage: string;
  codeSnapshots: CodeSnapshot[];
  createdAt: number;
  updatedAt: number;
}

export interface DocSection {
  title: string;
  status: 'writing' | 'pending';
}

export interface DocArtifact {
  id: string;
  title: string;
  content: string;
  sections: DocSection[];
  createdAt: number;
  updatedAt: number;
}

export interface BoardColumn {
  id: string;
  name: string;
  color: string;
}

export interface BoardCard {
  id: string;
  title: string;
  description: string;
  columnId: string;
  assignedAgentId: string | null;
  assignedAgentName: string | null;
  priority: 'high' | 'normal' | 'low';
  tags: string[];
  executionLogs: unknown[];
  reasoningSteps: unknown[];
  status: 'working' | 'idle';
  createdAt: number;
  updatedAt: number;
}

export interface BoardArtifact {
  id: string;
  name: string;
  description: string;
  columns: BoardColumn[];
  cards: BoardCard[];
  agentIds: string[];
  createdAt: number;
  updatedAt: number;
}

type Artifact = TaskArtifact | AppArtifact | DocArtifact | BoardArtifact;

/** 工具调用产物（无 task/app/doc/board 意图时的兜底执行物）。 */
export interface ToolCallArtifact {
  id: string;
  toolId: string;
  toolName: string;
  success: boolean;
  result?: unknown;
  error?: string;
  logId: string;
  createdAt: number;
}

export interface ExecuteResult {
  intent: ArtifactIntent | null;
  artifactId?: string;
  artifactType?: ArtifactIntent;
  toolCall?: ToolCallArtifact;
}

// ── Intent classification prompt ─────────────────────────────────────

const INTENT_SYSTEM_PROMPT = `你是一个意图分析引擎。分析用户与 AI 助手的对话，判断是否需要创建执行产物。

规则：
- 如果 AI 回复中包含执行类动作（扫描、审计、分析、检查、部署、测试、监控、优化、生成报告）→ intent: "task"
- 如果用户要求创建应用/工具/页面/小程序/计算器/天气应用/待办应用 → intent: "app"
- 如果用户要求撰写/生成/起草文档/报告/手册/指南/说明书 → intent: "doc"
- 如果用户提到看板/项目管理/任务面板/kanban/sprint/敏捷 → intent: "board"
- 如果只是普通对话、问答、闲聊 → intent: null

严格以 JSON 格式输出，不要输出其他内容：
{ "intent": "task"|"app"|"doc"|"board"|null, "name": "产物名称", "description": "一句话描述" }`;

// ── Fallback keyword detection ───────────────────────────────────────

const TASK_KEYWORDS = ['扫描', '审计', '分析', '检查', '生成报告', '部署', '测试', '优化', '监控'];

const APP_KEYWORDS = [
  '创建应用',
  '做个应用',
  '建一个应用',
  '开发应用',
  '写个应用',
  '天气应用',
  '计算器',
  '待办应用',
  'todo应用',
  '日历应用',
  '小工具',
];

const DOC_KEYWORDS = [
  '写文档',
  '写一篇',
  '生成文档',
  '撰写',
  '帮我写',
  '技术文档',
  '设计文档',
  '需求文档',
  'API文档',
  '操作手册',
  '用户指南',
];

const BOARD_KEYWORDS = [
  '看板',
  '项目板',
  'kanban',
  '项目管理',
  '任务管理',
  '项目看板',
  '任务看板',
  '敏捷看板',
  'sprint',
  '项目面板',
  '任务面板',
];

export function detectIntentByRules(userText: string, responseText: string): IntentResult {
  const combined = `${userText} ${responseText}`;

  if (BOARD_KEYWORDS.some((kw) => combined.includes(kw))) {
    return {
      intent: 'board',
      name: 'Agent 协作看板',
      description: '多 Agent 协同项目看板',
    };
  }
  if (
    APP_KEYWORDS.some((kw) => combined.includes(kw)) ||
    /(?:创建|做|写|开发|搭建).*(?:应用|工具|页面|APP|app|小程序)/.test(combined)
  ) {
    return {
      intent: 'app',
      name: '智能应用',
      description: '根据需求生成的应用',
    };
  }
  if (
    DOC_KEYWORDS.some((kw) => combined.includes(kw)) ||
    /(?:写|撰写|生成|起草).*(?:文档|报告|手册|指南|说明书)/.test(combined)
  ) {
    return { intent: 'doc', name: '文档', description: '生成的文档' };
  }
  const taskKw = TASK_KEYWORDS.find((kw) => responseText.includes(kw));
  if (taskKw) {
    return {
      intent: 'task',
      name: `${taskKw}任务`,
      description: `执行${taskKw}`,
    };
  }
  return { intent: null };
}

// ── Artifact templates ───────────────────────────────────────────────

function createTaskArtifact(intentResult: IntentResult, agentId: string): TaskArtifact {
  const taskId = newId('task');
  const now = Date.now();
  const name = intentResult.name || '执行任务';
  return {
    id: taskId,
    agentId,
    todoId: `todo-${taskId}`,
    name,
    // 诚实化(v2.0 投产清障):意图已识别但未执行(queued),不假装 running/进度推进。
    // 真实执行由用户确认后走 /agent/dispatch(harness.dispatchTask → ToolLoop 真链路)。
    status: 'queued',
    progress: 0,
    subtasks: [],
    logs: [
      {
        timestamp: now,
        level: 'INFO',
        message: `已识别任务意图：${name}（待执行）`,
      },
    ],
    color: '#007AFF',
    createdAt: now,
    updatedAt: now,
  };
}

function createAppArtifact(intentResult: IntentResult): AppArtifact {
  const now = Date.now();
  return {
    id: newId('app'),
    name: intentResult.name || '智能应用',
    description: intentResult.description || '根据需求生成的应用',
    // 诚实化:已识别意图(identified),不伪造"构建中"代码快照。
    stage: 'identified',
    codeSnapshots: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createDocArtifact(intentResult: IntentResult): DocArtifact {
  const now = Date.now();
  return {
    id: newId('doc'),
    title: intentResult.name || '文档',
    content: '',
    // 诚实化:无预填假章节,文档待生成。
    sections: [],
    createdAt: now,
    updatedAt: now,
  };
}

function createBoardArtifact(intentResult: IntentResult): BoardArtifact {
  const now = Date.now();
  const id = newId('board');
  return {
    id,
    name: intentResult.name || 'Agent 协作看板',
    description: intentResult.description || 'Agent 自动编排执行',
    // 诚实化:空看板骨架(列保留,卡片待编排),不伪造假卡片/假 agent 分配。
    columns: [
      { id: 'col-backlog', name: '待办', color: '#64748b' },
      { id: 'col-progress', name: '进行中', color: '#007AFF' },
      { id: 'col-review', name: '评审中', color: '#FF9500' },
      { id: 'col-done', name: '已完成', color: '#34C759' },
    ],
    cards: [],
    agentIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

// ── Main class ───────────────────────────────────────────────────────

const VALID_INTENTS: ArtifactIntent[] = ['task', 'app', 'doc', 'board'];

export class AgentExecutor {
  private readonly llmClient: ILLMClient | null;
  private readonly taskStore: IMapStore<TaskArtifact>;
  private readonly broadcast: BroadcastFn;
  private registry: IToolRegistry | null = null;

  constructor(llmClient: ILLMClient | null, stores: AgentExecutorStores, broadcast: BroadcastFn) {
    this.llmClient = llmClient;
    this.taskStore = stores.tasks;
    this.broadcast = broadcast;
  }

  /** 注入工具注册中心（bootstrap 在 toolRegistry 实例化后调用，解决实例化顺序）。 */
  setToolRegistry(registry: IToolRegistry): void {
    this.registry = registry;
  }

  async execute(
    userText: string,
    responseText: string,
    sessionId: string,
    tenantId?: string
  ): Promise<ExecuteResult> {
    const intentResult = await this._classifyIntent(userText, responseText);
    if (!intentResult || !intentResult.intent) {
      // 无 task/app/doc/board 意图时的工具调用兜底（需 registry + tenantId；可选，零回归）
      if (this.registry && tenantId) {
        const toolCall = await this._tryToolCall(userText, tenantId, sessionId);
        if (toolCall) return { intent: null, toolCall };
      }
      return { intent: null };
    }

    const artifact = this._createArtifact(intentResult);
    if (!artifact) return { intent: null };

    if (intentResult.intent === 'task') {
      this.taskStore.set(artifact.id, artifact as TaskArtifact);
    }

    this.broadcast('artifact:created', {
      type: intentResult.intent,
      id: artifact.id,
      sessionId,
      data: artifact,
    });

    // 诚实化:仅广播意图识别产物(artifact:created),不模拟假进度。
    // task/app/doc/board 意图无真实业务执行;真实执行走 /agent/dispatch(harness.dispatchTask)。

    return {
      intent: intentResult.intent,
      artifactId: artifact.id,
      artifactType: intentResult.intent,
    };
  }

  /**
   * 工具调用兜底：在无 task/app/doc/board 意图时，按用户消息匹配已注册工具并调用。
   * 匹配规则（简化）：用户消息包含工具 name（大小写不敏感）。LLM 精确匹配留待后续。
   * 任一步失败均返回 null（不影响主流程）。
   */
  private async _tryToolCall(
    userText: string,
    tenantId: string,
    sessionId: string
  ): Promise<ToolCallArtifact | null> {
    if (!this.registry) return null;
    try {
      const endpoints: ToolEndpoint[] = await this.registry.discover({
        tenantId,
        enabledOnly: true,
      });
      const lower = userText.toLowerCase();
      const matched = endpoints.find((ep) => lower.includes(ep.name.toLowerCase()));
      if (!matched) return null;
      const result = await this.registry.invoke({
        toolId: matched.definitionId,
        params: {},
        context: { tenantId },
      });
      const artifact: ToolCallArtifact = {
        id: newId('tcall'),
        toolId: matched.definitionId,
        toolName: matched.name,
        success: result.success,
        result: result.data,
        error: result.error,
        logId: result.logId,
        createdAt: Date.now(),
      };
      this.broadcast('artifact:created', {
        type: 'tool',
        id: artifact.id,
        sessionId,
        data: artifact,
      });
      return artifact;
    } catch {
      return null;
    }
  }

  private async _classifyIntent(userText: string, responseText: string): Promise<IntentResult> {
    if (!this.llmClient || !this.llmClient.isAvailable) {
      return detectIntentByRules(userText, responseText);
    }

    try {
      const result = await this.llmClient.chatCompletion(
        [
          { role: 'system', content: INTENT_SYSTEM_PROMPT },
          {
            role: 'user',
            content: `用户消息: "${userText}"\nAI 回复: "${responseText}"`,
          },
        ],
        {
          temperature: 0.1,
          maxTokens: 200,
          responseFormat: { type: 'json_object' },
        }
      );

      if (!result || !result.content) {
        return detectIntentByRules(userText, responseText);
      }

      const parsed = JSON.parse(result.content) as IntentResult;
      if (!parsed.intent || !VALID_INTENTS.includes(parsed.intent)) {
        return { intent: null };
      }
      return parsed;
    } catch {
      return detectIntentByRules(userText, responseText);
    }
  }

  private _createArtifact(intentResult: IntentResult): Artifact | null {
    switch (intentResult.intent) {
      case 'task':
        return createTaskArtifact(intentResult, 'primary');
      case 'app':
        return createAppArtifact(intentResult);
      case 'doc':
        return createDocArtifact(intentResult);
      case 'board':
        return createBoardArtifact(intentResult);
      default:
        return null;
    }
  }

  /**
   * 诚实化(v2.0 投产清障):原 _startProgressSimulation + 4 个 _simulate*Progress 用
   * setInterval/setTimeout 假推进 progress 并广播假 artifact:progress/artifact:completed
   * 事件,伪装任务在执行并完成。实际 task/app/doc/board 意图识别后无真实业务执行——
   * 假进度已全部删除(真实执行走 /agent/dispatch → harness.dispatchTask → ToolLoop 真链路)。
   * stop 保留空实现(harness.stop 仍调用,兼容接口)。
   */
  stop(): void {}
}
