import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  QuotaMonitor,
  type IQuotaMonitorTenantSource,
  type IQuotaNotifier,
} from './quota-monitor.js';
import type { QuotaService } from './quota-service.js';

function makeQuotaService(activeAlerts = 0): QuotaService {
  return {
    getDashboard: vi.fn(async () => ({
      tenantId: 'tn_1',
      items: [{ resourceType: 'storage', current: 8000, limit: 10000, usagePct: 80, unit: 'MB' }],
      alerts: { active: activeAlerts, acknowledged: 0 },
    })),
    listEvents: vi.fn(async () =>
      activeAlerts > 0
        ? [
            {
              id: 1,
              tenantId: 'tn_1',
              ruleId: 1,
              resourceType: 'storage',
              currentPct: 80,
              thresholdPct: 70,
              severity: 'warning',
              status: 'active',
              triggeredAt: new Date().toISOString(),
              resolvedAt: null,
            },
          ]
        : []
    ),
  } as unknown as QuotaService;
}

function makeTenantSource(ids: string[]): IQuotaMonitorTenantSource {
  return { listActiveTenantIds: vi.fn(async () => ids) };
}

function makeNotifier(): IQuotaNotifier {
  return { notifyAlert: vi.fn(async () => {}) };
}

describe('QuotaMonitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('evaluates all tenants on interval', async () => {
    const qs = makeQuotaService();
    const ts = makeTenantSource(['tn_1', 'tn_2']);
    const monitor = new QuotaMonitor(qs, ts, null, 1000);

    monitor.start();
    await vi.advanceTimersByTimeAsync(1000);
    monitor.stop();

    expect(ts.listActiveTenantIds).toHaveBeenCalled();
    expect(qs.getDashboard).toHaveBeenCalledWith('tn_1');
    expect(qs.getDashboard).toHaveBeenCalledWith('tn_2');
  });

  it('sends notifications for active alerts', async () => {
    const qs = makeQuotaService(1);
    const ts = makeTenantSource(['tn_1']);
    const notifier = makeNotifier();
    const monitor = new QuotaMonitor(qs, ts, notifier, 1000);

    await monitor.evaluateAll();

    expect(notifier.notifyAlert).toHaveBeenCalledWith(
      'tn_1',
      expect.objectContaining({
        resourceType: 'storage',
        severity: 'warning',
      })
    );
  });

  it('skips notifications when no active alerts', async () => {
    const qs = makeQuotaService(0);
    const ts = makeTenantSource(['tn_1']);
    const notifier = makeNotifier();
    const monitor = new QuotaMonitor(qs, ts, notifier, 1000);

    await monitor.evaluateAll();

    expect(notifier.notifyAlert).not.toHaveBeenCalled();
  });

  it('continues on tenant evaluation failure', async () => {
    const qs = makeQuotaService();
    (qs.getDashboard as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('db error'));
    const ts = makeTenantSource(['tn_fail', 'tn_ok']);
    const monitor = new QuotaMonitor(qs, ts, null, 1000);

    await monitor.evaluateAll();

    expect(qs.getDashboard).toHaveBeenCalledTimes(2);
  });

  it('handles tenant source failure gracefully', async () => {
    const qs = makeQuotaService();
    const ts: IQuotaMonitorTenantSource = {
      listActiveTenantIds: vi.fn(async () => {
        throw new Error('network');
      }),
    };
    const monitor = new QuotaMonitor(qs, ts, null, 1000);

    await expect(monitor.evaluateAll()).resolves.toBeUndefined();
    expect(qs.getDashboard).not.toHaveBeenCalled();
  });

  it('start is idempotent', () => {
    const qs = makeQuotaService();
    const ts = makeTenantSource([]);
    const monitor = new QuotaMonitor(qs, ts, null, 1000);

    monitor.start();
    monitor.start();
    monitor.stop();
  });

  it('does not re-notify for already notified event IDs', async () => {
    const qs = makeQuotaService(1);
    const ts = makeTenantSource(['tn_1']);
    const notifier = makeNotifier();
    const monitor = new QuotaMonitor(qs, ts, notifier, 1000);

    await monitor.evaluateAll();
    await monitor.evaluateAll();

    expect(notifier.notifyAlert).toHaveBeenCalledTimes(1);
  });
});
