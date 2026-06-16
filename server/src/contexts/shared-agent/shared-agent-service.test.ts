import { describe, it, expect, vi } from 'vitest';
import { SharedAgentService } from './shared-agent-service.js';
import type { InstanceService } from '../tenant-instance/instance-service.js';
import type { OperationalRepository } from '../../db/repositories/operational-repository.js';

function mockInstanceSvc(
  instances: Array<{
    id: string;
    name: string;
    state: string;
    tenantId?: string;
    source?: string;
    department?: string;
    jobTitle?: string;
  }> = []
): InstanceService {
  return {
    list: vi.fn(async () => instances),
  } as unknown as InstanceService;
}

function mockOpRepo(items: Record<string, unknown>[] = []): OperationalRepository {
  const store = new Map(items.map((i) => [i.id as string, { ...i }]));
  return {
    list: vi.fn(async () => Array.from(store.values())),
    get: vi.fn(async (_ns: string, id: string) => store.get(id) ?? null),
    upsert: vi.fn(async (_ns: string, id: string, data: Record<string, unknown>) => {
      store.set(id, data);
    }),
    remove: vi.fn(async (_ns: string, id: string) => {
      store.delete(id);
    }),
  } as unknown as OperationalRepository;
}

describe('SharedAgentService', () => {
  it('listAll merges instances and registered agents', async () => {
    const instSvc = mockInstanceSvc([{ id: 'i1', name: 'Bot-A', state: 'running' }]);
    const repo = mockOpRepo([{ id: 'r1', category: 'shared_agent', name: 'Shared-B' }]);
    const svc = new SharedAgentService(instSvc, repo);
    const result = await svc.listAll();
    expect(result.agents.length).toBe(2);
    expect(result.total).toBe(2);
  });

  it('listAll excludes non-shared_agent from registered', async () => {
    const instSvc = mockInstanceSvc([]);
    const repo = mockOpRepo([
      { id: 'r1', category: 'shared_agent', name: 'A' },
      { id: 'r2', category: 'tool', name: 'B' },
    ]);
    const svc = new SharedAgentService(instSvc, repo);
    const result = await svc.listAll();
    expect(result.agents.length).toBe(1);
  });

  it('recommend scores by keyword match', async () => {
    const instSvc = mockInstanceSvc([
      { id: 'i1', name: '数据分析', state: 'running', department: 'AI' },
      { id: 'i2', name: '文档助手', state: 'idle' },
    ]);
    const repo = mockOpRepo();
    const svc = new SharedAgentService(instSvc, repo);
    const result = await svc.recommend('分析');
    expect(result.recommendations[0].id).toBe('i1');
    expect(result.recommendations[0].relevance).toBeGreaterThan(0.5);
  });

  it('recommend returns top 5 results', async () => {
    const instances = Array.from({ length: 10 }, (_, i) => ({
      id: `i${i}`,
      name: `Agent-${i}`,
      state: 'idle',
    }));
    const svc = new SharedAgentService(mockInstanceSvc(instances), mockOpRepo());
    const result = await svc.recommend();
    expect(result.recommendations).toHaveLength(5);
    expect(result.total).toBe(10);
  });

  it('register stores with shared_agent category', async () => {
    const repo = mockOpRepo();
    const svc = new SharedAgentService(mockInstanceSvc(), repo);
    const result = await svc.register({ name: 'NewAgent', description: 'test' });
    expect(result.id).toMatch(/^agent_/);
    expect(repo.upsert).toHaveBeenCalledWith(
      'tool_config',
      expect.any(String),
      expect.objectContaining({ category: 'shared_agent', name: 'NewAgent' })
    );
  });

  it('unregister removes from repo', async () => {
    const repo = mockOpRepo([{ id: 'a1', category: 'shared_agent' }]);
    const svc = new SharedAgentService(mockInstanceSvc(), repo);
    await svc.unregister('a1');
    expect(repo.remove).toHaveBeenCalledWith('tool_config', 'a1');
  });
});
