/**
 * usage-alert-scanner —— 用量阈值告警定时扫描(T10 防盲飞)
 *
 * 定时(每 5 分钟)遍历所有租户,调 QuotaService.getDashboard 触发其内部
 * evaluateAndFireAlerts(比对 rule.thresholdPct → createEvent 告警落库 + saveSnapshot)。
 *
 * 设计:本 handler 是薄编排层,用量阈值判断 + 告警生成全复用 QuotaService 现有逻辑
 * (evaluateAndFireAlerts 原仅在用户查配额面板时被动触发,本扫描让它定时主动触发,
 * 线上不依赖"有人看面板"才告警)。告警落 notification/operational 表(站内通知,
 * 非邮件;邮件通道留后续按 NotificationService.createAlert 扩展)。
 *
 * 与 instance-reconciler 同模式:SystemJobFn + register(handler, deps)。
 */
import type { SystemJobHandler, SystemJobFn } from './system-handler.js';

/** QuotaService 最小接口(结构化类型,便于 mock + 解耦;只用到触发告警的 getDashboard)。 */
export interface QuotaAlertScannerPort {
  getDashboard(tenantId: string): Promise<unknown>;
}

/** TenantService 最小接口(全租户列表;IQuotaTenantLookup 只有 getById,故用 TenantService.list)。 */
export interface TenantListPort {
  list(filters?: { status?: string }): Promise<Array<{ id: string }>>;
}

interface ScannerResult {
  conclusion: string;
  outputPayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

/**
 * scanTenantQuotaAlerts — 扫描单租户的用量告警(纯逻辑,导出便于单测)。
 * 调 quotaService.getDashboard(tid) 触发内部 evaluateAndFireAlerts;失败不阻断整体扫描。
 */
export async function scanTenantQuotaAlerts(
  quotaService: QuotaAlertScannerPort,
  tenantId: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    await quotaService.getDashboard(tenantId);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function registerUsageAlertScanner(
  handler: SystemJobHandler,
  quotaService: QuotaAlertScannerPort,
  tenantService: TenantListPort
): void {
  const fn: SystemJobFn = async () => {
    // 默认扫 active 租户(非 archived)。可选 status filter 留 params 扩展。
    const tenants = await tenantService.list({ status: 'active' });
    let ok = 0;
    let failed = 0;
    const errors: { tenantId: string; error: string }[] = [];

    for (const t of tenants) {
      const r = await scanTenantQuotaAlerts(quotaService, t.id);
      if (r.ok) {
        ok++;
      } else {
        failed++;
        errors.push({ tenantId: t.id, error: r.error ?? 'unknown' });
      }
    }

    const result: ScannerResult = {
      conclusion: `用量告警扫描完成:成功=${ok} 失败=${failed}(共 ${tenants.length} 个租户)`,
      outputPayload: { total: tenants.length, ok, failed, errors },
      metadata: { total: tenants.length, ok, failed },
    };
    return result;
  };

  handler.register('usage-alert-scanner', fn);
}
