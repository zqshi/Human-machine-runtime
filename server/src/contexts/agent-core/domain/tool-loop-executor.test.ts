import { describe, it, expect, vi } from 'vitest';
import { ToolLoopExecutor } from './tool-loop-executor.js';
import type { ILLMClient, ChatMessage, ToolCall, ToolDefinition } from './agent-executor.js';
import type {
  IToolRegistry,
  ToolEndpoint,
  ToolInvocationResult,
} from '../../tool-management/tool-registry.js';

function makeLlmClient(responses: Array<{ content?: string | null; toolCalls?: ToolCall[] }>) {
  let i = 0;
  return {
    isAvailable: true,
    chatCompletion: vi.fn(async (_messages: ChatMessage[], _opts?: unknown) => {
      const r = responses[i++] ?? { content: null };
      return { content: r.content ?? null, toolCalls: r.toolCalls };
    }),
  } as unknown as ILLMClient;
}

function makeRegistry(
  opts: {
    endpoints?: ToolEndpoint[];
    invokeResult?: Partial<ToolInvocationResult>;
  } = {}
) {
  const endpoints = opts.endpoints ?? [];
  return {
    discover: vi.fn(async () => endpoints),
    invoke: vi.fn(async (req: { toolId: string; params: Record<string, unknown> }) => ({
      success: true,
      data: { result: 'ok', toolId: req.toolId, params: req.params },
      logId: `log-${req.toolId}`,
      durationMs: 5,
      ...opts.invokeResult,
    })),
  } as unknown as IToolRegistry & {
    invoke: ReturnType<typeof vi.fn>;
    discover: ReturnType<typeof vi.fn>;
  };
}

const baseInput = {
  prompt: '查一下知识库',
  tenantId: 'tn_1',
  instanceId: 'inst-1',
  sessionId: 'sess-1',
  model: 'glm-4-flash',
  maxTurns: 5,
};

const endpoint = (name: string): ToolEndpoint => ({
  definitionId: `def-${name}`,
  sourceId: 'src-1',
  tenantId: 'tn_1',
  name,
  description: `${name} 工具`,
  executionType: 'http' as never,
  inputSchema: { type: 'object', properties: { q: { type: 'string' } } },
  tags: [],
  enabled: true,
});

