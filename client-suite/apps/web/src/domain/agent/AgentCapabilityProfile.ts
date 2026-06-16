/**
 * AgentCapabilityProfile — Agent 能力画像
 *
 * 每个 Agent 的能力域、历史成功率、平均耗时、Token 消耗、成本。
 */

export interface CapabilityDomain {
  readonly domain: string;
  readonly successRate: number;
  readonly totalExecutions: number;
  readonly avgDurationMs: number;
  readonly avgTokenCost: number;
}

export interface AgentCapabilityProfileProps {
  agentId: string;
  name: string;
  domains: CapabilityDomain[];
  overallSuccessRate: number;
  totalTasksCompleted: number;
  totalTasksFailed: number;
  avgResponseMs: number;
  totalTokensConsumed: number;
  lastActiveAt: number;
  createdAt: number;
}

export class AgentCapabilityProfile {
  readonly agentId: string;
  readonly name: string;
  readonly domains: readonly CapabilityDomain[];
  readonly overallSuccessRate: number;
  readonly totalTasksCompleted: number;
  readonly totalTasksFailed: number;
  readonly avgResponseMs: number;
  readonly totalTokensConsumed: number;
  readonly lastActiveAt: number;
  readonly createdAt: number;

  private constructor(props: AgentCapabilityProfileProps) {
    this.agentId = props.agentId;
    this.name = props.name;
    this.domains = props.domains;
    this.overallSuccessRate = props.overallSuccessRate;
    this.totalTasksCompleted = props.totalTasksCompleted;
    this.totalTasksFailed = props.totalTasksFailed;
    this.avgResponseMs = props.avgResponseMs;
    this.totalTokensConsumed = props.totalTokensConsumed;
    this.lastActiveAt = props.lastActiveAt;
    this.createdAt = props.createdAt;
  }

  static create(props: {
    agentId: string;
    name: string;
    domains?: CapabilityDomain[];
  }): AgentCapabilityProfile {
    return new AgentCapabilityProfile({
      agentId: props.agentId,
      name: props.name,
      domains: props.domains ?? [],
      overallSuccessRate: 0,
      totalTasksCompleted: 0,
      totalTasksFailed: 0,
      avgResponseMs: 0,
      totalTokensConsumed: 0,
      lastActiveAt: Date.now(),
      createdAt: Date.now(),
    });
  }

  static fromProps(props: AgentCapabilityProfileProps): AgentCapabilityProfile {
    return new AgentCapabilityProfile(props);
  }

  recordSuccess(domain: string, durationMs: number, tokenCost: number): AgentCapabilityProfile {
    const updatedDomains = this.updateDomain(domain, true, durationMs, tokenCost);
    const totalCompleted = this.totalTasksCompleted + 1;
    const totalTasks = totalCompleted + this.totalTasksFailed;

    return new AgentCapabilityProfile({
      ...this.toProps(),
      domains: updatedDomains,
      totalTasksCompleted: totalCompleted,
      overallSuccessRate: totalCompleted / totalTasks,
      avgResponseMs: this.computeNewAvg(this.avgResponseMs, this.totalTasksCompleted, durationMs),
      totalTokensConsumed: this.totalTokensConsumed + tokenCost,
      lastActiveAt: Date.now(),
    });
  }

  recordFailure(domain: string, durationMs: number, tokenCost: number): AgentCapabilityProfile {
    const updatedDomains = this.updateDomain(domain, false, durationMs, tokenCost);
    const totalFailed = this.totalTasksFailed + 1;
    const totalTasks = this.totalTasksCompleted + totalFailed;

    return new AgentCapabilityProfile({
      ...this.toProps(),
      domains: updatedDomains,
      totalTasksFailed: totalFailed,
      overallSuccessRate: this.totalTasksCompleted / totalTasks,
      totalTokensConsumed: this.totalTokensConsumed + tokenCost,
      lastActiveAt: Date.now(),
    });
  }

  getDomain(domain: string): CapabilityDomain | undefined {
    return this.domains.find((d) => d.domain === domain);
  }

  get totalTasks(): number {
    return this.totalTasksCompleted + this.totalTasksFailed;
  }

  get costPerTask(): number {
    if (this.totalTasks === 0) return 0;
    return this.totalTokensConsumed / this.totalTasks;
  }

  private updateDomain(
    domain: string,
    success: boolean,
    durationMs: number,
    tokenCost: number
  ): CapabilityDomain[] {
    const existing = this.domains.find((d) => d.domain === domain);
    if (!existing) {
      return [
        ...this.domains,
        {
          domain,
          successRate: success ? 1 : 0,
          totalExecutions: 1,
          avgDurationMs: durationMs,
          avgTokenCost: tokenCost,
        },
      ];
    }

    const totalExec = existing.totalExecutions + 1;
    const successes =
      Math.round(existing.successRate * existing.totalExecutions) + (success ? 1 : 0);

    const updated: CapabilityDomain = {
      domain,
      successRate: successes / totalExec,
      totalExecutions: totalExec,
      avgDurationMs: this.computeNewAvg(
        existing.avgDurationMs,
        existing.totalExecutions,
        durationMs
      ),
      avgTokenCost: this.computeNewAvg(existing.avgTokenCost, existing.totalExecutions, tokenCost),
    };

    return this.domains.map((d) => (d.domain === domain ? updated : d));
  }

  private computeNewAvg(currentAvg: number, currentCount: number, newValue: number): number {
    return Math.round((currentAvg * currentCount + newValue) / (currentCount + 1));
  }

  private toProps(): AgentCapabilityProfileProps {
    return {
      agentId: this.agentId,
      name: this.name,
      domains: [...this.domains],
      overallSuccessRate: this.overallSuccessRate,
      totalTasksCompleted: this.totalTasksCompleted,
      totalTasksFailed: this.totalTasksFailed,
      avgResponseMs: this.avgResponseMs,
      totalTokensConsumed: this.totalTokensConsumed,
      lastActiveAt: this.lastActiveAt,
      createdAt: this.createdAt,
    };
  }
}
