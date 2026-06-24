import { describe, it, expect, vi } from 'vitest';
import { EvalAgentInvoker } from './eval-agent-invoker.js';
import type { LiteLLMClient } from '../../contexts/gateway/clients/litellm-client.js';
import type { ToolManagementService } from '../../contexts/tool-management/tool-management-service.js';
import type { ToolDefinitionRepository } from '../../db/repositories/tool-registry-repository.js';

function makeLitellm(responses: unknown[]) {
  let call = 0;
  return {
    isConfigured: () => true,
    chatCompletion: vi.fn(async () => {
      const res = responses[call] ?? responses[responses.length - 1];
      call++;
      return res;
    }),
  } as unknown as LiteLLMClient;
}

function makeToolMgmt() {
  return {
    executeTool: vi.fn(async () => ({ success: true, data: { tickets: [] } })),
  } as unknown as ToolManagementService;
}

function makeToolDefRepo(
  defs: Array<{
    id: string;
    name: string;
    enabled: boolean;
    status: string;
    tenantId: string;
    description?: string;
    inputSchema?: unknown;
  }>
) {
  return {
    findByIds: vi.fn(async () => defs),
  } as unknown as ToolDefinitionRepository;
}

describe('EvalAgentInvoker - 工具调用循环(v1.7)', () => {
  it('无工具:首回即 conclusion(无 tool_calls)', async () => {
    const litellm = makeLitellm([
      {
        choices: [{ message: { content: '直接回复,无需工具' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      },
    ]);
    const invoker = new EvalAgentInvoker(litellm, makeToolMgmt(), makeToolDefRepo([]));

    const result = await invoker.execute({
      instanceId: 'inst-1',
      tenantId: 'tn',
      prompt: 'hi',
      modelId: 'qwen-plus',
    });

    expect(result.status).toBe('ok');
    expect(result.conclusion).toBe('直接回复,无需工具');
    expect(result.toolCalls).toHaveLength(0);
    expect(result.tokenUsage.total).toBe(15);
  });

  it('有工具:首回 tool_calls → 执行 → 二回 conclusion', async () => {
    const litellm = makeLitellm([
      {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                {
                  id: 'tc_1',
                  type: 'function',
                  function: { name: 'list_tickets', arguments: '{"status":"open"}' },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
      },
      {
        choices: [{ message: { content: '查到 3 个工单' } }],
        usage: { prompt_tokens: 25, completion_tokens: 8, total_tokens: 33 },
      },
    ]);
    const toolMgmt = makeToolMgmt();
    const invoker = new EvalAgentInvoker(
      litellm,
      toolMgmt,
      makeToolDefRepo([
        {
          id: 'tdef_1',
          name: 'list_tickets',
          enabled: true,
          status: 'active',
          tenantId: 'tn',
          inputSchema: { type: 'object' },
        },
      ])
    );

    const result = await invoker.execute({
      instanceId: 'inst-1',
      tenantId: 'tn',
      prompt: '查工单',
      modelId: 'qwen-plus',
      toolDefinitionIds: ['tdef_1'],
    });

    expect(result.status).toBe('ok');
    expect(result.conclusion).toBe('查到 3 个工单');
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].toolName).toBe('list_tickets');
    expect(result.toolCalls[0].status).toBe('success');
    expect(toolMgmt.executeTool).toHaveBeenCalledWith(
      'tdef_1',
      { status: 'open' },
      { tenantId: 'tn', callerId: 'eval', instanceId: 'inst-1' }
    );
    // token 累加两轮
    expect(result.tokenUsage.total).toBe(63);
  });

  it('未配 modelId → status=error', async () => {
    const invoker = new EvalAgentInvoker(makeLitellm([]), makeToolMgmt(), makeToolDefRepo([]));
    const result = await invoker.execute({ instanceId: 'i', tenantId: 't', prompt: 'p' });
    expect(result.status).toBe('error');
    expect(result.errorMessage).toContain('modelId');
  });

  it('达 maxRounds 仍 tool_calls → status=timeout', async () => {
    // 每轮都返回 tool_calls(永不 conclusion)
    const litellm = makeLitellm([
      {
        choices: [
          {
            message: {
              content: null,
              tool_calls: [
                { id: 'tc', type: 'function', function: { name: 'list_tickets', arguments: '{}' } },
              ],
            },
          },
        ],
        usage: { total_tokens: 10 },
      },
    ]);
    const invoker = new EvalAgentInvoker(
      litellm,
      makeToolMgmt(),
      makeToolDefRepo([
        { id: 'tdef_1', name: 'list_tickets', enabled: true, status: 'active', tenantId: 'tn' },
      ])
    );
    const result = await invoker.execute({
      instanceId: 'i',
      tenantId: 'tn',
      prompt: 'p',
      modelId: 'qwen',
      toolDefinitionIds: ['tdef_1'],
      maxRounds: 2,
    });
    expect(result.status).toBe('timeout');
    expect(result.toolCalls.length).toBeGreaterThanOrEqual(1);
  });
});
