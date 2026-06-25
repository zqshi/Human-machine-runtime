import { describe, it, expect, vi } from 'vitest';
import { StudioService } from './studio-service.js';
import type { AgentDefinition } from '../domain/agent-definition.js';

function mockRepos() {
  return {
    agentDefRepo: {
      list: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      updateSpec: vi.fn().mockResolvedValue(null),
    },
    toolDefRepo: {
      findByTenant: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
    },
    skillRepo: {
      listSharedAssets: vi.fn().mockResolvedValue([]),
      getSharedAssetsByIds: vi.fn().mockResolvedValue([]),
      listBindingsByTenant: vi.fn().mockResolvedValue([]),
      findAssetBinding: vi.fn().mockResolvedValue(null),
      addAssetBinding: vi.fn().mockResolvedValue(undefined),
      removeAssetBinding: vi.fn().mockResolvedValue(true),
      getSharedAsset: vi.fn().mockResolvedValue(null),
    },
  };
}

function createService(mocks: ReturnType<typeof mockRepos>) {
  return new StudioService(
    mocks.agentDefRepo as never,
    mocks.toolDefRepo as never,
    mocks.skillRepo as never
  );
}

const agentDef = {
  id: 'adef_1',
  tenantId: 'tn_1',
  name: 'SQL助手',
  generation: 2,
  spec: {
    sandboxTemplate: 'default',
    resourceLimits: {},
    workspaceStrategy: { type: 'emptyDir', size: '1Gi' },
    boundTools: ['tdef_1'],
    boundSkills: ['sa_1'],
    modelConfig: { primaryModel: 'claude-sonnet-4', fallbackModels: [], maxConcurrency: 5 },
    persona: { systemPrompt: '你是SQL专家', guardrails: [], refusalResponse: '' },
    boundKnowledge: ['kb_1'],
    runtime: { runtimeType: 'openclaw', config: { openingMessage: '你好', humanize: true } },
  },
  description: 'SQL优化助手',
  status: 'active',
  createdAt: '',
  updatedAt: '2026-01-01T00:00:00Z',
} as unknown as AgentDefinition;

