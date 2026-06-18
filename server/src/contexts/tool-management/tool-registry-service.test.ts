import { ToolRegistryService } from './tool-registry-service.js';
import type { ToolManagementService } from './tool-management-service.js';
import type { ToolSourceRepository } from '../../db/repositories/tool-registry-repository.js';
import type { ToolDefinitionRow } from '../../db/repositories/tool-registry-repository.js';
import type { CreateSourceInput, ExecutionContext } from './types.js';

function makeDef(over: Partial<ToolDefinitionRow> = {}): ToolDefinitionRow {
  return {
    id: 'd1',
    sourceId: 's1',
    tenantId: 't1',
    name: 'SQL 优化',
    operationId: null,
    method: null,
    path: null,
    summary: null,
    description: '查询优化工具',
    inputSchema: null,
    outputSchema: null,
    authMethod: 'none',
    executionType: 'http_proxy',
    executionConfig: {},
    tags: ['db', 'sql'],
    version: '1.0.0',
    enabled: true,
    status: 'active',
    callCount: 0,
    lastCalledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as unknown as ToolDefinitionRow;
}

function makeMgmt() {
  return {
    createSource: vi.fn(),
    deleteSource: vi.fn(),
    listDefinitions: vi.fn(),
    getDefinition: vi.fn(),
    executeTool: vi.fn(),
  };
}

function makeSourceRepo() {
  return { findById: vi.fn() };
}

const ctx: ExecutionContext = { tenantId: 't1' };

describe('ToolRegistryService', () => {
  describe('registerSource / deregisterSource', () => {
    it('registerSource 委托 mgmt.createSource 并转 descriptor（health=unknown）', async () => {
      const mgmt = makeMgmt();
      mgmt.createSource.mockResolvedValue({
        id: 's1',
        tenantId: 't1',
        sourceType: 'openapi',
        name: 'src',
        status: 'active',
        toolCount: 0,
      });
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const desc = await reg.registerSource(
        { sourceType: 'openapi', name: 'src' } as unknown as CreateSourceInput,
        't1',
        'u1'
      );
      expect(mgmt.createSource).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({ sourceType: 'openapi' }),
        'u1'
      );
      expect(desc).toEqual({
        id: 's1',
        tenantId: 't1',
        sourceType: 'openapi',
        name: 'src',
        status: 'active',
        toolCount: 0,
        health: 'unknown',
      });
    });

    it('deregisterSource 委托 mgmt.deleteSource', async () => {
      const mgmt = makeMgmt();
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      await reg.deregisterSource('s1');
      expect(mgmt.deleteSource).toHaveBeenCalledWith('s1');
    });
  });

  describe('discover', () => {
    it('enabledOnly 过滤禁用端点', async () => {
      const mgmt = makeMgmt();
      mgmt.listDefinitions.mockResolvedValue([
        makeDef({ id: 'd1', name: 'SQL 优化', enabled: true }),
        makeDef({ id: 'd2', name: 'Other', enabled: false }),
      ]);
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const eps = await reg.discover({ tenantId: 't1', enabledOnly: true });
      expect(eps).toHaveLength(1);
      expect(eps[0].definitionId).toBe('d1');
    });

    it('keyword 命中名称', async () => {
      const mgmt = makeMgmt();
      mgmt.listDefinitions.mockResolvedValue([
        makeDef({ id: 'd1', name: 'SQL 优化' }),
        makeDef({ id: 'd2', name: 'Other' }),
      ]);
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const eps = await reg.discover({ tenantId: 't1', keyword: 'sql' });
      expect(eps).toHaveLength(1);
      expect(eps[0].definitionId).toBe('d1');
    });
  });

  describe('resolve', () => {
    it('同租户返回端点', async () => {
      const mgmt = makeMgmt();
      mgmt.getDefinition.mockResolvedValue(makeDef({ tenantId: 't1' }));
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const ep = await reg.resolve('d1', 't1');
      expect(ep?.definitionId).toBe('d1');
    });

    it('跨租户返回 null（隔离）', async () => {
      const mgmt = makeMgmt();
      mgmt.getDefinition.mockResolvedValue(makeDef({ tenantId: 't1' }));
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      expect(await reg.resolve('d1', 'other')).toBeNull();
    });

    it('不存在返回 null', async () => {
      const mgmt = makeMgmt();
      mgmt.getDefinition.mockResolvedValue(null);
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      expect(await reg.resolve('x', 't1')).toBeNull();
    });
  });

  describe('invoke（租户隔离收口）', () => {
    it('工具不存在 → 失败，不调 executeTool', async () => {
      const mgmt = makeMgmt();
      mgmt.getDefinition.mockResolvedValue(null);
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const r = await reg.invoke({ toolId: 'x', params: {}, context: ctx });
      expect(r.success).toBe(false);
      expect(r.error).toContain('not found');
      expect(mgmt.executeTool).not.toHaveBeenCalled();
    });

    it('跨租户 → forbidden，不调 executeTool', async () => {
      const mgmt = makeMgmt();
      mgmt.getDefinition.mockResolvedValue(makeDef({ tenantId: 't2' }));
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const r = await reg.invoke({ toolId: 'd1', params: {}, context: ctx });
      expect(r.success).toBe(false);
      expect(r.error).toContain('forbidden');
      expect(mgmt.executeTool).not.toHaveBeenCalled();
    });

    it('禁用 → disabled', async () => {
      const mgmt = makeMgmt();
      mgmt.getDefinition.mockResolvedValue(makeDef({ tenantId: 't1', enabled: false }));
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const r = await reg.invoke({ toolId: 'd1', params: {}, context: ctx });
      expect(r.success).toBe(false);
      expect(r.error).toContain('disabled');
    });

    it('正常 → 委托 executeTool 并透传 logId', async () => {
      const mgmt = makeMgmt();
      mgmt.getDefinition.mockResolvedValue(makeDef({ tenantId: 't1', enabled: true }));
      mgmt.executeTool.mockResolvedValue({
        success: true,
        data: { ok: 1 },
        durationMs: 5,
        logId: 'log1',
      });
      const reg = new ToolRegistryService(
        mgmt as unknown as ToolManagementService,
        makeSourceRepo() as unknown as ToolSourceRepository
      );
      const r = await reg.invoke({ toolId: 'd1', params: { q: 'a' }, context: ctx });
      expect(mgmt.executeTool).toHaveBeenCalledWith('d1', { q: 'a' }, ctx);
      expect(r.success).toBe(true);
      expect(r.logId).toBe('log1');
    });
  });

  describe('getHealth', () => {
    it('source 不存在 → unknown', async () => {
      const repo = makeSourceRepo();
      repo.findById.mockResolvedValue(null);
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository
      );
      const h = await reg.getHealth('s1');
      expect(h.status).toBe('unknown');
      expect(h.consecutiveFailures).toBe(0);
    });

    it('status=error 或有同步错误 → degraded', async () => {
      const repo = makeSourceRepo();
      repo.findById.mockResolvedValue({
        id: 's1',
        status: 'error',
        lastSyncError: 'boom',
        lastSyncedAt: null,
      });
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository
      );
      const h = await reg.getHealth('s1');
      expect(h.status).toBe('degraded');
      expect(h.lastError).toBe('boom');
    });

    it('正常 source 未探活 → unknown', async () => {
      const repo = makeSourceRepo();
      repo.findById.mockResolvedValue({
        id: 's1',
        status: 'active',
        lastSyncError: null,
        lastSyncedAt: null,
      });
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository
      );
      expect((await reg.getHealth('s1')).status).toBe('unknown');
    });
  });

  it('healthCheckAll 当前为占位（P4 实装），不抛错', async () => {
    const reg = new ToolRegistryService(
      makeMgmt() as unknown as ToolManagementService,
      makeSourceRepo() as unknown as ToolSourceRepository
    );
    await expect(reg.healthCheckAll()).resolves.toBeUndefined();
  });
});
