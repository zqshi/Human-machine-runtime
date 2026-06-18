import { AgentExecutor } from './agent-executor.js';
import type { ILLMClient, AgentExecutorStores } from './agent-executor.js';
import type { IToolRegistry, ToolEndpoint } from '../../tool-management/tool-registry.js';

/** LLM mock：返回指定 intent（null 触发工具兜底）。 */
function makeLlm(intent: 'null'): ILLMClient {
  return {
    isAvailable: true,
    chatCompletion: vi.fn().mockResolvedValue({ content: JSON.stringify({ intent: null }) }),
  } as unknown as ILLMClient;
}

function makeStores(): AgentExecutorStores {
  const map = new Map<string, unknown>();
  return {
    tasks: { get: (k: string) => map.get(k), set: (k: string, v: unknown) => map.set(k, v) },
  } as AgentExecutorStores;
}

const sqlTool: ToolEndpoint = {
  definitionId: 'd1',
  sourceId: 's1',
  tenantId: 't1',
  name: 'SQL',
  description: null,
  executionType: 'mcp_call',
  inputSchema: null,
  tags: [],
  enabled: true,
};

function makeRegistry(
  tools: ToolEndpoint[],
  invokeResult: { success: boolean; data?: unknown; logId: string; durationMs: number }
) {
  return {
    discover: vi.fn().mockResolvedValue(tools),
    invoke: vi.fn().mockResolvedValue(invokeResult),
  } as unknown as IToolRegistry;
}

describe('AgentExecutor 工具调用兜底', () => {
  it('未注入 registry → 不触发兜底，返回 intent:null', async () => {
    const exec = new AgentExecutor(makeLlm('null'), makeStores(), vi.fn());
    const r = await exec.execute('用 SQL 查', '', 'sess', 't1');
    expect(r.intent).toBeNull();
    expect(r.toolCall).toBeUndefined();
  });

  it('无 tenantId → 不触发兜底（discover 不调用）', async () => {
    const reg = makeRegistry([sqlTool], {
      success: true,
      data: { ok: 1 },
      logId: 'log1',
      durationMs: 5,
    });
    const exec = new AgentExecutor(makeLlm('null'), makeStores(), vi.fn());
    exec.setToolRegistry(reg);
    const r = await exec.execute('用 SQL 查', '', 'sess');
    expect(r.toolCall).toBeUndefined();
    expect(reg.discover).not.toHaveBeenCalled();
  });

  it('用户消息匹配工具 name → 调用 invoke + 广播 tool artifact', async () => {
    const reg = makeRegistry([sqlTool], {
      success: true,
      data: { ok: 1 },
      logId: 'log1',
      durationMs: 5,
    });
    const broadcast = vi.fn();
    const exec = new AgentExecutor(makeLlm('null'), makeStores(), broadcast);
    exec.setToolRegistry(reg);
    const r = await exec.execute('帮我用 SQL 查询', '', 'sess', 't1');
    expect(r.intent).toBeNull();
    expect(r.toolCall).toBeDefined();
    expect(r.toolCall?.toolName).toBe('SQL');
    expect(r.toolCall?.logId).toBe('log1');
    expect(r.toolCall?.success).toBe(true);
    expect(reg.invoke).toHaveBeenCalledWith({
      toolId: 'd1',
      params: {},
      context: { tenantId: 't1' },
    });
    expect(broadcast).toHaveBeenCalledWith(
      'artifact:created',
      expect.objectContaining({ type: 'tool', sessionId: 'sess' })
    );
  });

  it('无匹配工具 → 不调用 invoke', async () => {
    const reg = makeRegistry([sqlTool], { success: true, logId: 'log1', durationMs: 5 });
    const exec = new AgentExecutor(makeLlm('null'), makeStores(), vi.fn());
    exec.setToolRegistry(reg);
    const r = await exec.execute('一条无关消息', '', 'sess', 't1');
    expect(r.toolCall).toBeUndefined();
    expect(reg.invoke).not.toHaveBeenCalled();
  });

  it('invoke 抛错 → 兜底静默返回 null（不影响主流程）', async () => {
    const reg = {
      discover: vi.fn().mockResolvedValue([sqlTool]),
      invoke: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as IToolRegistry;
    const exec = new AgentExecutor(makeLlm('null'), makeStores(), vi.fn());
    exec.setToolRegistry(reg);
    const r = await exec.execute('用 SQL 查', '', 'sess', 't1');
    expect(r.toolCall).toBeUndefined();
    expect(r.intent).toBeNull();
  });
});
