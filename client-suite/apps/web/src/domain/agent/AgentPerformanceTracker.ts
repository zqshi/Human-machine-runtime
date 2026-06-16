/**
 * AgentPerformanceTracker — Agent 绩效追踪器
 *
 * 从 TaskContract 完成记录自动更新 AgentCapabilityProfile。
 */

import { AgentCapabilityProfile } from './AgentCapabilityProfile';
import type { TaskContract } from './TaskContract';

export type TaskOutcome = 'success' | 'failure';

export interface TaskCompletionRecord {
  readonly taskId: string;
  readonly contractId: string;
  readonly agentId: string;
  readonly outcome: TaskOutcome;
  readonly durationMs: number;
  readonly tokenCost: number;
  readonly domain: string;
  readonly completedAt: number;
}

export class AgentPerformanceTracker {
  private profiles: Map<string, AgentCapabilityProfile>;

  private constructor(profiles: Map<string, AgentCapabilityProfile>) {
    this.profiles = profiles;
  }

  static create(): AgentPerformanceTracker {
    return new AgentPerformanceTracker(new Map());
  }

  static fromProfiles(profiles: AgentCapabilityProfile[]): AgentPerformanceTracker {
    const map = new Map<string, AgentCapabilityProfile>();
    for (const p of profiles) {
      map.set(p.agentId, p);
    }
    return new AgentPerformanceTracker(map);
  }

  recordCompletion(record: TaskCompletionRecord): AgentCapabilityProfile {
    let profile = this.profiles.get(record.agentId);
    if (!profile) {
      profile = AgentCapabilityProfile.create({ agentId: record.agentId, name: record.agentId });
    }

    const updated =
      record.outcome === 'success'
        ? profile.recordSuccess(record.domain, record.durationMs, record.tokenCost)
        : profile.recordFailure(record.domain, record.durationMs, record.tokenCost);

    this.profiles.set(record.agentId, updated);
    return updated;
  }

  recordFromContract(
    agentId: string,
    contract: TaskContract,
    outcome: TaskOutcome,
    durationMs: number,
    tokenCost: number
  ): AgentCapabilityProfile {
    const domain = contract.publishedIntents[0] ?? 'general';
    return this.recordCompletion({
      taskId: `task-${Date.now()}`,
      contractId: contract.id,
      agentId,
      outcome,
      durationMs,
      tokenCost,
      domain,
      completedAt: Date.now(),
    });
  }

  getProfile(agentId: string): AgentCapabilityProfile | undefined {
    return this.profiles.get(agentId);
  }

  getAllProfiles(): AgentCapabilityProfile[] {
    return [...this.profiles.values()];
  }

  getTopPerformers(domain: string, limit: number = 5): AgentCapabilityProfile[] {
    return this.getAllProfiles()
      .filter((p) => p.getDomain(domain) !== undefined)
      .sort((a, b) => {
        const aDomain = a.getDomain(domain)!;
        const bDomain = b.getDomain(domain)!;
        return bDomain.successRate - aDomain.successRate;
      })
      .slice(0, limit);
  }

  removeProfile(agentId: string): void {
    this.profiles.delete(agentId);
  }
}
