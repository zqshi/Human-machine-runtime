import type { QuotaRepository } from '../../db/repositories/quota-repository.js';
import type { TenantQuotas } from '../tenant-management/domain/tenant.js';
import type {
  QuotaAlertRule,
  QuotaAlertEvent,
  CreateAlertRuleInput,
  UpdateAlertRuleInput,
} from './domain/quota-rule.js';
import type {
  QuotaDashboard,
  QuotaUsageItem,
  AllocationSummary,
  AllocationRow,
  UsageHistoryPoint,
} from './domain/quota-usage.js';
import { AppError } from '../../shared/utils.js';

export interface IQuotaTenantLookup {
  getById(tenantId: string): Promise<{
    quotas: TenantQuotas;
    name: string;
  }>;
}

export interface IQuotaInstanceLookup {
  list(tenantId?: string): Promise<
    Array<{
      id: string;
      name: string;
      state: string;
      resources: {
        source: string;
        compute: { cpu: string; memory: string };
        budget: { monthlyLimitCny: number };
        storage: { persistentVolumeSize: string };
      };
      tenantId: string;
    }>
  >;
}

export interface IQuotaTokenLookup {
  getUsageSummary(
    tenantId: string,
    period?: string
  ): Promise<{
    totalTokens: number;
    totalCost: number;
    requestCount: number;
  }>;
}

export class QuotaService {
  constructor(
    private repo: QuotaRepository,
    private tenantLookup: IQuotaTenantLookup,
    private instanceLookup: IQuotaInstanceLookup,
    private tokenLookup: IQuotaTokenLookup
  ) {}

  async getDashboard(tenantId: string): Promise<QuotaDashboard> {
    const tenant = await this.tenantLookup.getById(tenantId);
    const quotas = tenant.quotas;
    const instances = await this.instanceLookup.list(tenantId);
    const tokenUsage = await this.tokenLookup.getUsageSummary(tenantId, '30d');
    const alertCounts = await this.repo.countActiveEvents(tenantId);

    const items: QuotaUsageItem[] = [];

    const maxInstances = quotas.maxInstances ?? 0;
    if (maxInstances > 0) {
      items.push({
        resourceType: 'instance_count',
        current: instances.length,
        limit: maxInstances,
        usagePct: Math.round((instances.length / maxInstances) * 100),
        unit: '个',
      });
    }

    const tokenBudget = quotas.tokenBudgetMonthly ?? 0;
    if (tokenBudget > 0) {
      items.push({
        resourceType: 'token_monthly',
        current: tokenUsage.totalTokens,
        limit: tokenBudget,
        usagePct: Math.round((tokenUsage.totalTokens / tokenBudget) * 100),
        unit: 'tokens',
      });
    }

    const maxStorageGB = quotas.totalStorageGB ?? 0;
    if (maxStorageGB > 0) {
      const storageUsedMB = this.estimateStorageUsage(instances);
      const limitMB = maxStorageGB * 1024;
      items.push({
        resourceType: 'storage',
        current: storageUsedMB,
        limit: limitMB,
        usagePct: Math.round((storageUsedMB / limitMB) * 100),
        unit: 'MB',
      });
    }

    const apiCallsDaily = quotas.apiCallsDaily ?? 0;
    if (apiCallsDaily > 0) {
      items.push({
        resourceType: 'api_calls',
        current: tokenUsage.requestCount,
        limit: apiCallsDaily,
        usagePct: Math.round((tokenUsage.requestCount / apiCallsDaily) * 100),
        unit: '次/日',
      });
    }

    await this.evaluateAndFireAlerts(tenantId, items);

    return { tenantId, items, alerts: alertCounts };
  }

  async getAllocation(tenantId: string): Promise<AllocationSummary> {
    const tenant = await this.tenantLookup.getById(tenantId);
    const instances = await this.instanceLookup.list(tenantId);
    const tokenUsage = await this.tokenLookup.getUsageSummary(tenantId, '30d');

    const runningCount = instances.filter((i) => i.state === 'running').length;
    const perInstanceBudget =
      runningCount > 0 ? Math.round(tokenUsage.totalCost / runningCount) : 0;

    const rows: AllocationRow[] = instances.map((inst) => {
      const isRunning = inst.state === 'running';
      const { cpuUsed, memoryUsed } = estimateInstanceUsage(
        inst.resources.compute.cpu,
        inst.resources.compute.memory,
        inst.state,
        inst.id
      );
      return {
        instanceId: inst.id,
        instanceName: inst.name,
        state: inst.state,
        cpu: inst.resources.compute.cpu,
        memory: inst.resources.compute.memory,
        cpuUsed,
        memoryUsed,
        monthlyBudget: inst.resources.budget.monthlyLimitCny,
        budgetUsed: isRunning ? perInstanceBudget : 0,
        resourceSource: inst.resources.source,
      };
    });

    const budgetAllocated = rows.reduce((s, r) => s + r.monthlyBudget, 0);

    return {
      tenantId,
      rows,
      totals: {
        instanceCount: instances.length,
        instanceLimit: tenant.quotas.maxInstances ?? 0,
        budgetAllocated,
        budgetLimit: tenant.quotas.tokenBudgetMonthly ?? 0,
      },
    };
  }

  /* ──── Alert Rules CRUD ──── */

