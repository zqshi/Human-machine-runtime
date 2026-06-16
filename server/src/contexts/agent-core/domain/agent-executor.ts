/**
 * AgentExecutor — LLM 驱动的意图分析 + Artifact 生成引擎
 *
 * 接收用户消息 + AI 回复，调 LLM 判断是否需要创建执行产物（task/app/doc/board），
 * 创建后通过 broadcast 推送 SSE 事件驱动前端更新。
 *
 * LLM 不可用时 fallback 到关键词规则匹配。
 */

import { newId } from '../../../shared/utils.js';

// ── Types ────────────────────────────────────────────────────────────

export type ArtifactIntent = 'task' | 'app' | 'doc' | 'board';

export interface IntentResult {
  intent: ArtifactIntent | null;
  name?: string;
  description?: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatCompletionOptions {
  temperature?: number;
  maxTokens?: number;
  responseFormat?: { type: string };
}

export interface ChatCompletionResult {
  content: string | null;
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
  status: 'running' | 'completed';
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

export interface ExecuteResult {
  intent: ArtifactIntent | null;
  artifactId?: string;
  artifactType?: ArtifactIntent;
}

// ── Pure helpers ─────────────────────────────────────────────────────

function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
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

interface TaskConfig {
  name: string;
  color: string;
  subtasks: string[];
}

const TASK_CONFIG: Record<string, TaskConfig> = {
  扫描: {
    name: '安全扫描',
    color: '#FF9500',
    subtasks: ['端口扫描', '漏洞检测', '报告生成'],
  },
  审计: {
    name: '代码审计',
    color: '#FF3B30',
    subtasks: ['代码扫描', '规则匹配', '风险评估'],
  },
  分析: {
    name: '数据分析',
    color: '#007AFF',
    subtasks: ['数据采集', '统计分析', '可视化'],
  },
  测试: {
    name: '测试执行',
    color: '#34C759',
    subtasks: ['用例生成', '执行测试', '结果汇总'],
  },
  部署: {
    name: '部署准备',
    color: '#5856D6',
    subtasks: ['环境检查', '构建打包', '灰度发布'],
  },
  优化: {
    name: '性能优化',
    color: '#00D4B8',
    subtasks: ['性能剖析', '瓶颈定位', '优化实施'],
  },
  监控: {
    name: '实时监控',
    color: '#AF52DE',
    subtasks: ['指标采集', '异常检测', '告警配置'],
  },
};

function createTaskArtifact(intentResult: IntentResult, agentId: string): TaskArtifact {
  const taskId = newId('task');
  const now = Date.now();
  const keyword = TASK_KEYWORDS.find((kw) => (intentResult.name ?? '').includes(kw));
  const config: TaskConfig = (keyword && TASK_CONFIG[keyword]) || {
    name: intentResult.name || '执行任务',
    color: '#00D4B8',
    subtasks: ['准备中', '执行中', '完成'],
  };

  return {
    id: taskId,
    agentId,
    todoId: `todo-${taskId}`,
    name: config.name,
    status: 'running',
    progress: rand(5, 15),
    subtasks: config.subtasks.map(
      (name, i): SubtaskEntry => ({
        id: `${taskId}-s${i + 1}`,
        name,
        status: i === 0 ? 'running' : 'pending',
      })
    ),
    logs: [
      {
        timestamp: now,
        level: 'INFO',
        message: `任务已创建：${config.name}`,
      },
      {
        timestamp: now + 100,
        level: 'INFO',
        message: `开始执行 ${config.subtasks[0]}...`,
      },
    ],
    color: config.color,
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
    stage: 'designing',
    codeSnapshots: [
      {
        html: '<div class="app-container"><h1>构建中...</h1></div>',
        css: '.app-container { padding: 20px; text-align: center; }',
        js: '// initializing...',
        timestamp: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function createDocArtifact(intentResult: IntentResult): DocArtifact {
  const now = Date.now();
  const sections = ['概述', '背景', '详细内容', '总结'];
  return {
    id: newId('doc'),
    title: intentResult.name || '文档',
    content: '',
    sections: sections.map(
      (title, i): DocSection => ({
        title,
        status: i === 0 ? 'writing' : 'pending',
      })
    ),
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
    columns: [
      { id: 'col-backlog', name: '待办', color: '#64748b' },
      { id: 'col-progress', name: '进行中', color: '#007AFF' },
      { id: 'col-review', name: '评审中', color: '#FF9500' },
      { id: 'col-done', name: '已完成', color: '#34C759' },
    ],
    cards: [
      {
        id: `${id}-c1`,
        title: '需求分析',
        description: '解析用户意图',
        columnId: 'col-progress',
        assignedAgentId: 'sa-dev',
        assignedAgentName: '代码开发',
        priority: 'high',
        tags: ['分析'],
        executionLogs: [],
        reasoningSteps: [],
        status: 'working',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${id}-c2`,
        title: '方案设计',
        description: '设计执行方案',
        columnId: 'col-backlog',
        assignedAgentId: null,
        assignedAgentName: null,
        priority: 'normal',
        tags: ['设计'],
        executionLogs: [],
        reasoningSteps: [],
        status: 'idle',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${id}-c3`,
        title: '实施执行',
        description: '按方案执行',
        columnId: 'col-backlog',
        assignedAgentId: null,
        assignedAgentName: null,
        priority: 'normal',
        tags: ['执行'],
        executionLogs: [],
        reasoningSteps: [],
        status: 'idle',
        createdAt: now,
        updatedAt: now,
      },
      {
        id: `${id}-c4`,
        title: '验收确认',
        description: '验证执行结果',
        columnId: 'col-backlog',
        assignedAgentId: null,
        assignedAgentName: null,
        priority: 'low',
        tags: ['验收'],
        executionLogs: [],
        reasoningSteps: [],
        status: 'idle',
        createdAt: now,
        updatedAt: now,
      },
    ],
    agentIds: ['sa-dev', 'sa-data', 'sa-security', 'sa-ops'],
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
  private _progressTimers: ReturnType<typeof setTimeout>[] = [];

  constructor(llmClient: ILLMClient | null, stores: AgentExecutorStores, broadcast: BroadcastFn) {
    this.llmClient = llmClient;
    this.taskStore = stores.tasks;
    this.broadcast = broadcast;
  }

  async execute(userText: string, responseText: string, sessionId: string): Promise<ExecuteResult> {
    const intentResult = await this._classifyIntent(userText, responseText);
    if (!intentResult || !intentResult.intent) {
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

    this._startProgressSimulation(intentResult.intent, artifact.id, sessionId);

    return {
      intent: intentResult.intent,
      artifactId: artifact.id,
      artifactType: intentResult.intent,
    };
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

  private _startProgressSimulation(
    type: ArtifactIntent,
    artifactId: string,
    sessionId: string
  ): void {
    if (type === 'task') {
      this._simulateTaskProgress(artifactId, sessionId);
    } else if (type === 'app') {
      this._simulateAppProgress(artifactId, sessionId);
    } else if (type === 'doc') {
      this._simulateDocProgress(artifactId, sessionId);
    } else if (type === 'board') {
      this._simulateBoardProgress(artifactId, sessionId);
    }
  }

  private _simulateTaskProgress(taskId: string, sessionId: string): void {
    let progress = rand(5, 15);
    const subtaskCount = 3;
    let currentSubtask = 0;

    const timer = setInterval(() => {
      progress = Math.min(100, progress + rand(8, 18));
      const newSubtask = Math.min(subtaskCount - 1, Math.floor(progress / (100 / subtaskCount)));

      if (newSubtask > currentSubtask) {
        currentSubtask = newSubtask;
      }

      this.broadcast('artifact:progress', {
        type: 'task',
        id: taskId,
        sessionId,
        progress,
        currentSubtask,
        status: progress >= 100 ? 'completed' : 'running',
      });

      const task = this.taskStore.get(taskId);
      if (task) {
        const updated: TaskArtifact = {
          ...task,
          progress,
          status: progress >= 100 ? 'completed' : 'running',
          subtasks: (task.subtasks || []).map(
            (st, i): SubtaskEntry => ({
              ...st,
              status: i < currentSubtask ? 'success' : i === currentSubtask ? 'running' : 'pending',
            })
          ),
          updatedAt: Date.now(),
        };
        this.taskStore.set(taskId, updated);
        this.broadcast('task:updated', {
          id: taskId,
          progress,
          status: updated.status,
        });
      }

      if (progress >= 100) {
        clearInterval(timer);
        this.broadcast('artifact:completed', {
          type: 'task',
          id: taskId,
          sessionId,
          summary: '任务执行完成',
        });
      }
    }, 4000);

    this._progressTimers.push(timer);
  }

  private _simulateAppProgress(appId: string, sessionId: string): void {
    const stages: Array<{ delay: number; stage: string }> = [
      { delay: 2500, stage: 'building' },
      { delay: 6000, stage: 'preview' },
      { delay: 9000, stage: 'done' },
    ];
    for (const { delay, stage } of stages) {
      const timer = setTimeout(() => {
        this.broadcast('artifact:progress', {
          type: 'app',
          id: appId,
          sessionId,
          stage,
        });
        if (stage === 'done') {
          this.broadcast('artifact:completed', {
            type: 'app',
            id: appId,
            sessionId,
            summary: '应用构建完成',
          });
        }
      }, delay);
      this._progressTimers.push(timer);
    }
  }

  private _simulateDocProgress(docId: string, sessionId: string): void {
    const sectionCount = 4;
    for (let i = 0; i < sectionCount; i++) {
      const timer = setTimeout(
        () => {
          this.broadcast('artifact:progress', {
            type: 'doc',
            id: docId,
            sessionId,
            sectionIndex: i,
            totalSections: sectionCount,
          });
          if (i === sectionCount - 1) {
            this.broadcast('artifact:completed', {
              type: 'doc',
              id: docId,
              sessionId,
              summary: '文档生成完毕',
            });
          }
        },
        (i + 1) * 2500
      );
      this._progressTimers.push(timer);
    }
  }

  private _simulateBoardProgress(boardId: string, sessionId: string): void {
    let tick = 0;
    const timer = setInterval(() => {
      tick++;
      this.broadcast('artifact:progress', {
        type: 'board',
        id: boardId,
        sessionId,
        tick,
      });
      if (tick >= 5) {
        clearInterval(timer);
        this.broadcast('artifact:completed', {
          type: 'board',
          id: boardId,
          sessionId,
          summary: '看板任务编排完成',
        });
      }
    }, 5000);
    this._progressTimers.push(timer);
  }

  stop(): void {
    for (const t of this._progressTimers) {
      clearTimeout(t);
      clearInterval(t);
    }
    this._progressTimers = [];
  }
}
