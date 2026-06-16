export type ResourceType =
  | 'instance_count'
  | 'token_monthly'
  | 'token_daily'
  | 'storage'
  | 'api_calls';

export type AlertSeverity = 'warning' | 'critical';

export type NotifyChannel = 'in_app' | 'email' | 'webhook';

export interface QuotaAlertRule {
  id: number;
  tenantId: string;
  resourceType: ResourceType;
  thresholdPct: number;
  severity: AlertSeverity;
  notifyChannels: NotifyChannel[];
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateAlertRuleInput {
  resourceType: ResourceType;
  thresholdPct: number;
  severity?: AlertSeverity;
  notifyChannels?: NotifyChannel[];
  enabled?: boolean;
}

export interface UpdateAlertRuleInput {
  thresholdPct?: number;
  severity?: AlertSeverity;
  notifyChannels?: NotifyChannel[];
  enabled?: boolean;
}

export type AlertEventStatus = 'active' | 'acknowledged' | 'resolved';

export interface QuotaAlertEvent {
  id: number;
  tenantId: string;
  ruleId: number | null;
  resourceType: ResourceType;
  currentPct: number;
  thresholdPct: number;
  severity: AlertSeverity;
  status: AlertEventStatus;
  triggeredAt: string;
  resolvedAt: string | null;
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  instance_count: '实例数量',
  token_monthly: '月度 Token',
  token_daily: '日度 Token',
  storage: '存储空间',
  api_calls: '日 API 调用',
};
