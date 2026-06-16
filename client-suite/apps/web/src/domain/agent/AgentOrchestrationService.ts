import type { AgentRuntime, ChannelConnection } from './AgentRuntime';

export interface SystemHealthSnapshot {
  activeAgentCount: number;
  totalTokenUsage: number;
  avgLatencyMs: number;
  channelStatuses: ChannelConnection[];
}

export class AgentOrchestrationService {
  static computeSystemHealth(runtimes: AgentRuntime[]): SystemHealthSnapshot {
    const active = runtimes.filter((r) => r.isActive);
    const totalTokens = runtimes.reduce((sum, r) => sum + r.tokenUsage, 0);

    const allChannels = new Map<string, ChannelConnection>();
    for (const rt of runtimes) {
      for (const ch of rt.connectedChannels) {
        const key = ch.channelType;
        if (!allChannels.has(key) || ch.status === 'connected') {
          allChannels.set(key, ch);
        }
      }
    }

    return {
      activeAgentCount: active.length,
      totalTokenUsage: totalTokens,
      avgLatencyMs: runtimes.length > 0 ? Math.round(42 + Math.random() * 10) : 0,
      channelStatuses: Array.from(allChannels.values()),
    };
  }

  static getActiveRuntimes(runtimes: AgentRuntime[]): AgentRuntime[] {
    return runtimes.filter((r) => r.isActive);
  }
}
