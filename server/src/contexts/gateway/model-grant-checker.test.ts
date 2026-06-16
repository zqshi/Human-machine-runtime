import { describe, it, expect, vi } from 'vitest';
import { ModelGrantChecker } from './model-grant-checker.js';

function makeChecker(opts: {
  enforceMode: 'off' | 'log' | 'enforce';
  models?: { id: number; modelName: string | null; providerModelName: string | null; displayName: string }[];
  grantsByModel?: Record<number, string[]>;
}) {
  const aiGatewayRepo = {
    listModels: vi.fn().mockResolvedValue(
      opts.models ?? [
        { id: 1, modelName: 'claude-sonnet-4-6', providerModelName: 'claude-sonnet-4-6', displayName: 'Claude' },
      ]
    ),
    listGrantsByModel: vi.fn().mockImplementation(async (modelId: number) => opts.grantsByModel?.[modelId] ?? []),
  };
  const systemConfigService = {
    getAiGatewayEnforceMode: vi.fn().mockResolvedValue(opts.enforceMode),
  };
  const checker = new ModelGrantChecker({ aiGatewayRepo, systemConfigService });
  return { checker, aiGatewayRepo, systemConfigService };
}

describe('ModelGrantChecker', () => {
  it('off 模式：直接 skip 放行', async () => {
    const { checker } = makeChecker({ enforceMode: 'off' });
    const d = await checker.check('inst-1', 'claude-sonnet-4-6');
    expect(d.decision).toBe('skip');
    expect(d.enforceMode).toBe('off');
  });

  it('enforce 模式 + 无 instance：skip（统一助手不受约束）', async () => {
    const { checker } = makeChecker({ enforceMode: 'enforce' });
    const d = await checker.check(null, 'claude-sonnet-4-6');
    expect(d.decision).toBe('skip');
  });

  it('enforce 模式 + 未登记模型：skip', async () => {
    const { checker } = makeChecker({ enforceMode: 'enforce' });
    const d = await checker.check('inst-1', 'unknown-model');
    expect(d.decision).toBe('skip');
    expect(d.modelId).toBeNull();
  });

  it('enforce 模式 + 已授权：allow', async () => {
    const { checker } = makeChecker({
      enforceMode: 'enforce',
      grantsByModel: { 1: ['inst-1', 'inst-2'] },
    });
    const d = await checker.check('inst-1', 'claude-sonnet-4-6');
    expect(d.decision).toBe('allow');
    expect(d.modelId).toBe(1);
  });

  it('enforce 模式 + 未授权：deny', async () => {
    const { checker } = makeChecker({
      enforceMode: 'enforce',
      grantsByModel: { 1: ['inst-2'] },
    });
    const d = await checker.check('inst-1', 'claude-sonnet-4-6');
    expect(d.decision).toBe('deny');
  });

  it('log 模式 + 未授权：仍 allow（仅记录）', async () => {
    const { checker } = makeChecker({
      enforceMode: 'log',
      grantsByModel: { 1: ['inst-2'] },
    });
    const d = await checker.check('inst-1', 'claude-sonnet-4-6');
    expect(d.decision).toBe('allow');
  });

  it('按 providerModelName 也能解析 modelId', async () => {
    const { checker } = makeChecker({
      enforceMode: 'enforce',
      models: [
        { id: 7, modelName: null, providerModelName: 'gpt-4o', displayName: 'GPT-4o' },
      ],
      grantsByModel: { 7: ['inst-x'] },
    });
    const d = await checker.check('inst-x', 'gpt-4o');
    expect(d.decision).toBe('allow');
    expect(d.modelId).toBe(7);
  });
});