describe('StudioService', () => {
  it('listAssets 聚合 Agent + MCP + shared + installed', async () => {
    const mocks = mockRepos();
    mocks.agentDefRepo.list.mockResolvedValue([agentDef]);
    mocks.toolDefRepo.findByTenant.mockResolvedValue([
      {
        id: 'tdef_1',
        name: 'db-query',
        summary: '查询',
        description: null,
        version: '1.0',
        enabled: true,
      },
    ]);
    mocks.skillRepo.listSharedAssets.mockResolvedValue([
      {
        id: 'sa_1',
        name: '报告生成',
        assetType: 'skill',
        description: '生成报告',
        version: '2.0',
        status: 'active',
        updatedAt: '2026-01-01T00:00:00Z',
      },
    ]);
    mocks.skillRepo.listBindingsByTenant.mockResolvedValue([
      {
        id: 'b1',
        tenantId: 'tn_1',
        assetId: 'sa_2',
        assetType: 'skill',
        updatedAt: '2026-01-02T00:00:00Z',
      },
    ]);
    mocks.skillRepo.getSharedAssetsByIds.mockResolvedValue([
      {
        id: 'sa_2',
        name: '摘要',
        assetType: 'skill',
        description: '摘要技能',
        version: '1.5',
        status: 'active',
        updatedAt: '',
      },
    ]);
    const svc = createService(mocks);
    const items = await svc.listAssets('tn_1');

    expect(items).toHaveLength(4);
    const byOrigin = items.reduce<Record<string, number>>((acc, i) => {
      acc[i.origin] = (acc[i.origin] ?? 0) + 1;
      return acc;
    }, {});
    expect(byOrigin.created).toBe(2); // Agent + MCP
    expect(byOrigin.shared).toBe(1);
    expect(byOrigin.installed).toBe(1);
    const agent = items.find((i) => i.type === 'Agent' && i.origin === 'created');
    expect(agent?.name).toBe('SQL助手');
    expect(agent?.version).toBe('v2');
  });

  it('getAgentConfig 映射 AgentDefinitionSpec → DTO', async () => {
    const mocks = mockRepos();
    mocks.agentDefRepo.getById.mockResolvedValue(agentDef);
    mocks.toolDefRepo.findById.mockResolvedValue({ id: 'tdef_1', name: 'db-query' });
    mocks.skillRepo.getSharedAssetsByIds.mockResolvedValue([
      {
        id: 'sa_1',
        name: '报告生成',
        description: '生成报告',
        assetType: 'skill',
        version: '',
        status: 'active',
        updatedAt: '',
      },
    ]);
    const svc = createService(mocks);
    const config = await svc.getAgentConfig('adef_1');

    expect(config).not.toBeNull();
    expect(config!.systemPrompt).toBe('你是SQL专家');
    expect(config!.modelId).toBe('claude-sonnet-4');
    expect(config!.openingMessage).toBe('你好');
    expect(config!.humanize).toBe(true);
    expect(config!.mcpRefs).toEqual([{ id: 'tdef_1', name: 'db-query', toolCount: 1 }]);
    expect(config!.skillRefs).toEqual([{ id: 'sa_1', name: '报告生成', description: '生成报告' }]);
    expect(config!.knowledgeBaseIds).toEqual(['kb_1']);
    expect(config!.publishedVersion).toBe('v2');
  });

  it('getAgentConfig agent 不存在返回 null', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    expect(await svc.getAgentConfig('missing')).toBeNull();
  });

  it('saveAgentConfig 映射 DTO → spec 并 updateSpec', async () => {
    const mocks = mockRepos();
    mocks.agentDefRepo.getById.mockResolvedValue(agentDef);
    const svc = createService(mocks);
    const ok = await svc.saveAgentConfig('adef_1', {
      systemPrompt: '新提示词',
      modelId: 'gpt-4',
      openingMessage: '开场',
      mcpRefs: [{ id: 'tdef_2', name: 'x', toolCount: 0 }],
    });
    expect(ok).toBe(true);
    expect(mocks.agentDefRepo.updateSpec).toHaveBeenCalledWith(
      'adef_1',
      expect.objectContaining({
        persona: expect.objectContaining({ systemPrompt: '新提示词' }),
        boundTools: ['tdef_2'],
      })
    );
  });

  it('saveAgentConfig agent 不存在返回 false', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    expect(await svc.saveAgentConfig('missing', {})).toBe(false);
  });

  it('publishAgent 返回版本号并 updateSpec', async () => {
    const mocks = mockRepos();
    mocks.agentDefRepo.getById.mockResolvedValue(agentDef);
    const svc = createService(mocks);
    const result = await svc.publishAgent('adef_1', 'v3.0');
    expect(result).toEqual({ version: 'v3.0' });
    expect(mocks.agentDefRepo.updateSpec).toHaveBeenCalled();
  });

  it('installAsset 资产不存在返回 null', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    expect(await svc.installAsset('tn_1', 'missing', 'tenant', 'studio')).toBeNull();
  });

  it('installAsset 资产存在 → addAssetBinding', async () => {
    const mocks = mockRepos();
    mocks.skillRepo.getSharedAsset.mockResolvedValue({
      id: 'sa_1',
      name: '报告',
      assetType: 'skill',
      description: '',
      version: '1.0',
      status: 'active',
      updatedAt: '',
    });
    const svc = createService(mocks);
    const result = await svc.installAsset('tn_1', 'sa_1', 'tenant', 'studio');
    expect(result?.id).toMatch(/^asset_binding/);
    expect(mocks.skillRepo.addAssetBinding).toHaveBeenCalledOnce();
  });

  it('installAsset 幂等(已绑定 → 不重复插入)', async () => {
    const mocks = mockRepos();
    mocks.skillRepo.getSharedAsset.mockResolvedValue({
      id: 'sa_1',
      name: '报告',
      assetType: 'skill',
      description: '',
      version: '1.0',
      status: 'active',
      updatedAt: '',
    });
    mocks.skillRepo.findAssetBinding.mockResolvedValue({
      id: 'b1',
      tenantId: 'tn_1',
      assetId: 'sa_1',
      assetType: 'skill',
      status: 'active',
      createdBy: 'x',
      createdAt: '',
      updatedAt: '',
    });
    const svc = createService(mocks);
    const result = await svc.installAsset('tn_1', 'sa_1', 'tenant', 'studio');
    expect(result?.id).toBe('b1');
    expect(mocks.skillRepo.addAssetBinding).not.toHaveBeenCalled();
  });

  it('uninstallAsset 删除绑定', async () => {
    const mocks = mockRepos();
    mocks.skillRepo.findAssetBinding.mockResolvedValue({
      id: 'b1',
      tenantId: 'tn_1',
      assetId: 'sa_1',
      assetType: 'skill',
      status: 'active',
      createdBy: 'x',
      createdAt: '',
      updatedAt: '',
    });
    const svc = createService(mocks);
    expect(await svc.uninstallAsset('tn_1', 'sa_1')).toBe(true);
    expect(mocks.skillRepo.removeAssetBinding).toHaveBeenCalledWith('b1');
  });

  it('uninstallAsset 绑定不存在返回 false', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    expect(await svc.uninstallAsset('tn_1', 'missing')).toBe(false);
  });
});
