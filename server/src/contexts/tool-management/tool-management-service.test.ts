import { describe, it, expect, vi, afterEach } from 'vitest';
import { ToolManagementService } from './tool-management-service.js';

function mockRepos() {
  return {
    sourceRepo: {
      findAll: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => Promise.resolve(data)),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
      updateToolCount: vi.fn().mockResolvedValue(undefined),
      updateSyncStatus: vi.fn().mockResolvedValue(undefined),
    },
    definitionRepo: {
      findByTenant: vi.fn().mockResolvedValue([]),
      findBySource: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      findEnabledByTenant: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockImplementation((data) => Promise.resolve(data)),
      createMany: vi.fn().mockResolvedValue(3),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
      deleteBySource: vi.fn().mockResolvedValue(0),
      incrementCallCount: vi.fn().mockResolvedValue(undefined),
    },
    instanceRepo: {
      findByTenant: vi.fn().mockResolvedValue([]),
      findByInstance: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(null),
      create: vi.fn().mockImplementation((data) => Promise.resolve(data)),
      update: vi.fn().mockResolvedValue(null),
      delete: vi.fn().mockResolvedValue(true),
    },
    callLogRepo: {
      create: vi.fn().mockResolvedValue(undefined),
      findByTenant: vi.fn().mockResolvedValue([]),
      countByTenant: vi.fn().mockResolvedValue(0),
      getStats: vi
        .fn()
        .mockResolvedValue({ totalCalls: 0, successCalls: 0, failedCalls: 0, avgDurationMs: 0 }),
    },
    credentialService: {
      encrypt: vi.fn().mockReturnValue('encrypted'),
      decrypt: vi.fn().mockReturnValue('decrypted'),
    },
  };
}

function createService(mocks: ReturnType<typeof mockRepos>) {
  return new ToolManagementService(
    mocks.sourceRepo as never,
    mocks.definitionRepo as never,
    mocks.instanceRepo as never,
    mocks.callLogRepo as never,
    mocks.credentialService as never
  );
}

describe('ToolManagementService', () => {
  afterEach(() => vi.restoreAllMocks());

  it('listSources delegates to sourceRepo.findAll', async () => {
    const mocks = mockRepos();
    mocks.sourceRepo.findAll.mockResolvedValue([{ id: 'tsrc_1', name: 'API' }]);
    const svc = createService(mocks);
    const result = await svc.listSources('tn_1');
    expect(mocks.sourceRepo.findAll).toHaveBeenCalledWith('tn_1');
    expect(result).toHaveLength(1);
  });

  it('createSource creates openapi source with id', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    const result = await svc.createSource('tn_1', {
      sourceType: 'openapi',
      name: 'Pet API',
      specUrl: 'https://example.com/spec.json',
    });
    expect(mocks.sourceRepo.create).toHaveBeenCalled();
    expect(result.id).toMatch(/^tsrc_/);
    expect(result.sourceType).toBe('openapi');
  });

  it('syncSource returns error for non-existent source', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    const result = await svc.syncSource('non_existent');
    expect(result.success).toBe(false);
    expect(result.errors).toContain('source not found');
  });

  it('syncSource parses openapi specContent', async () => {
    const mocks = mockRepos();
    mocks.sourceRepo.findById.mockResolvedValue({
      id: 'tsrc_1',
      tenantId: 'tn_1',
      sourceType: 'openapi',
      specContent: JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Test', version: '1.0' },
        paths: {
          '/users': {
            get: { operationId: 'listUsers', responses: { '200': { description: 'ok' } } },
          },
          '/items': {
            post: { operationId: 'createItem', responses: { '201': { description: 'ok' } } },
          },
        },
      }),
    });
    mocks.definitionRepo.findBySource.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);
    const svc = createService(mocks);
    const result = await svc.syncSource('tsrc_1');
    expect(result.success).toBe(true);
    expect(mocks.definitionRepo.deleteBySource).toHaveBeenCalledWith('tsrc_1');
    expect(mocks.definitionRepo.createMany).toHaveBeenCalled();
    expect(mocks.sourceRepo.updateToolCount).toHaveBeenCalledWith('tsrc_1', 2);
  });

  it('getStats aggregates repo data', async () => {
    const mocks = mockRepos();
    mocks.sourceRepo.findAll.mockResolvedValue([{ id: 'a' }, { id: 'b' }]);
    mocks.definitionRepo.findByTenant.mockResolvedValue([
      { id: 'd1', enabled: true },
      { id: 'd2', enabled: false },
      { id: 'd3', enabled: true },
    ]);
    mocks.callLogRepo.getStats.mockResolvedValue({
      totalCalls: 200,
      successCalls: 180,
      failedCalls: 20,
      avgDurationMs: 150,
    });
    const svc = createService(mocks);
    const stats = await svc.getStats('tn_1');
    expect(stats.totalSources).toBe(2);
    expect(stats.totalDefinitions).toBe(3);
    expect(stats.enabledDefinitions).toBe(2);
    expect(stats.successRate).toBe(90);
    expect(stats.avgDurationMs).toBe(150);
  });

  it('uploadSpec returns parse preview', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    const result = await svc.uploadSpec(
      JSON.stringify({
        openapi: '3.0.0',
        info: { title: 'Preview', version: '1.0' },
        paths: {
          '/a': { get: { operationId: 'a', responses: { '200': { description: 'ok' } } } },
        },
      })
    );
    expect(result.specVersion).toBe('3.0.0');
    expect(result.title).toBe('Preview');
    expect(result.toolCount).toBe(1);
  });

  it('deleteSource delegates to repo', async () => {
    const mocks = mockRepos();
    const svc = createService(mocks);
    await svc.deleteSource('tsrc_1');
    expect(mocks.sourceRepo.delete).toHaveBeenCalledWith('tsrc_1');
  });
});
