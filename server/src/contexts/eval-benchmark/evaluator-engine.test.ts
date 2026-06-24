import { describe, it, expect, vi } from 'vitest';
import { EvaluatorEngine } from './evaluator-engine.js';
import type { EvalEvaluator } from './eval-types.js';
import type { LiteLLMClient } from '../gateway/clients/litellm-client.js';

function makeEvaluator(overrides: Partial<EvalEvaluator> = {}): EvalEvaluator {
  return {
    id: 'ev_1',
    name: 'test',
    description: null,
    type: 'rule_based',
    dimensions: [{ key: 'correctness', label: '正确性', weight: 1 }],
    scoringRubric: [],
    ruleConfig: null,
    judgeConfig: null,
    threshold: 0.8,
    status: 'active',
    tenantId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as EvalEvaluator;
}

describe('EvaluatorEngine - trajectory/tool_calls(v1.7)', () => {
  it('rule_based + tool_calls contains 命中:期望工具名出现在工具序列', async () => {
    const engine = new EvaluatorEngine();
    const ev = makeEvaluator({
      ruleConfig: [{ type: 'contains', field: 'tool_calls', value: 'list_tickets', weight: 1 }],
    });
    const result = await engine.evaluate(ev, {
      taskDescription: '查工单',
      actualOutput: '已查询',
      toolCallsLog: [{ toolName: 'list_tickets', arguments: {}, result: [], status: 'success' }],
    });
    // 命中 → correctness 维度满分
    expect(result.dimensionScores.correctness).toBe(1);
    expect(result.passed).toBe(true);
  });

  it('rule_based + tool_calls contains 未命中:期望工具未调用', async () => {
    const engine = new EvaluatorEngine();
    const ev = makeEvaluator({
      ruleConfig: [{ type: 'contains', field: 'tool_calls', value: 'search_rooms', weight: 1 }],
    });
    const result = await engine.evaluate(ev, {
      taskDescription: '查工单',
      actualOutput: '已查询',
      toolCallsLog: [{ toolName: 'list_tickets', arguments: {}, result: [], status: 'success' }],
    });
    // 未命中 → correctness 维度 0 分
    expect(result.dimensionScores.correctness).toBe(0);
    expect(result.passed).toBe(false);
  });

  it('rule_based + output contains 仍正常(向后兼容,非 trajectory)', async () => {
    const engine = new EvaluatorEngine();
    const ev = makeEvaluator({
      ruleConfig: [{ type: 'contains', field: 'output', value: '报销', weight: 1 }],
    });
    const result = await engine.evaluate(ev, {
      taskDescription: '问报销',
      actualOutput: '报销流程是填表',
      toolCallsLog: [],
    });
    expect(result.dimensionScores.correctness).toBe(1);
  });

  it('llm_judge buildPrompt 注入 toolCallsLog + expectedTrajectory 变量', async () => {
    const captured: { messages?: unknown } = {};
    const litellm = {
      isConfigured: () => true,
      chatCompletion: vi.fn(async (params: { messages: unknown }) => {
        captured.messages = params.messages;
        return {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  score: 0.9,
                  dimensions: { correctness: 0.9 },
                  comment: '轨迹契合',
                }),
              },
            },
          ],
          usage: { total_tokens: 100 },
        };
      }),
    } as unknown as LiteLLMClient;

    const engine = new EvaluatorEngine(litellm);
    const ev = makeEvaluator({
      type: 'llm_judge',
      judgeConfig: {
        model: 'qwen-plus',
        temperature: 0,
        maxTokens: 100,
        promptTemplate:
          '任务:{taskDescription}\n实际:{actualOutput}\n轨迹:{toolCallsLog}\n期望轨迹:{expectedTrajectory}\n标准:{rubric}',
      },
    });
    await engine.evaluate(ev, {
      taskDescription: '查工单',
      actualOutput: '已查询',
      toolCallsLog: [{ toolName: 'list_tickets', arguments: {}, result: [] }],
      expectedTrajectory: 'list_tickets -> resolve_ticket',
      rubric: '工具选择正确性',
    });

    // 验证变量被替换(非占位原样)
    const promptStr = JSON.stringify(captured.messages);
    expect(promptStr).toContain('list_tickets');
    expect(promptStr).toContain('list_tickets -> resolve_ticket');
    expect(promptStr).toContain('工具选择正确性');
    expect(promptStr).not.toContain('{toolCallsLog}');
    expect(promptStr).not.toContain('{expectedTrajectory}');
  });
});
