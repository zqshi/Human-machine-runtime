import { describe, it, expect, vi } from 'vitest';
import { MarketplaceService } from './marketplace-service.js';
import type { MarketplaceClient } from '../gateway/clients/marketplace-client.js';

function makeClient(): MarketplaceClient {
  return {
    isConfigured: vi.fn(() => true),
    listSkills: vi.fn(async (p: any) => ({
      items: [{ id: 's1', name: '技能A' }],
      total: 1,
      page: p.page,
    })),
    getSkill: vi.fn(async (id: string) => ({ id, name: '技能详情' })),
    searchSkills: vi.fn(async (kw: string) => ({ items: [{ id: 's2', name: kw }], total: 1 })),
    listAgents: vi.fn(async (p: any) => ({
      items: [{ id: 'a1', name: 'Agent' }],
      total: 1,
      page: p.page,
    })),
    getAgent: vi.fn(async (id: string) => ({ id, name: 'Agent详情' })),
  } as unknown as MarketplaceClient;
}

describe('MarketplaceService', () => {
  it('listSkills delegates with defaults', async () => {
    const client = makeClient();
    const svc = new MarketplaceService(client);
    const result = await svc.listSkills();
    expect(client.listSkills).toHaveBeenCalledWith({ keyword: undefined, page: 1, pageSize: 20 });
    expect(result).toEqual(expect.objectContaining({ total: 1 }));
  });

  it('listSkills passes params', async () => {
    const client = makeClient();
    const svc = new MarketplaceService(client);
    await svc.listSkills({ keyword: 'AI', page: 2, pageSize: 10 });
    expect(client.listSkills).toHaveBeenCalledWith({ keyword: 'AI', page: 2, pageSize: 10 });
  });

  it('getSkill returns skill detail', async () => {
    const client = makeClient();
    const svc = new MarketplaceService(client);
    const result = await svc.getSkill('s1');
    expect(client.getSkill).toHaveBeenCalledWith('s1');
    expect(result).toEqual(expect.objectContaining({ id: 's1' }));
  });

  it('searchSkills passes keyword', async () => {
    const client = makeClient();
    const svc = new MarketplaceService(client);
    await svc.searchSkills('分析');
    expect(client.searchSkills).toHaveBeenCalledWith('分析');
  });

  it('listAgents delegates with defaults', async () => {
    const client = makeClient();
    const svc = new MarketplaceService(client);
    await svc.listAgents();
    expect(client.listAgents).toHaveBeenCalledWith({ keyword: undefined, page: 1, pageSize: 20 });
  });

  it('getAgent returns agent detail', async () => {
    const client = makeClient();
    const svc = new MarketplaceService(client);
    const result = await svc.getAgent('a1');
    expect(client.getAgent).toHaveBeenCalledWith('a1');
    expect(result).toEqual(expect.objectContaining({ id: 'a1' }));
  });

  it('listSkillsForTenant logs audit and delegates', async () => {
    const client = makeClient();
    const audit = { log: vi.fn() };
    const svc = new MarketplaceService(client, audit);
    await svc.listSkillsForTenant('tn_1', { keyword: 'AI' });
    expect(client.listSkills).toHaveBeenCalledWith({ keyword: 'AI', page: 1, pageSize: 50 });
    expect(audit.log).toHaveBeenCalledWith(
      'marketplace.skill.listed',
      expect.objectContaining({ tenantId: 'tn_1' })
    );
  });

  it('requestPublish without approval store publishes directly', async () => {
    const client = makeClient();
    (client as any).publishSkill = vi.fn(async () => ({ published: true }));
    const svc = new MarketplaceService(client);
    const result = await svc.requestPublish('my-skill', { version: '1.0' }, 'user1', 'tn_1');
    expect((client as any).publishSkill).toHaveBeenCalled();
    expect(result).toEqual({ published: true });
  });

  it('requestPublish with approval store creates pending request', async () => {
    const client = makeClient();
    const store = {
      create: vi.fn(async (req: any) => ({ ...req, id: 'req-1', createdAt: '2026-01-01' })),
      findPending: vi.fn(async () => []),
      findById: vi.fn(async () => null),
      update: vi.fn(async () => null),
    };
    const svc = new MarketplaceService(client, undefined, store);
    const result = await svc.requestPublish('my-skill', { version: '1.0' }, 'user1', 'tn_1');
    expect(store.create).toHaveBeenCalled();
    expect((result as any).status).toBe('pending');
  });

  it('approvePublish publishes and updates status', async () => {
    const client = makeClient();
    (client as any).publishSkill = vi.fn(async () => ({ published: true }));
    const pending = {
      id: 'req-1',
      skillSlug: 'sk',
      tenantId: 'tn_1',
      actor: 'u1',
      status: 'pending' as const,
      createdAt: '2026-01-01',
    };
    const store = {
      create: vi.fn(),
      findPending: vi.fn(),
      findById: vi.fn(async () => pending),
      update: vi.fn(async (_id: string, patch: any) => ({ ...pending, ...patch })),
    };
    const svc = new MarketplaceService(client, undefined, store);
    const result = await svc.approvePublish('req-1', 'reviewer1');
    expect((client as any).publishSkill).toHaveBeenCalledWith(
      'sk',
      { version: undefined },
      undefined
    );
    expect(result?.status).toBe('approved');
  });

  it('rejectPublish updates status with reason', async () => {
    const pending = {
      id: 'req-1',
      skillSlug: 'sk',
      tenantId: 'tn_1',
      actor: 'u1',
      status: 'pending' as const,
      createdAt: '2026-01-01',
    };
    const store = {
      create: vi.fn(),
      findPending: vi.fn(),
      findById: vi.fn(async () => pending),
      update: vi.fn(async (_id: string, patch: any) => ({ ...pending, ...patch })),
    };
    const svc = new MarketplaceService(makeClient(), undefined, store);
    const result = await svc.rejectPublish('req-1', 'reviewer1', '质量不达标');
    expect(result?.status).toBe('rejected');
    expect(result?.reviewNote).toBe('质量不达标');
  });

  it('refuses operations when marketplace backend not configured', async () => {
    const client = makeClient();
    (client as any).isConfigured = () => false;
    const svc = new MarketplaceService(client);
    await expect(svc.listSkills()).rejects.toThrow(/not configured/);
  });

  it('installAgent 落 AgentDefinition + instance,返回 instanceId(T20b-A)', async () => {
    const client = makeClient();
    const audit = { log: vi.fn() };
    const agentDefinitionService = {
      create: vi.fn(async (input: any) => ({
        id: 'adef-1',
        tenantId: input.tenantId,
        name: input.name,
        generation: 1,
        spec: input.spec,
        description: input.description,
        status: 'active',
        createdAt: '2026-01-01',
        updatedAt: '2026-01-01',
      })),
    };
    const instanceService = {
      create: vi.fn(async (input: any) => ({
        id: 'inst-1',
        tenantId: input.tenantId,
        name: input.name,
        agentDefinitionId: input.agentDefinitionId,
      })),
    };
    const svc = new MarketplaceService(
      client,
      audit,
      undefined,
      agentDefinitionService as any,
      instanceService as any
    );
    const result = await svc.installAgent(
      { id: 'mka-1', name: '客服助手', description: '处理客户咨询' },
      'tn_1',
      'user1'
    );

    expect(result.instanceId).toBe('inst-1');
    expect(result.agentDefinitionId).toBe('adef-1');
    expect(result.name).toBe('客服助手');

    // spec 转换:persona.systemPrompt 含 name+description,runtime=openclaw,boundTools 空
    const createdSpec = agentDefinitionService.create.mock.calls[0][0].spec;
    expect(createdSpec.persona.systemPrompt).toContain('客服助手');
    expect(createdSpec.persona.systemPrompt).toContain('处理客户咨询');
    expect(createdSpec.runtime.runtimeType).toBe('openclaw');
    expect(createdSpec.boundTools).toEqual([]);

    // instance 关联 agentDefinitionId,source=marketplace,creator=actor
    expect(instanceService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        agentDefinitionId: 'adef-1',
        source: 'marketplace',
        creator: 'user1',
        tenantId: 'tn_1',
      })
    );
    // 审计留痕
    expect(audit.log).toHaveBeenCalledWith(
      'marketplace.agent.installed',
      expect.objectContaining({ instanceId: 'inst-1', marketplaceAgentId: 'mka-1' })
    );
  });

  it('installAgent 无 agentDefinitionService/instanceService 时抛错', async () => {
    const svc = new MarketplaceService(makeClient());
    await expect(svc.installAgent({ id: 'mka-1', name: 'A' }, 'tn_1', 'u')).rejects.toThrow(
      /requires/
    );
  });

  // T25:installAgent 安装时自动授予默认模型 grant + 同步 LiteLLM key(否则新 instance 无 key→chat 502)
  function makeInstallDeps(opts: {
    existingModel?: { id: number; modelName: string | null } | null;
    existingGrants?: string[];
  }) {
    const createModel = vi.fn(async () => ({ id: 99, modelName: 'claude-sonnet-4-6' }));
    const aiGatewayRepo = {
      listModels: vi.fn(async () => (opts.existingModel ? [opts.existingModel] : [])),
      listGrantsByModel: vi.fn(async () => opts.existingGrants ?? []),
      setModelGrants: vi.fn(async () => []),
      createModel,
    };
    const syncInstance = vi.fn(async () => ({
      instanceId: 'inst-1',
      status: 'synced' as const,
      allowedModels: ['claude-sonnet-4-6'],
    }));
    // 结构对齐 MarketplaceKeySyncDeps:{ aiGatewayRepo, llmKeySyncService: { syncInstance } }
    return { aiGatewayRepo, llmKeySyncService: { syncInstance }, syncInstance, createModel };
  }

  function makeInstallSvc(keySyncDeps?: ReturnType<typeof makeInstallDeps>) {
    const agentDefinitionService = {
      create: vi.fn(async (input: any) => ({
        id: 'adef-1',
        tenantId: input.tenantId,
        name: input.name,
      })),
    };
    const instanceService = {
      create: vi.fn(async (input: any) => ({
        id: 'inst-1',
        tenantId: input.tenantId,
        agentDefinitionId: input.agentDefinitionId,
      })),
    };
    const svc = new MarketplaceService(
      makeClient(),
      { log: vi.fn() },
      undefined,
      agentDefinitionService as any,
      instanceService as any
    );
    if (keySyncDeps) svc.setKeySyncDeps(keySyncDeps as any);
    return { svc, agentDefinitionService, instanceService };
  }

  it('installAgent 后授予默认模型 grant + 同步 key(新 instance 可对话)', async () => {
    const deps = makeInstallDeps({ existingModel: { id: 7, modelName: 'claude-sonnet-4-6' } });
    const { svc } = makeInstallSvc(deps);
    await svc.installAgent({ id: 'mka-1', name: 'A' }, 'tn_1', 'u1');
    // 授予 grant:listGrantsByModel 取现有 + 合并新 instance + setModelGrants
    expect(deps.aiGatewayRepo.listGrantsByModel).toHaveBeenCalledWith(7);
    expect(deps.aiGatewayRepo.setModelGrants).toHaveBeenCalledWith(
      7,
      expect.arrayContaining(['inst-1']),
      'tn_1',
      'marketplace-install'
    );
    // 同步 key
    expect(deps.syncInstance).toHaveBeenCalledWith('inst-1', 'tn_1');
  });

  it('installAgent 合并现有 grants(不删其他 instance 的授权)', async () => {
    const deps = makeInstallDeps({
      existingModel: { id: 7, modelName: 'claude-sonnet-4-6' },
      existingGrants: ['inst-old-1', 'inst-old-2'],
    });
    const { svc } = makeInstallSvc(deps);
    await svc.installAgent({ id: 'mka-1', name: 'A' }, 'tn_1', 'u1');
    // setModelGrants 收到合并数组:含旧 instance + 新 instance
    expect(deps.aiGatewayRepo.setModelGrants).toHaveBeenCalledWith(
      7,
      expect.arrayContaining(['inst-old-1', 'inst-old-2', 'inst-1']),
      'tn_1',
      'marketplace-install'
    );
    const setArgs = deps.aiGatewayRepo.setModelGrants.mock.calls[0][1] as string[];
    expect(setArgs).toHaveLength(3); // 不多不少,2 旧 + 1 新
  });

  it('installAgent llm_models 无默认模型时自动创建(createModel)', async () => {
    const deps = makeInstallDeps({ existingModel: null }); // listModels 返回空
    const { svc } = makeInstallSvc(deps);
    await svc.installAgent({ id: 'mka-1', name: 'A' }, 'tn_1', 'u1');
    expect(deps.createModel).toHaveBeenCalled();
  });

  it('installAgent key 同步失败不阻断 install 返回(容错,记 failed)', async () => {
    const deps = makeInstallDeps({ existingModel: { id: 7, modelName: 'claude-sonnet-4-6' } });
    deps.syncInstance.mockRejectedValueOnce(new Error('litellm down'));
    const { svc } = makeInstallSvc(deps);
    // install 不抛错(容错)
    const result = await svc.installAgent({ id: 'mka-1', name: 'A' }, 'tn_1', 'u1');
    expect(result.instanceId).toBe('inst-1');
  });

  it('installAgent 未注入 keySyncDeps 时不抛错(向后兼容,仅无 key)', async () => {
    const { svc } = makeInstallSvc(undefined); // 不调 setKeySyncDeps
    const result = await svc.installAgent({ id: 'mka-1', name: 'A' }, 'tn_1', 'u1');
    expect(result.instanceId).toBe('inst-1');
  });
});
