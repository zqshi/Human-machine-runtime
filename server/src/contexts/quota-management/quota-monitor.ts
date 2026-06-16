import type { QuotaService } from './quota-service.js';
import pino from 'pino';

const log = pino({ name: 'quota-monitor' });

export interface IQuotaMonitorTenantSource {
  listActiveTenantIds(): Promise<string[]>;
}

export interface IQuotaNotifier {
  notifyAlert(
    tenantId: string,
    alert: {
      resourceType: string;
      currentPct: number;
      thresholdPct: number;
      severity: string;
    }
  ): Promise<void>;
}

export class QuotaMonitor {
  private timer: ReturnType<typeof setInterval> | null = null;
  private notifiedEventIds = new Set<number>();

  constructor(
    private quotaService: QuotaService,
    private tenantSource: IQuotaMonitorTenantSource,
    private notifier: IQuotaNotifier | null,
    private intervalMs = 300_000
  ) {}

  start(): void {
    if (this.timer) return;
    log.info({ intervalMs: this.intervalMs }, 'quota monitor started');
    this.timer = setInterval(() => this.evaluateAll(), this.intervalMs);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      log.info('quota monitor stopped');
    }
  }

  async evaluateAll(): Promise<void> {
    let tenantIds: string[];
    try {
      tenantIds = await this.tenantSource.listActiveTenantIds();
    } catch (err) {
      log.error({ err }, 'failed to list tenants for quota evaluation');
      return;
    }

    for (const tenantId of tenantIds) {
      try {
        const dashboard = await this.quotaService.getDashboard(tenantId);
        if (this.notifier && dashboard.alerts.active > 0) {
          const events = await this.quotaService.listEvents(tenantId, {
            status: 'active',
            limit: 10,
          });
          for (const event of events) {
            if (this.notifiedEventIds.has(event.id)) continue;
            this.notifiedEventIds.add(event.id);
            await this.notifier.notifyAlert(tenantId, {
              resourceType: event.resourceType,
              currentPct: event.currentPct,
              thresholdPct: event.thresholdPct,
              severity: event.severity,
            });
          }
        }
      } catch (err) {
        log.warn({ tenantId, err }, 'quota evaluation failed for tenant');
      }
    }
  }
}
