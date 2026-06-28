import { describe, it, expect, vi } from 'vitest';
import { BakingService } from './baking-service.js';
import { RuntimeRegistry } from '../domain/runtime-registry.js';
import type { AgentDefinition } from '../domain/agent-definition.js';

/**
 * BakingService 单元测试(C3)。
 * mock ports(IAgentDefinitionPort/IBoundToolsPort/IContentStorePort/IPersonaProvider)+ manifestRepo。
 * 验证:bake 成功固化字段正确 / spec 查不到 failed / assemble 失败 failed / 已 baked 占位冲突。
 */

function makeDef(overrides: Partial<AgentDefinition> = {}): AgentDefinition {
  return {
    id: 'adef_1',
    tenantId: 'tn_demo',
    name: 'test-def',
    generation: 1,
    spec: {
      sandboxTemplate: 'basic',
      resourceLimits: {
        compute: { cpu: '500m', memory: '512Mi', gpu: null },
        model: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
        budget: { monthlyLimitCny: 0, dailyLimitCny: null, alertThresholdPct: 80 },
        storage: { persistentVolumeSize: '2Gi', tempStorageSize: '1Gi' },
        source: 'tenant_default',
        customizedAt: null,
        customizedBy: null,
      },
      workspaceStrategy: { type: 'pvc', size: '2Gi' },
      boundTools: ['t1'],
      boundSkills: [],
      modelConfig: { primaryModel: 'auto', fallbackModels: [], maxConcurrency: 5 },
      persona: {
        systemPrompt: '你是助手',
        guardrails: [],
        refusalResponse: '超出范围',
      },
      boundKnowledge: [],
      runtime: { runtimeType: 'cockpit' },
    },
    description: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  } as AgentDefinition;
}

function makeManifestRepoMock(opts: { upsertPendingThrow?: Error } = {}) {
  return {
    upsertPending: vi.fn().mockImplementation(async () => {
      if (opts.upsertPendingThrow) throw opts.upsertPendingThrow;
    }),
    saveBaked: vi.fn().mockResolvedValue(undefined),
    saveFailed: vi.fn().mockResolvedValue(undefined),
    findBakedManifest: vi.fn().mockResolvedValue(null),
    findManifest: vi.fn().mockResolvedValue(null),
    listByDefinition: vi.fn().mockResolvedValue([]),
    updateStatus: vi.fn().mockResolvedValue(undefined),
  };
}

function makeLogger() {
  return { warn: vi.fn(), error: vi.fn() };
}

function makeBoundToolsPort(rows: unknown[]) {
  return { findByIds: vi.fn().mockResolvedValue(rows) };
}

