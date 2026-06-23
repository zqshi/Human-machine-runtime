/**
 * BudgetGuard — 任务预算熔断守卫。
 *
 * A4 的预算熔断逻辑目前在 ClaudeAgentSdkAdapter 内部直接比较 usedUsd > budgetUsd * 1.2。
 * 此类把判定逻辑抽成可复用单元,供未来:
 *   - Harness 层统一在 dispatchTask 前做预算分配
 *   - 多个 adapter 共享同一预算池(避免每个 adapter 独立计费爆账单)
 *
 * 当前实现为纯逻辑(threshold + 累计 used),不做异步/外部 IO。
 */
export class BudgetGuard {
  private used = 0;
  private readonly overrideFactor: number;

  constructor(
    private readonly budgetUsd: number,
    overrideFactor?: number
  ) {
    this.overrideFactor = overrideFactor ?? 1.2;
  }

  /** 累加用量(模型计费回调)。负数视为退款(对账补偿)。 */
  addUsed(amountUsd: number): void {
    if (Number.isNaN(amountUsd)) return;
    this.used += Math.max(0, amountUsd);
  }

  /** 查询当前累计用量。 */
  getUsed(): number {
    return this.used;
  }

  /** 查询原始预算上限(不含 override 因子)。 */
  getBudget(): number {
    return this.budgetUsd;
  }

  /** 是否已超出阈值(budgetUsd * overrideFactor)。 */
  isExceeded(): boolean {
    if (this.budgetUsd <= 0) return false; // budget=0 视为不限(向后兼容)
    return this.used > this.budgetUsd * this.overrideFactor;
  }

  /** 重置用量(任务结束后释放)。 */
  reset(): void {
    this.used = 0;
  }
}