describe('ToolLoopExecutor', () => {
  it('无工具调用时直接返回 LLM content(单轮,不 invoke)', async () => {
    const llm = makeLlmClient([{ content: '直接回答,无需工具' }]);
    const reg = makeRegistry({ endpoints: [endpoint('search')] });
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run(baseInput);

    expect(result.conclusion).toBe('直接回答,无需工具');
    expect(result.toolCallsLog).toEqual([]);
    expect(reg.invoke).not.toHaveBeenCalled();
    // tools 透传给 LLM(discover 结果转 function schema)
    expect(llm.chatCompletion).toHaveBeenCalledTimes(1);
  });

  it('LLM 返回 tool_calls → invoke 执行 → 回填 tool role → 续轮无 tool_calls → 返回 conclusion', async () => {
    const llm = makeLlmClient([
      {
        content: null,
        toolCalls: [
          { id: 'call_1', type: 'function', function: { name: 'search', arguments: '{"q":"x"}' } },
        ],
      },
      { content: '基于搜索结果:答案是42' },
    ]);
    const reg = makeRegistry({ endpoints: [endpoint('search')] });
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run(baseInput);

    expect(result.conclusion).toBe('基于搜索结果:答案是42');
    expect(result.toolCallsLog).toHaveLength(1);
    expect(result.toolCallsLog[0]).toMatchObject({
      toolName: 'search',
      success: true,
      logId: 'log-def-search',
    });
    // invoke 收到正确的 toolId(definitionId)+ params(解析 arguments JSON)
    expect(reg.invoke).toHaveBeenCalledWith({
      toolId: 'def-search',
      params: { q: 'x' },
      context: { tenantId: 'tn_1', instanceId: 'inst-1', callerId: 'inst-1' },
    });
    // 两轮 LLM 调用(第一轮 tool_calls,第二轮 conclusion)
    expect(llm.chatCompletion).toHaveBeenCalledTimes(2);
    // 第二轮 messages 含 tool role 回填
    const secondCallMessages = llm.chatCompletion.mock.calls[1][0];
    expect(secondCallMessages.some((m) => m.role === 'tool')).toBe(true);
  });

  it('多轮工具调用:连续两轮 tool_calls 后第三轮 conclusion', async () => {
    const llm = makeLlmClient([
      {
        content: null,
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'search', arguments: '{}' } }],
      },
      {
        content: null,
        toolCalls: [{ id: 'c2', type: 'function', function: { name: 'fetch', arguments: '{}' } }],
      },
      { content: '完成' },
    ]);
    const reg = makeRegistry({ endpoints: [endpoint('search'), endpoint('fetch')] });
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run({ ...baseInput, maxTurns: 5 });

    expect(result.conclusion).toBe('完成');
    expect(result.toolCallsLog).toHaveLength(2);
    expect(reg.invoke).toHaveBeenCalledTimes(2);
  });

  it('达 maxTurns 仍有 tool_calls → 截断,返回已执行工具 + 最后 content(不无限循环)', async () => {
    const llm = makeLlmClient([
      {
        content: null,
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'search', arguments: '{}' } }],
      },
      {
        content: null,
        toolCalls: [{ id: 'c2', type: 'function', function: { name: 'search', arguments: '{}' } }],
      },
    ]);
    const reg = makeRegistry({ endpoints: [endpoint('search')] });
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run({ ...baseInput, maxTurns: 2 });

    // 截断:执行了 2 次工具(maxTurns 用尽),conclusion 为最后 content 或兜底
    expect(result.toolCallsLog).toHaveLength(2);
    expect(reg.invoke).toHaveBeenCalledTimes(2);
  });

  it('工具 invoke 失败(success:false)→ 回填错误结果,继续循环(不阻断)', async () => {
    const llm = makeLlmClient([
      {
        content: null,
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'search', arguments: '{}' } }],
      },
      { content: '工具失败了,但我继续回答' },
    ]);
    const reg = makeRegistry({
      endpoints: [endpoint('search')],
      invokeResult: { success: false, data: null, error: 'tool down', logId: 'log-err' },
    });
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run(baseInput);

    expect(result.conclusion).toBe('工具失败了,但我继续回答');
    expect(result.toolCallsLog[0]).toMatchObject({ success: false, error: 'tool down' });
  });

  it('LLM 返回未注册工具名 → 该工具调用记失败,不 invoke,继续循环', async () => {
    const llm = makeLlmClient([
      {
        content: null,
        toolCalls: [
          { id: 'c1', type: 'function', function: { name: 'unknown_tool', arguments: '{}' } },
        ],
      },
      { content: '工具不存在,但继续' },
    ]);
    const reg = makeRegistry({ endpoints: [endpoint('search')] }); // 无 unknown_tool
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run(baseInput);

    expect(reg.invoke).not.toHaveBeenCalled(); // 未注册,不 invoke
    expect(result.toolCallsLog[0]).toMatchObject({ toolName: 'unknown_tool', success: false });
    expect(result.conclusion).toBe('工具不存在,但继续');
  });

  it('LLM 返回 pendingApproval(审批 gate 拦截)→ 记 pending,继续循环', async () => {
    const llm = makeLlmClient([
      {
        content: null,
        toolCalls: [{ id: 'c1', type: 'function', function: { name: 'search', arguments: '{}' } }],
      },
      { content: '待审批' },
    ]);
    const reg = makeRegistry({
      endpoints: [endpoint('search')],
      invokeResult: {
        success: false,
        data: null,
        error: 'pending approval',
        logId: '',
        pendingApproval: { approvalId: 'ap-1', reason: 'high risk' },
      },
    });
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run(baseInput);

    expect(result.toolCallsLog[0]).toMatchObject({ pendingApproval: { approvalId: 'ap-1' } });
  });

  it('LLM 不可用(isAvailable false)→ 返回降级 conclusion,不抛错', async () => {
    const llm = { isAvailable: false, chatCompletion: vi.fn() } as unknown as ILLMClient;
    const reg = makeRegistry({ endpoints: [] });
    const exec = new ToolLoopExecutor(llm, reg);

    const result = await exec.run(baseInput);

    expect(result.conclusion).toContain('不可用'); // 降级提示
    expect(result.toolCallsLog).toEqual([]);
    expect(llm.chatCompletion).not.toHaveBeenCalled();
  });
});
