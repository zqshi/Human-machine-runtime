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
