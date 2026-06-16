import type { ResourceType } from './quota-rule.js';

export interface QuotaUsageItem {
  resourceType: ResourceType;
  current: number;
  limit: number;
  usagePct: number;
  unit: string;
}

export interface QuotaDashboard {
  tenantId: string;
  items: QuotaUsageItem[];
  alerts: { active: number; acknowledged: number };
}

export interface AllocationRow {
  instanceId: string;
  instanceName: string;
  state: string;
  cpu: string;
  memory: string;
  cpuUsed: string;
  memoryUsed: string;
  monthlyBudget: number;
  budgetUsed: number;
  resourceSource: string;
}

export interface AllocationSummary {
  tenantId: string;
  rows: AllocationRow[];
  totals: {
    instanceCount: number;
    instanceLimit: number;
    budgetAllocated: number;
    budgetLimit: number;
  };
}

export interface UsageHistoryPoint {
  measuredAt: string;
  resourceType: ResourceType;
  currentValue: number;
  limitValue: number;
  usagePct: number;
}
