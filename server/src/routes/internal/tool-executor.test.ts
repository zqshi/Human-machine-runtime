import { describe, it, expect, vi } from 'vitest';
import { createInternalToolExecutorRoutes } from './tool-executor';
import type { SystemConfigService } from '../../contexts/system-config/system-config-service';

function mockConfig(enforced: boolean): SystemConfigService {
  return { isFeatureEnabled: vi.fn(async () => enforced) } as unknown as SystemConfigService;
}

function toolCheck(app: ReturnType<typeof createInternalToolExecutorRoutes>, body: unknown) {
  return app.request('/tool-check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('createInternalToolExecutorRoutes /tool-check (T18b-A)', () => {
  it('enforce off → allow(向后兼容,同 approvalGate 逻辑)', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(false));
    const res = await toolCheck(app, { tenantId: 't1', toolName: 'Bash', input: {} });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBe(true);
  });

  it('enforce on + Bash(high) → deny(canUseTool 同步无法 pending)', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(true));
    const res = await toolCheck(app, { tenantId: 't1', toolName: 'Bash', input: {} });
    const data = await res.json();
    expect(data.allowed).toBe(false);
    expect(data.reason).toContain('high-risk');
  });

  it('enforce on + Write/Edit(high) → deny', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(true));
    for (const name of ['Write', 'Edit']) {
      const res = await toolCheck(app, { tenantId: 't1', toolName: name, input: {} });
      const data = await res.json();
      expect(data.allowed).toBe(false);
    }
  });

  it('enforce on + Read/Glob/Grep/WebSearch/WebFetch(low) → allow', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(true));
    for (const name of ['Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch']) {
      const res = await toolCheck(app, { tenantId: 't1', toolName: name, input: {} });
      const data = await res.json();
      expect(data.allowed).toBe(true);
    }
  });

  it('enforce on + 未识别工具 → deny(保守,留 T18a 第二阶段)', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(true));
    const res = await toolCheck(app, { tenantId: 't1', toolName: 'SomeExternalTool', input: {} });
    const data = await res.json();
    expect(data.allowed).toBe(false);
    expect(data.reason).toContain('not in builtin risk table');
  });

  it('缺 tenantId → 400', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(true));
    const res = await toolCheck(app, { toolName: 'Bash' });
    expect(res.status).toBe(400);
  });

  it('isFeatureEnabled 以 tenantId 为参数调用', async () => {
    const config = mockConfig(true);
    const app = createInternalToolExecutorRoutes(config);
    await toolCheck(app, { tenantId: 'tn_acme', toolName: 'Read', input: {} });
    expect(config.isFeatureEnabled).toHaveBeenCalledWith('tool.approval.enforce', 'tn_acme');
  });
});

// T18b 选项A:/tool-invoke — worker 外部/MCP 工具执行转发,收口到 ToolRegistryService.invoke
// (让审批/凭证/租户隔离/计费对外部工具生效;内置工具仍 SDK 执行器+canUseTool 审批)
describe('createInternalToolExecutorRoutes /tool-invoke (T18b 选项A)', () => {
  function mockToolRegistry(override: Record<string, unknown> = {}) {
    return {
      invoke: vi.fn(async () => ({
        success: true,
        output: 'ok',
        logId: 'log-1',
        durationMs: 10,
        ...override,
      })),
    };
  }

  function toolInvoke(
    app: ReturnType<typeof createInternalToolExecutorRoutes>,
    body: unknown
  ) {
    return app.request('/tool-invoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  }

  it('调 ToolRegistryService.invoke 收口执行,返回结果', async () => {
    const tr = mockToolRegistry();
    const app = createInternalToolExecutorRoutes(mockConfig(false), tr as never);
    const res = await toolInvoke(app, {
      toolId: 'tool-1',
      params: { query: 'x' },
      context: { tenantId: 'tn_1', instanceId: 'inst-1', callerId: 'u1' },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(data.logId).toBe('log-1');
    // 透传完整 invocation request(含租户隔离/审批 gate 上下文)
    expect(tr.invoke).toHaveBeenCalledWith({
      toolId: 'tool-1',
      params: { query: 'x' },
      context: { tenantId: 'tn_1', instanceId: 'inst-1', callerId: 'u1' },
    });
  });

  it('缺 toolId → 400', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(false), mockToolRegistry() as never);
    const res = await toolInvoke(app, { params: {}, context: { tenantId: 'tn_1' } });
    expect(res.status).toBe(400);
  });

  it('context.tenantId 缺失 → 400', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(false), mockToolRegistry() as never);
    const res = await toolInvoke(app, { toolId: 't1', params: {}, context: {} });
    expect(res.status).toBe(400);
  });

  it('invoke 返回 pendingApproval → 转发(审批 gate 拦截,worker 据此告知 Agent)', async () => {
    const tr = mockToolRegistry({
      success: false,
      error: 'pending approval',
      logId: '',
      durationMs: 0,
      pendingApproval: { approvalId: 'ap-1', reason: 'high risk' },
    });
    const app = createInternalToolExecutorRoutes(mockConfig(false), tr as never);
    const res = await toolInvoke(app, { toolId: 't1', params: {}, context: { tenantId: 'tn_1' } });
    const data = await res.json();
    expect(data.pendingApproval.approvalId).toBe('ap-1');
    expect(data.success).toBe(false);
  });

  it('invoke 返回 success:false(租户隔离/禁用/错误)→ 转发 error', async () => {
    const tr = mockToolRegistry({ success: false, error: 'forbidden: tool does not belong to tenant', logId: '', durationMs: 0 });
    const app = createInternalToolExecutorRoutes(mockConfig(false), tr as never);
    const res = await toolInvoke(app, { toolId: 't1', params: {}, context: { tenantId: 'tn_1' } });
    const data = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toContain('forbidden');
  });

  it('invoke 抛错 → 500(不裸露内部错误细节给 worker)', async () => {
    const tr = { invoke: vi.fn(async () => { throw new Error('db connection lost'); }) };
    const app = createInternalToolExecutorRoutes(mockConfig(false), tr as never);
    const res = await toolInvoke(app, { toolId: 't1', params: {}, context: { tenantId: 'tn_1' } });
    expect(res.status).toBe(500);
  });

  it('未注入 toolRegistryService → 503(向后兼容:仅 /tool-check 时不挂)', async () => {
    const app = createInternalToolExecutorRoutes(mockConfig(false)); // 不传 toolRegistryService
    const res = await toolInvoke(app, { toolId: 't1', params: {}, context: { tenantId: 'tn_1' } });
    expect(res.status).toBe(503);
  });
});
