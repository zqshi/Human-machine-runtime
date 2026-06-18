import { ToolRegistryService } from './tool-registry-service.js';
import type { ToolManagementService } from './tool-management-service.js';
import type { ToolSourceRepository } from '../../db/repositories/tool-registry-repository.js';
import type { ToolDefinitionRow } from '../../db/repositories/tool-registry-repository.js';
import type { CreateSourceInput, ExecutionContext } from './types.js';
import type { McpClientPool } from './mcp-client.js';
import type { NotificationService } from '../notification/notification-service.js';
import type { LockProvider } from '../scheduler/domain/lock.js';

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
  return {
    findById: vi.fn(),
    findAllAll: vi.fn().mockResolvedValue([]),
    updateHealth: vi.fn(),
  };
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

    it('读取 healthStatus 字段（degraded + 错误 + 失败计数）', async () => {
      const repo = makeSourceRepo();
      repo.findById.mockResolvedValue({
        id: 's1',
        healthStatus: 'degraded',
        lastHealthCheckAt: null,
        lastHealthError: 'boom',
        consecutiveFailures: 2,
      });
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository
      );
      const h = await reg.getHealth('s1');
      expect(h.status).toBe('degraded');
      expect(h.lastError).toBe('boom');
      expect(h.consecutiveFailures).toBe(2);
    });

    it('healthStatus=unknown → unknown（兼容未探活/旧数据）', async () => {
      const repo = makeSourceRepo();
      repo.findById.mockResolvedValue({
        id: 's1',
        healthStatus: 'unknown',
        lastHealthCheckAt: null,
        lastHealthError: null,
        consecutiveFailures: 0,
      });
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository
      );
      expect((await reg.getHealth('s1')).status).toBe('unknown');
    });
  });

  it('healthCheckAll：空 source 列表不抛错', async () => {
    const repo = makeSourceRepo();
    const reg = new ToolRegistryService(
      makeMgmt() as unknown as ToolManagementService,
      repo as unknown as ToolSourceRepository
    );
    await expect(reg.healthCheckAll()).resolves.toBeUndefined();
    expect(repo.findAllAll).toHaveBeenCalled();
  });

  it('healthCheckAll：MCP 探活成功 → healthy + 清零失败计数', async () => {
    const repo = makeSourceRepo();
    repo.findAllAll.mockResolvedValue([
      {
        id: 's1',
        status: 'active',
        sourceType: 'mcp_native',
        mcpEndpoint: 'http://mcp',
        healthStatus: 'unknown',
        consecutiveFailures: 2,
        tenantId: 't1',
        name: 'mcp-src',
      },
    ]);
    const mcpPool = {
      get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(true) }),
    };
    const reg = new ToolRegistryService(
      makeMgmt() as unknown as ToolManagementService,
      repo as unknown as ToolSourceRepository,
      mcpPool as unknown as McpClientPool
    );
    await reg.healthCheckAll();
    expect(repo.updateHealth).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ healthStatus: 'healthy', consecutiveFailures: 0 })
    );
  });

  it('healthCheckAll：探活失败 → 累计失败计数 + degraded', async () => {
    const repo = makeSourceRepo();
    repo.findAllAll.mockResolvedValue([
      {
        id: 's1',
        status: 'active',
        sourceType: 'mcp_native',
        mcpEndpoint: 'http://mcp',
        healthStatus: 'healthy',
        consecutiveFailures: 0,
        tenantId: 't1',
        name: 'mcp-src',
      },
    ]);
    const mcpPool = {
      get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(false) }),
    };
    const reg = new ToolRegistryService(
      makeMgmt() as unknown as ToolManagementService,
      repo as unknown as ToolSourceRepository,
      mcpPool as unknown as McpClientPool
    );
    await reg.healthCheckAll();
    expect(repo.updateHealth).toHaveBeenCalledWith(
      's1',
      expect.objectContaining({ healthStatus: 'degraded', consecutiveFailures: 1 })
    );
  });

  it('healthCheckAll：跳过 archived source', async () => {
    const repo = makeSourceRepo();
    repo.findAllAll.mockResolvedValue([
      { id: 's1', status: 'archived', sourceType: 'mcp_native', mcpEndpoint: 'http://mcp' },
    ]);
    const reg = new ToolRegistryService(
      makeMgmt() as unknown as ToolManagementService,
      repo as unknown as ToolSourceRepository
    );
    await reg.healthCheckAll();
    expect(repo.updateHealth).not.toHaveBeenCalled();
  });

  describe('告警接入（NotificationService）', () => {
    function makeNotifier() {
      return { createAlert: vi.fn().mockResolvedValue('ntf1') };
    }

    it('首次转 down（healthy→down）→ 调 createAlert，含 sourceId/error/tenantId', async () => {
      const repo = makeSourceRepo();
      // consecutiveFailures=2 → 再失败一次 = 3 → computeHealthStatus(3) = down
      repo.findAllAll.mockResolvedValue([
        {
          id: 's1',
          status: 'active',
          sourceType: 'mcp_native',
          mcpEndpoint: 'http://mcp',
          healthStatus: 'healthy',
          consecutiveFailures: 2,
          tenantId: 't1',
          name: 'mcp-src',
        },
      ]);
      const mcpPool = {
        get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(false) }),
      };
      const notifier = makeNotifier();
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository,
        mcpPool as unknown as McpClientPool,
        notifier as unknown as NotificationService
      );
      await reg.healthCheckAll();
      expect(notifier.createAlert).toHaveBeenCalledWith(
        't1',
        expect.objectContaining({
          type: 'tool_health_alert',
          severity: 'critical',
          sourceId: 's1',
          sourceName: 'mcp-src',
        })
      );
    });

    it('已是 down（重复失败）→ 不重复告警', async () => {
      const repo = makeSourceRepo();
      repo.findAllAll.mockResolvedValue([
        {
          id: 's1',
          status: 'active',
          sourceType: 'mcp_native',
          mcpEndpoint: 'http://mcp',
          healthStatus: 'down',
          consecutiveFailures: 5,
          tenantId: 't1',
          name: 'mcp-src',
        },
      ]);
      const mcpPool = {
        get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(false) }),
      };
      const notifier = makeNotifier();
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository,
        mcpPool as unknown as McpClientPool,
        notifier as unknown as NotificationService
      );
      await reg.healthCheckAll();
      expect(notifier.createAlert).not.toHaveBeenCalled();
    });

    it('告警抛错不阻断健康检查（updateHealth 仍执行）', async () => {
      const repo = makeSourceRepo();
      repo.findAllAll.mockResolvedValue([
        {
          id: 's1',
          status: 'active',
          sourceType: 'mcp_native',
          mcpEndpoint: 'http://mcp',
          healthStatus: 'healthy',
          consecutiveFailures: 2,
          tenantId: 't1',
          name: 'mcp-src',
        },
      ]);
      const mcpPool = {
        get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(false) }),
      };
      const notifier = {
        createAlert: vi.fn().mockRejectedValue(new Error('notif down')),
      };
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository,
        mcpPool as unknown as McpClientPool,
        notifier as unknown as NotificationService
      );
      await expect(reg.healthCheckAll()).resolves.toBeUndefined();
      expect(repo.updateHealth).toHaveBeenCalled();
    });
  });

  describe('advisory lock 防多实例并发', () => {
    function makeLock() {
      return { tryLock: vi.fn(), unlock: vi.fn() };
    }

    it('lock 未注入 → 直通探活（单实例/默认行为）', async () => {
      const repo = makeSourceRepo();
      repo.findAllAll.mockResolvedValue([
        {
          id: 's1',
          status: 'active',
          sourceType: 'mcp_native',
          mcpEndpoint: 'http://mcp',
          healthStatus: 'unknown',
          consecutiveFailures: 0,
          tenantId: 't1',
          name: 'mcp-src',
        },
      ]);
      const mcpPool = {
        get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(true) }),
      };
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository,
        mcpPool as unknown as McpClientPool
      );
      await reg.healthCheckAll();
      expect(repo.updateHealth).toHaveBeenCalled();
    });

    it('lock 获取成功 → 探活后释放', async () => {
      const repo = makeSourceRepo();
      repo.findAllAll.mockResolvedValue([
        {
          id: 's1',
          status: 'active',
          sourceType: 'mcp_native',
          mcpEndpoint: 'http://mcp',
          healthStatus: 'unknown',
          consecutiveFailures: 0,
          tenantId: 't1',
          name: 'mcp-src',
        },
      ]);
      const mcpPool = {
        get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(true) }),
      };
      const lock = makeLock();
      lock.tryLock.mockResolvedValue(true);
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository,
        mcpPool as unknown as McpClientPool,
        undefined,
        lock as unknown as LockProvider
      );
      await reg.healthCheckAll();
      expect(lock.tryLock).toHaveBeenCalledWith('tool-health-check');
      expect(repo.updateHealth).toHaveBeenCalled();
      expect(lock.unlock).toHaveBeenCalledWith('tool-health-check');
    });

    it('lock 被持有（其他实例正在跑）→ 跳过探活，不调 updateHealth', async () => {
      const repo = makeSourceRepo();
      repo.findAllAll.mockResolvedValue([
        {
          id: 's1',
          status: 'active',
          sourceType: 'mcp_native',
          mcpEndpoint: 'http://mcp',
          healthStatus: 'unknown',
          consecutiveFailures: 0,
          tenantId: 't1',
          name: 'mcp-src',
        },
      ]);
      const mcpPool = {
        get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(true) }),
      };
      const lock = makeLock();
      lock.tryLock.mockResolvedValue(false);
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository,
        mcpPool as unknown as McpClientPool,
        undefined,
        lock as unknown as LockProvider
      );
      await reg.healthCheckAll();
      expect(repo.updateHealth).not.toHaveBeenCalled();
      // 获取失败不应调 unlock
      expect(lock.unlock).not.toHaveBeenCalled();
    });

    it('探活期间 lock.unlock 抛错 → 不影响已完成的结果（finally 内吞掉）', async () => {
      const repo = makeSourceRepo();
      repo.findAllAll.mockResolvedValue([
        {
          id: 's1',
          status: 'active',
          sourceType: 'mcp_native',
          mcpEndpoint: 'http://mcp',
          healthStatus: 'unknown',
          consecutiveFailures: 0,
          tenantId: 't1',
          name: 'mcp-src',
        },
      ]);
      const mcpPool = {
        get: vi.fn().mockReturnValue({ checkHealth: vi.fn().mockResolvedValue(true) }),
      };
      const lock = makeLock();
      lock.tryLock.mockResolvedValue(true);
      lock.unlock.mockRejectedValue(new Error('unlock failed'));
      const reg = new ToolRegistryService(
        makeMgmt() as unknown as ToolManagementService,
        repo as unknown as ToolSourceRepository,
        mcpPool as unknown as McpClientPool,
        undefined,
        lock as unknown as LockProvider
      );
      await expect(reg.healthCheckAll()).resolves.toBeUndefined();
      expect(repo.updateHealth).toHaveBeenCalled();
    });
  });
});
