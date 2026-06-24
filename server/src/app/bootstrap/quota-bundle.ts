/**
 * 套餐 + 配额(Plan & Quota)依赖组装。
 *
 * 从 `bootstrap.ts` 拆出:PlanService(套餐 + 租户计数 checker)+ QuotaService(配额,
 * 依赖 tenantService/instanceService/tokenUsageService 做余量查询)+ QuotaMonitor(定时配额评估,
 * 超阈值经 notificationService 告警)。interval 按 dev/prod 区分。
 */
import { config } from '../../config/index.js';
import { Database } from '../../db/client.js';
import { PlanRepository } from '../../db/repositories/plan-repository.js';
import { PlanService } from '../../contexts/tenant-management/plan-service.js';
import { QuotaRepository } from '../../db/repositories/quota-repository.js';
import { QuotaService } from '../../contexts/quota-management/quota-service.js';
import { QuotaMonitor } from '../../contexts/quota-management/quota-monitor.js';
import type { TenantRepository } from '../../db/repositories/tenant-repository.js';
import type { TenantService } from '../../contexts/tenant-management/tenant-service.js';
import type { InstanceService } from '../../contexts/tenant-instance/instance-service.js';
import type { TokenUsageService } from '../../contexts/observability/token-usage-service.js';
import type { NotificationService } from '../../contexts/notification/notification-service.js';

export interface QuotaBundle {
  quotaService: QuotaService;
  planService: PlanService;
  quotaMonitor: QuotaMonitor;
}

export function buildQuotaBundle(
  db: Database,
  tenantRepo: TenantRepository,
  tenantService: TenantService,
  instanceService: InstanceService,
  tokenUsageService: TokenUsageService,
  notificationService: NotificationService
): QuotaBundle {
  const planRepo = new PlanRepository(db);
  const planTenantChecker = {
    async countByPlan(planSlug: string) {
      const all = await tenantRepo.listTenants();
      return all.filter((t) => t.plan === planSlug).length;
    },
  };
  const planService = new PlanService(planRepo, planTenantChecker);

  const quotaRepo = new QuotaRepository(db);
  const quotaService = new QuotaService(
    quotaRepo,
    { getById: async (id: string) => tenantService.getById(id) },
    { list: async (tid?: string) => instanceService.list(tid) },
    {
      getUsageSummary: async (tid: string, period?: string) =>
        tokenUsageService.getUsageSummary(tid, period),
    }
  );

  const quotaMonitorNotifier = {
    async notifyAlert(
      tenantId: string,
      alert: { resourceType: string; currentPct: number; thresholdPct: number; severity: string }
    ) {
      await notificationService.createFromAlert(tenantId, alert);
    },
  };
  const quotaMonitorTenantSource = {
    async listActiveTenantIds() {
      const tenants = await tenantService.list({ status: 'active' });
      return tenants.map((t) => t.id);
    },
  };
  const quotaMonitorInterval = config.env === 'development' ? 60_000 : 300_000;
  const quotaMonitor = new QuotaMonitor(
    quotaService,
    quotaMonitorTenantSource,
    quotaMonitorNotifier,
    quotaMonitorInterval
  );

  return { quotaService, planService, quotaMonitor };
}