describe('BakingService — bake 成功', () => {
  it('固化 systemPrompt/guardrails/tools/runtimeRoute/sandboxStrategy', async () => {
    const def = makeDef();
    const manifestRepo = makeManifestRepoMock();
    const svc = new BakingService(
      { getById: vi.fn().mockResolvedValue(def) },
      makeBoundToolsPort([
        {
          id: 't1',
          name: 'get_weather',
          enabled: true,
          status: 'active',
          tenantId: 'tn_demo',
          description: '查天气',
          inputSchema: { type: 'object' },
        },
      ]),
      { getByIds: vi.fn().mockResolvedValue([]) },
      manifestRepo,
      new RuntimeRegistry(),
      makeLogger()
    );

    const result = await svc.bake({
      agentDefinitionId: 'adef_1',
      generation: 1,
      tenantId: 'tn_demo',
    });

    // B1 守护:bake 同步返回终态 baked(非 pending 强转),防回退为异步 as 欺骗类型
    expect(result.status).toBe('baked');
    expect(result.manifestId).toMatch(/^rman_/);
    expect(manifestRepo.upsertPending).toHaveBeenCalledWith(
      expect.stringMatching(/^rman_/),
      'adef_1',
      1
    );
    expect(manifestRepo.saveBaked).toHaveBeenCalledTimes(1);
    const [id, sealed] = manifestRepo.saveBaked.mock.calls[0];
    expect(id).toMatch(/^rman_/);
    expect(sealed.compiledSystemPrompt).toBe('你是助手');
    expect(sealed.compiledTools).toHaveLength(1);
    expect(sealed.compiledTools[0].name).toBe('get_weather');
    expect(sealed.runtimeRoute).toBe('cockpit');
    expect(sealed.sandboxStrategy).toBe('opensandbox');
    expect(sealed.compiledQuota.resourceLimits).toBeDefined();
    expect(sealed.status).toBe('baked');
  });

  it('sandboxTemplate=kvm-microvm → sandboxStrategy=cubesandbox', async () => {
    const def = makeDef({
      spec: { ...makeDef().spec, sandboxTemplate: 'kvm-microvm' },
    } as AgentDefinition);
    const manifestRepo = makeManifestRepoMock();
    const svc = new BakingService(
      { getById: vi.fn().mockResolvedValue(def) },
      makeBoundToolsPort([]),
      { getByIds: vi.fn().mockResolvedValue([]) },
      manifestRepo,
      new RuntimeRegistry(),
      makeLogger()
    );

    await svc.bake({ agentDefinitionId: 'adef_1', generation: 1, tenantId: 'tn_demo' });

    const sealed = manifestRepo.saveBaked.mock.calls[0][1];
    expect(sealed.sandboxStrategy).toBe('cubesandbox');
  });

  it('sealed manifest 不可变(Object.freeze)', async () => {
    const def = makeDef();
    const manifestRepo = makeManifestRepoMock();
    const svc = new BakingService(
      { getById: vi.fn().mockResolvedValue(def) },
      makeBoundToolsPort([]),
      { getByIds: vi.fn().mockResolvedValue([]) },
      manifestRepo,
      new RuntimeRegistry(),
      makeLogger()
    );

    await svc.bake({ agentDefinitionId: 'adef_1', generation: 1, tenantId: 'tn_demo' });

    const sealed = manifestRepo.saveBaked.mock.calls[0][1];
    expect(() => {
      sealed.compiledSystemPrompt = '篡改';
    }).toThrow(TypeError);
  });
});

describe('BakingService — bake 失败', () => {
  it('AgentDefinition 查不到 → saveFailed', async () => {
    const manifestRepo = makeManifestRepoMock();
    const svc = new BakingService(
      { getById: vi.fn().mockResolvedValue(null) },
      makeBoundToolsPort([]),
      { getByIds: vi.fn().mockResolvedValue([]) },
      manifestRepo,
      new RuntimeRegistry(),
      makeLogger()
    );

    await svc.bake({ agentDefinitionId: 'missing', generation: 1, tenantId: 'tn_demo' });

    expect(manifestRepo.saveFailed).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringContaining('not found')
    );
    expect(manifestRepo.saveBaked).not.toHaveBeenCalled();
  });

  it('agentDefinitionPort 未配置 → saveFailed', async () => {
    const manifestRepo = makeManifestRepoMock();
    const svc = new BakingService(
      null,
      makeBoundToolsPort([]),
      { getByIds: vi.fn().mockResolvedValue([]) },
      manifestRepo,
      new RuntimeRegistry(),
      makeLogger()
    );

    await svc.bake({ agentDefinitionId: 'adef_1', generation: 1, tenantId: 'tn_demo' });

    expect(manifestRepo.saveFailed).toHaveBeenCalledWith(
      expect.any(String),
      'agentDefinitionPort not configured'
    );
  });

  it('manifest 已 baked → upsertPending 抛错 → 返回 failed 不重建', async () => {
    const manifestRepo = makeManifestRepoMock({
      upsertPendingThrow: new Error('manifest already baked: adef_1 gen 1'),
    });
    const svc = new BakingService(
      { getById: vi.fn().mockResolvedValue(makeDef()) },
      makeBoundToolsPort([]),
      { getByIds: vi.fn().mockResolvedValue([]) },
      manifestRepo,
      new RuntimeRegistry(),
      makeLogger()
    );

    const result = await svc.bake({
      agentDefinitionId: 'adef_1',
      generation: 1,
      tenantId: 'tn_demo',
    });

    expect(result.status).toBe('failed');
    expect(result.errorMsg).toContain('already baked');
    // 已 baked 不重建,不调 saveBaked
    expect(manifestRepo.saveBaked).not.toHaveBeenCalled();
  });
});
