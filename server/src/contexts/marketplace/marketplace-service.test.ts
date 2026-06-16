import { describe, it, expect, vi } from 'vitest';
import { MarketplaceService } from './marketplace-service.js';
import type { ClawHubClient } from '../gateway/clients/clawhub-client.js';

function makeClient(): ClawHubClient {
  return {
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
  } as unknown as ClawHubClient;
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
});
