import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  AgentExecutor,
  detectIntentByRules,
  type ILLMClient,
  type IMapStore,
  type TaskArtifact,
} from './agent-executor.js';

function makeTaskStore(): IMapStore<TaskArtifact> {
  const map = new Map<string, TaskArtifact>();
  return { get: (k) => map.get(k), set: (k, v) => map.set(k, v) };
}

function makeLLMClient(response: string | null, available = true): ILLMClient {
  return {
    isAvailable: available,
    chatCompletion: vi.fn(async () => (response === null ? null : { content: response })),
  };
}

describe('detectIntentByRules', () => {
  it('detects board keywords', () => {
    expect(detectIntentByRules('创建一个项目看板', '').intent).toBe('board');
    expect(detectIntentByRules('用kanban管理任务', '').intent).toBe('board');
    expect(detectIntentByRules('sprint计划', '').intent).toBe('board');
  });

  it('detects app keywords', () => {
    expect(detectIntentByRules('帮我做个天气应用', '').intent).toBe('app');
    expect(detectIntentByRules('创建应用', '').intent).toBe('app');
    expect(detectIntentByRules('开发一个小工具', '').intent).toBe('app');
  });

  it('detects app via regex pattern', () => {
    expect(detectIntentByRules('搭建一个页面', '').intent).toBe('app');
    expect(detectIntentByRules('写个小程序', '').intent).toBe('app');
  });

  it('detects doc keywords', () => {
    expect(detectIntentByRules('写文档', '').intent).toBe('doc');
    expect(detectIntentByRules('撰写技术报告', '').intent).toBe('doc');
    expect(detectIntentByRules('帮我写API文档', '').intent).toBe('doc');
  });

  it('detects doc via regex pattern', () => {
    expect(detectIntentByRules('起草一份用户指南', '').intent).toBe('doc');
    expect(detectIntentByRules('生成一份操作手册', '').intent).toBe('doc');
  });

  it('detects task keywords in responseText', () => {
    expect(detectIntentByRules('', '开始扫描系统').intent).toBe('task');
    expect(detectIntentByRules('', '正在进行审计').intent).toBe('task');
    expect(detectIntentByRules('', '部署到生产环境').intent).toBe('task');
  });

  it('task name includes keyword', () => {
    const result = detectIntentByRules('', '开始安全扫描');
    expect(result.intent).toBe('task');
    expect(result.name).toContain('扫描');
  });

  it('returns null for ordinary conversation', () => {
    expect(detectIntentByRules('你好', '你好！有什么可以帮助你的？').intent).toBeNull();
    expect(detectIntentByRules('今天天气怎么样', '今天阳光明媚').intent).toBeNull();
  });

  it('board takes priority over app/doc/task', () => {
    expect(detectIntentByRules('创建看板应用', '开始扫描').intent).toBe('board');
  });

  it('app takes priority over doc/task', () => {
    expect(detectIntentByRules('创建应用写文档', '').intent).toBe('app');
  });
});

describe('AgentExecutor', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('uses keyword fallback when no LLM client', async () => {
    const broadcast = vi.fn();
    const executor = new AgentExecutor(null, { tasks: makeTaskStore() }, broadcast);
    const result = await executor.execute('', '开始审计代码', 's1');
    expect(result.intent).toBe('task');
    expect(result.artifactId).toBeDefined();
    expect(broadcast).toHaveBeenCalledWith(
      'artifact:created',
      expect.objectContaining({ type: 'task' })
    );
    executor.stop();
  });

  it('returns null intent for ordinary conversation without LLM', async () => {
    const executor = new AgentExecutor(null, { tasks: makeTaskStore() }, vi.fn());
    const result = await executor.execute('你好', '你好！', 's1');
    expect(result.intent).toBeNull();
    expect(result.artifactId).toBeUndefined();
    executor.stop();
  });

  it('uses LLM response when valid JSON returned', async () => {
    const llm = makeLLMClient(
      JSON.stringify({ intent: 'doc', name: '技术文档', description: 'API 文档' })
    );
    const broadcast = vi.fn();
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, broadcast);
    const result = await executor.execute('写一份技术文档', '好的', 's1');
    expect(result.intent).toBe('doc');
    expect(result.artifactType).toBe('doc');
    expect(llm.chatCompletion).toHaveBeenCalledTimes(1);
    executor.stop();
  });

  it('falls back to rules when LLM returns null', async () => {
    const llm = makeLLMClient(null);
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, vi.fn());
    const result = await executor.execute('', '开始扫描', 's1');
    expect(result.intent).toBe('task');
    executor.stop();
  });

  it('falls back to rules when LLM throws', async () => {
    const llm: ILLMClient = {
      isAvailable: true,
      chatCompletion: vi.fn(async () => {
        throw new Error('API error');
      }),
    };
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, vi.fn());
    const result = await executor.execute('', '开始部署', 's1');
    expect(result.intent).toBe('task');
    executor.stop();
  });

  it('falls back to rules when LLM returns invalid JSON', async () => {
    const llm = makeLLMClient('not json at all');
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, vi.fn());
    const result = await executor.execute('', '开始监控', 's1');
    expect(result.intent).toBe('task');
    executor.stop();
  });

  it('falls back when LLM is not available', async () => {
    const llm = makeLLMClient('{}', false);
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, vi.fn());
    const result = await executor.execute('', '开始测试', 's1');
    expect(result.intent).toBe('task');
    executor.stop();
  });

  it('returns null when LLM returns unknown intent', async () => {
    const llm = makeLLMClient(JSON.stringify({ intent: 'unknown_type', name: 'x' }));
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, vi.fn());
    const result = await executor.execute('你好', '你好', 's1');
    expect(result.intent).toBeNull();
    executor.stop();
  });

  it('creates board artifact via LLM', async () => {
    const llm = makeLLMClient(JSON.stringify({ intent: 'board', name: '项目面板' }));
    const broadcast = vi.fn();
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, broadcast);
    const result = await executor.execute('创建看板', '好的', 's1');
    expect(result.intent).toBe('board');
    expect(broadcast).toHaveBeenCalledWith(
      'artifact:created',
      expect.objectContaining({ type: 'board' })
    );
    executor.stop();
  });

  it('creates app artifact via LLM', async () => {
    const llm = makeLLMClient(JSON.stringify({ intent: 'app', name: '天气应用' }));
    const broadcast = vi.fn();
    const executor = new AgentExecutor(llm, { tasks: makeTaskStore() }, broadcast);
    const result = await executor.execute('做个天气应用', '好的', 's1');
    expect(result.intent).toBe('app');
    executor.stop();
  });

  it('stores task artifact in task store', async () => {
    const store = makeTaskStore();
    const executor = new AgentExecutor(null, { tasks: store }, vi.fn());
    const result = await executor.execute('', '开始分析数据', 's1');
    expect(result.artifactId).toBeDefined();
    const task = store.get(result.artifactId!);
    expect(task).toBeDefined();
    expect(task!.status).toBe('running');
    executor.stop();
  });

  it('stop clears progress timers', async () => {
    const executor = new AgentExecutor(null, { tasks: makeTaskStore() }, vi.fn());
    await executor.execute('', '开始优化', 's1');
    executor.stop();
  });
});
