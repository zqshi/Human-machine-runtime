/**
 * billing 限界上下文 domain 类型(投产骨架)。
 *
 * 事件类型枚举对应业务"可计费动作":
 *   - decision_closed:决策被确认/拒绝/执行完成(按次计费)
 *   - token_usage:LLM 调用 token 消耗(按量计费)
 *   - instance_hour:数字员工实例运行时长(按时计费)
 *
 * 仅声明 domain 契约,不含外部依赖(domain 层零依赖原则)。
 */

export const BILLING_EVENT_TYPES = ['decision_closed', 'token_usage', 'instance_hour'] as const;

export type BillingEventType = (typeof BILLING_EVENT_TYPES)[number];

export interface BillingEvent {
  id: number;
  tenantId: string;
  type: BillingEventType;
  /** 金额(USD)。对 token_usage 为估算成本,对 decision_closed/instance_hour 为计费单价×数量 */
  amount: number;
  currency: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface BillingAccount {
  tenantId: string;
  /** 余额:>0 表示已用未结(negative balance),<0 表示预付结余(credit)。
   * 本期骨架仅累加 amount(消费),不实现充值/对账逻辑。 */
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface BillingInvoice {
  id: number;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  currency: string;
  status: 'draft' | 'issued' | 'paid' | 'void';
  createdAt: string;
}

export interface RecordEventInput {
  tenantId: string;
  type: BillingEventType;
  amount: number;
  metadata?: Record<string, unknown>;
}

export interface ListEventsFilter {
  type?: BillingEventType;
  /** ISO date string,查询 createdAt >= since */
  since?: string;
  /** ISO date string,查询 createdAt < until */
  until?: string;
  /** 返回行数上限。不传时由调用方默认（路由层 default 100） */
  limit?: number;
  /** 跳过行数,用于分页翻页(与 limit 配合) */
  offset?: number;
}
