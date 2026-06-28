import { describe, it, expect, vi } from 'vitest';
import { createAdminRuntimeManifestRoutes } from './runtime-manifests.js';
import type { BakingService } from '../../contexts/agent-core/application/baking-service.js';
import type { AgentDefinitionService } from '../../contexts/agent-core/application/agent-definition-service.js';
import type { RuntimeManifestRepository } from '../../db/repositories/runtime-manifest-repository.js';
import type { AgentDefinition } from '../../contexts/agent-core/domain/agent-definition.js';
import type { RuntimeManifest } from '../../contexts/agent-core/domain/runtime-manifest.js';

function makeDef(): AgentDefinition {
  return {
    id: 'adef_1',
    tenantId: 'tn_demo',
    name: 'test-def',
    generation: 3,
    spec: {} as never,
    description: null,
    status: 'active',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };
}

function makeManifest(): RuntimeManifest {
  return {
    id: 'rman_1',
    agentDefinitionId: 'adef_1',
    generation: 3,
    bakedAt: 1782570725921,
    status: 'baked',
    compiledSystemPrompt: '你是助手',
    compiledGuardrails: [],
    compiledTools: [],
    compiledSkillsContext: '',
    compiledQuota: {},
    refusalResponse: '',
    runtimeRoute: 'tool-loop',
    sandboxStrategy: 'opensandbox',
    errorMsg: null,
  } as RuntimeManifest;
}

function mockDeps(opts: { def?: AgentDefinition | null; bakeResult?: unknown } = {}) {
  const bakingService = {
    bake: vi.fn().mockResolvedValue(
      opts.bakeResult ?? { manifestId: 'rman_1', status: 'baked', errorMsg: null }
    ),
  } as unknown as BakingService;
  const agentDefinitionService = {
    get: vi.fn().mockResolvedValue(opts.def === undefined ? makeDef() : opts.def),
  } as unknown as AgentDefinitionService;
  const manifestRepo = {
    listByDefinition: vi.fn().mockResolvedValue([makeManifest()]),
    findManifest: vi.fn().mockResolvedValue(makeManifest()),
  } as unknown as RuntimeManifestRepository;
  return { bakingService, agentDefinitionService, manifestRepo };
}

describe('createAdminRuntimeManifestRoutes', () => {
  it('POST /:defId/bake → 200 + manifestId(同步固化,tenantId/generation 取自 def)', async () => {
    const { bakingService, agentDefinitionService, manifestRepo } = mockDeps();
    const app = createAdminRuntimeManifestRoutes(bakingService, agentDefinitionService, manifestRepo);

    const res = await app.request('/adef_1/bake', { method: 'POST' });
    expect(res.status).toBe(200);
    expect(bakingService.bake).toHaveBeenCalledWith({
      agentDefinitionId: 'adef_1',
      generation: 3,
      tenantId: 'tn_demo',
    });
    const body = await res.json();
    expect(body.manifestId).toBe('rman_1');
    expect(body.status).toBe('baked'); // route 透传同步终态(非 202 pending)
  });

  it('POST /:defId/bake def 不存在 → 404', async () => {
    const { bakingService, agentDefinitionService, manifestRepo } = mockDeps({ def: null });
    const app = createAdminRuntimeManifestRoutes(bakingService, agentDefinitionService, manifestRepo);

    const res = await app.request('/missing/bake', { method: 'POST' });
    expect(res.status).toBe(404);
    expect(bakingService.bake).not.toHaveBeenCalled();
  });

  it('GET /:defId 列出全部 manifest(generation 倒序)+ 分页结构', async () => {
    const { bakingService, agentDefinitionService, manifestRepo } = mockDeps();
    const app = createAdminRuntimeManifestRoutes(bakingService, agentDefinitionService, manifestRepo);

    const res = await app.request('/adef_1');
    expect(res.status).toBe(200);
    expect(manifestRepo.listByDefinition).toHaveBeenCalledWith('adef_1', 50);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.limit).toBe(50);
  });

  it('GET /:defId/:generation 精确查 manifest', async () => {
    const { bakingService, agentDefinitionService, manifestRepo } = mockDeps();
    const app = createAdminRuntimeManifestRoutes(bakingService, agentDefinitionService, manifestRepo);

    const res = await app.request('/adef_1/3');
    expect(res.status).toBe(200);
    expect(manifestRepo.findManifest).toHaveBeenCalledWith('adef_1', 3);
    const body = await res.json();
    expect(body.compiledSystemPrompt).toBe('你是助手');
  });

  it('GET /:defId/:generation 不存在 → 404', async () => {
    const { bakingService, agentDefinitionService, manifestRepo } = mockDeps();
    (manifestRepo.findManifest as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const app = createAdminRuntimeManifestRoutes(bakingService, agentDefinitionService, manifestRepo);

    const res = await app.request('/adef_1/99');
    expect(res.status).toBe(404);
  });

  it('GET /:defId/:generation generation 非数字 → 400', async () => {
    const { bakingService, agentDefinitionService, manifestRepo } = mockDeps();
    const app = createAdminRuntimeManifestRoutes(bakingService, agentDefinitionService, manifestRepo);

    const res = await app.request('/adef_1/abc');
    expect(res.status).toBe(400);
  });
});
