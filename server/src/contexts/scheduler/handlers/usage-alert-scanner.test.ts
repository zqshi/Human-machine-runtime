import { describe, it, expect, vi } from 'vitest';
import { SystemJobHandler } from './system-handler.js';
import {
  registerUsageAlertScanner,
  scanTenantQuotaAlerts,
} from './usage-alert-scanner.js';
import type { QuotaAlertScannerPort, TenantListPort } from './usage-alert-scanner.js';

function makeQuotaService(): QuotaAlertScannerPort & { getDashboard: ReturnType<typeof vi.fn> } {
  return { getDashboard: vi.fn(async () => ({ items: [], alerts: 0 })) };
}

function makeTenantService(tenants: Array<{ id: string }>): TenantListPort {
  return { list: vi.fn(async () => tenants) };
}

function runScanner(handler: SystemJobHandler, payload: Record<string, unknown> = {}) {
  return handler.run({
    taskId: 't',
    jobType: 'system',
    jobPayload: { handlerKey: 'usage-alert-scanner', ...payload },
    triggerType: 'scheduled',
    runId: 'r',
  });
}

describe('usage-alert-scanner', () => {
  it('遍历所有租户调 getDashboard 触发告警评估', async () => {
    const quota = makeQuotaService();
    const tenants = makeTenantService([{ id: 'tnt_1' }, { id: 'tnt_2' }, { id: 'tnt_3' }]);
    const h = new SystemJobHandler();
    registerUsageAlertScanner(h, quota, tenants);

    const result = await runScanner(h);

    expect(quota.getDashboard).toHaveBeenCalledTimes(3);
    expect(quota.getDashboard).toHaveBeenCalledWith('tnt_1');
    expect(quota.getDashboard).toHaveBeenCalledWith('tnt_2');
    expect(quota.getDashboard).toHaveBeenCalledWith('tnt_3');
    // list 按 active 状态筛
    expect(tenants.list).toHaveBeenCalledWith({ status: 'active' });
    expect(result.metadata).toEqual({ total: 3, ok: 3, failed: 0 });
  });

  it('某租户 getDashboard 失败不阻断其他租户扫描(容错)', async () => {
    const quota = makeQuotaService();
    quota.getDashboard
      .mockRejectedValueOnce(new Error('db timeout')) // tnt_1 失败
      .mockResolvedValueOnce({ items: [] }); // tnt_2 成功
    const tenants = makeTenantService([{ id: 'tnt_1' }, { id: 'tnt_2' }]);
    const h = new SystemJobHandler();
    registerUsageAlertScanner(h, quota, tenants);

    const result = await runScanner(h);

    expect(quota.getDashboard).toHaveBeenCalledTimes(2); // tnt_1 失败仍继续 tnt_2
    expect(result.metadata).toEqual({ total: 2, ok: 1, failed: 1 });
    expect(result.outputPayload.errors).toContainEqual({
      tenantId: 'tnt_1',
      error: 'db timeout',
    });
  });

  it('无租户时返回 total=0 不报错', async () => {
    const quota = makeQuotaService();
    const tenants = makeTenantService([]);
    const h = new SystemJobHandler();
    registerUsageAlertScanner(h, quota, tenants);

    const result = await runScanner(h);

    expect(quota.getDashboard).not.toHaveBeenCalled();
    expect(result.metadata).toEqual({ total: 0, ok: 0, failed: 0 });
  });

  it('scanTenantQuotaAlerts 单租户成功', async () => {
    const quota = makeQuotaService();
    const r = await scanTenantQuotaAlerts(quota, 'tnt_1');
    expect(r).toEqual({ ok: true });
    expect(quota.getDashboard).toHaveBeenCalledWith('tnt_1');
  });

  it('scanTenantQuotaAlerts 单租户失败返回 error', async () => {
    const quota = makeQuotaService();
    quota.getDashboard.mockRejectedValueOnce(new Error('boom'));
    const r = await scanTenantQuotaAlerts(quota, 'tnt_1');
    expect(r.ok).toBe(false);
    expect(r.error).toBe('boom');
  });
});
