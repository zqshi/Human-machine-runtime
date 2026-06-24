import { describe, it, expect, vi } from 'vitest';
import { AgentDefinitionService } from './agent-definition-service.js';
import { defaultAgentDefinitionSpec } from '../domain/agent-definition.js';

type RepoMock = {
  create: ReturnType<typeof vi.fn>;
  getById: ReturnType<typeof vi.fn>;
  list: ReturnType<typeof vi.fn>;
  updateSpec: ReturnType<typeof vi.fn>;
  archive: ReturnType<typeof vi.fn>;
  delete: ReturnType<typeof vi.fn>;
};

function makeRepoMock(): RepoMock {
  return {
    create: vi.fn(async (input: Record<string, unknown>) => ({
      id: input.id,
      tenantId: input.tenantId,
      name: input.name,
      generation: 1,
      spec: input.spec,
      description: input.description,
      status: 'active',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    })),
    getById: vi.fn(async () => null),
    list: vi.fn(async () => []),
    updateSpec: vi.fn(async (id: string, spec: unknown) => ({
      id,
      tenantId: 'tn',
      name: 'n',
      generation: 2,
      spec,
      description: null,
      status: 'active',
      createdAt: 't',
      updatedAt: 't',
    })),
    archive: vi.fn(async () => undefined),
    delete: vi.fn(async () => undefined),
  };
}

const makeAuditMock = () => ({ log: vi.fn(async () => ({})) });

describe('AgentDefinitionService', () => {
  it('create:合法 spec 落库 + 审计留痕', async () => {
    const repo = makeRepoMock();
    const audit = makeAuditMock();
    const svc = new AgentDefinitionService(repo as never, audit as never);
    const def = await svc.create({
      tenantId: 'tn',
      name: '客服',
      spec: defaultAgentDefinitionSpec(),
    });
    expect(def.id).toMatch(/^adef_/);
    expect(def.generation).toBe(1);
    expect(repo.create).toHaveBeenCalledOnce();
    expect(audit.log).toHaveBeenCalledWith(
      'agent_definition.created',
      expect.any(Object),
      expect.objectContaining({ actor: { username: 'system', role: 'platform_admin' } })
    );
  });

  it('create:非法 spec 抛错且不落库', async () => {
    const repo = makeRepoMock();
    const svc = new AgentDefinitionService(repo as never);
    const bad = { ...defaultAgentDefinitionSpec(), sandboxTemplate: 'invalid' };
    await expect(svc.create({ tenantId: 'tn', name: 'n', spec: bad })).rejects.toThrow();
    expect(repo.create).not.toHaveBeenCalled();
  });

  it('get:不存在抛 404', async () => {
    const repo = makeRepoMock();
    const svc = new AgentDefinitionService(repo as never);
    await expect(svc.get('nope')).rejects.toThrow(/not found/);
  });

  it('update:存在则 bumpGeneration(→2)', async () => {
    const repo = makeRepoMock();
    repo.getById = vi.fn(async () => ({ id: 'a', generation: 1, tenantId: 'tn' }));
    const svc = new AgentDefinitionService(repo as never);
    const updated = await svc.update('a', { spec: defaultAgentDefinitionSpec() });
    expect(updated.generation).toBe(2);
    expect(repo.updateSpec).toHaveBeenCalledOnce();
  });

  it('update:不存在抛 404', async () => {
    const repo = makeRepoMock();
    const svc = new AgentDefinitionService(repo as never);
    await expect(svc.update('nope', { spec: defaultAgentDefinitionSpec() })).rejects.toThrow(
      /not found/
    );
  });

  it('list:分页 clamp(skip<0→0, limit>100→100)', async () => {
    const repo = makeRepoMock();
    repo.list = vi.fn(async (_f: unknown, limit: number, skip: number) => {
      expect(limit).toBe(100);
      expect(skip).toBe(0);
      return [];
    });
    const svc = new AgentDefinitionService(repo as never);
    await svc.list({ skip: -5, limit: 999 });
    expect(repo.list).toHaveBeenCalledOnce();
  });

  it('list:默认 skip=0 limit=50', async () => {
    const repo = makeRepoMock();
    repo.list = vi.fn(async (_f: unknown, limit: number, skip: number) => {
      expect(limit).toBe(50);
      expect(skip).toBe(0);
      return [];
    });
    const svc = new AgentDefinitionService(repo as never);
    await svc.list({});
  });

  it('archive:不存在抛 404 且不归档', async () => {
    const repo = makeRepoMock();
    const svc = new AgentDefinitionService(repo as never);
    await expect(svc.archive('nope')).rejects.toThrow(/not found/);
    expect(repo.archive).not.toHaveBeenCalled();
  });

  it('archive:存在则归档 + 审计', async () => {
    const repo = makeRepoMock();
    repo.getById = vi.fn(async () => ({ id: 'a', tenantId: 'tn' }));
    const audit = makeAuditMock();
    const svc = new AgentDefinitionService(repo as never, audit as never);
    await svc.archive('a');
    expect(repo.archive).toHaveBeenCalledWith('a');
    expect(audit.log).toHaveBeenCalledOnce();
  });
});