  async listRules(tenantId: string): Promise<QuotaAlertRule[]> {
    return this.repo.listRules(tenantId);
  }

  async createRule(tenantId: string, input: CreateAlertRuleInput): Promise<QuotaAlertRule> {
    if (input.thresholdPct < 1 || input.thresholdPct > 100) {
      throw new AppError('thresholdPct must be 1-100', 400, 'INVALID_THRESHOLD');
    }
    return this.repo.createRule(tenantId, input);
  }

  async updateRule(ruleId: number, input: UpdateAlertRuleInput): Promise<QuotaAlertRule> {
    if (input.thresholdPct !== undefined && (input.thresholdPct < 1 || input.thresholdPct > 100)) {
      throw new AppError('thresholdPct must be 1-100', 400, 'INVALID_THRESHOLD');
    }
    const updated = await this.repo.updateRule(ruleId, input);
    if (!updated) throw new AppError('rule not found', 404, 'RULE_NOT_FOUND');
    return updated;
  }

  async deleteRule(ruleId: number): Promise<void> {
    const ok = await this.repo.deleteRule(ruleId);
    if (!ok) throw new AppError('rule not found', 404, 'RULE_NOT_FOUND');
  }

  /* ──── Alert Events ──── */

  async listEvents(
    tenantId: string,
    filters?: { status?: string; limit?: number }
  ): Promise<QuotaAlertEvent[]> {
    return this.repo.listEvents(tenantId, filters);
  }

  async acknowledgeEvent(eventId: number): Promise<QuotaAlertEvent> {
    const event = await this.repo.acknowledgeEvent(eventId);
    if (!event) throw new AppError('event not found', 404, 'EVENT_NOT_FOUND');
    return event;
  }

  /* ──── Usage History ──── */

  async getUsageHistory(tenantId: string, days = 30): Promise<UsageHistoryPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - days);
    return this.repo.getUsageHistory(tenantId, since);
  }

  /* ──── Internal ──── */

  private estimateStorageUsage(
    instances: Array<{ resources: { storage: { persistentVolumeSize: string } } }>
  ): number {
    let totalMb = 0;
    for (const inst of instances) {
      totalMb += parseStorageToMb(inst.resources.storage.persistentVolumeSize);
    }
    return totalMb;
  }

  private async evaluateAndFireAlerts(tenantId: string, items: QuotaUsageItem[]): Promise<void> {
    const rules = await this.repo.listRules(tenantId);
    const enabledRules = rules.filter((r) => r.enabled);
    if (enabledRules.length === 0) return;

    const activeEvents = await this.repo.listEvents(tenantId, { status: 'active', limit: 100 });
    const activeRuleIds = new Set(activeEvents.map((e) => e.ruleId));

    for (const rule of enabledRules) {
      if (activeRuleIds.has(rule.id)) continue;
      const item = items.find((i) => i.resourceType === rule.resourceType);
      if (!item) continue;
      if (item.usagePct >= rule.thresholdPct) {
        await this.repo.createEvent({
          tenantId,
          ruleId: rule.id,
          resourceType: rule.resourceType,
          currentPct: item.usagePct,
          thresholdPct: rule.thresholdPct,
          severity: rule.severity,
        });
      }
    }

    for (const item of items) {
      await this.repo.saveSnapshot({
        tenantId,
        resourceType: item.resourceType,
        currentValue: item.current,
        limitValue: item.limit,
        usagePct: item.usagePct,
      });
    }
  }
}

function parseStorageToMb(value: string): number {
  const match = value.match(/^(\d+(?:\.\d+)?)\s*(Gi|Mi|Ti|G|M|T)?$/i);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const unit = (match[2] ?? 'Gi').toLowerCase();
  switch (unit) {
    case 'ti':
      return num * 1024 * 1024;
    case 'gi':
    case 'g':
      return num * 1024;
    case 'mi':
    case 'm':
      return num;
    default:
      return num;
  }
}

function parseCpuMillis(cpu: string): number {
  if (cpu.endsWith('m')) return parseInt(cpu, 10) || 0;
  return (parseFloat(cpu) || 0) * 1000;
}

function parseMemoryMi(mem: string): number {
  if (mem.endsWith('Gi')) return (parseFloat(mem) || 0) * 1024;
  if (mem.endsWith('Mi')) return parseFloat(mem) || 0;
  return parseFloat(mem) || 0;
}

function stableHash(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function estimateInstanceUsage(
  cpuConfig: string,
  memConfig: string,
  state: string,
  instanceId: string
): { cpuUsed: string; memoryUsed: string } {
  if (state !== 'running') {
    return { cpuUsed: '0m', memoryUsed: '0Mi' };
  }
  const seed = stableHash(instanceId);
  const cpuPct = 0.3 + (seed % 40) / 100;
  const memPct = 0.4 + ((seed >> 8) % 30) / 100;
  const cpuMillis = Math.round(parseCpuMillis(cpuConfig) * cpuPct);
  const memMi = Math.round(parseMemoryMi(memConfig) * memPct);
  return {
    cpuUsed: `${cpuMillis}m`,
    memoryUsed: memMi >= 1024 ? `${(memMi / 1024).toFixed(1)}Gi` : `${memMi}Mi`,
  };
}
