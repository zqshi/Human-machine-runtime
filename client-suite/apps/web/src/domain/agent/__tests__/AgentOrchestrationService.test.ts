import { describe, it, expect } from 'vitest';
import { AgentOrchestrationService } from '../AgentOrchestrationService';
import { AgentRuntime } from '../AgentRuntime';

function runtime(overrides: Partial<Parameters<typeof AgentRuntime.create>[0]> = {}) {
  return AgentRuntime.create({
    agentId: 'a1',
    runtimeStatus: 'idle',
    currentTaskId: null,
    tokenUsage: 100,
    lastActiveAt: Date.now(),
    connectedChannels: [],
    ...overrides,
  });
}

describe('AgentOrchestrationService', () => {
  describe('computeSystemHealth', () => {
    it('counts active agents', () => {
      const runtimes = [
        runtime({ agentId: 'a1', runtimeStatus: 'working' }),
        runtime({ agentId: 'a2', runtimeStatus: 'idle' }),
        runtime({ agentId: 'a3', runtimeStatus: 'monitoring' }),
      ];
      const health = AgentOrchestrationService.computeSystemHealth(runtimes);
      expect(health.activeAgentCount).toBe(2);
    });

    it('sums total token usage', () => {
      const runtimes = [runtime({ tokenUsage: 200 }), runtime({ tokenUsage: 300 })];
      const health = AgentOrchestrationService.computeSystemHealth(runtimes);
      expect(health.totalTokenUsage).toBe(500);
    });

    it('returns zero latency for empty runtimes', () => {
      const health = AgentOrchestrationService.computeSystemHealth([]);
      expect(health.avgLatencyMs).toBe(0);
    });

    it('deduplicates channels by type, preferring connected', () => {
      const runtimes = [
        runtime({
          agentId: 'a1',
          connectedChannels: [{ channelType: 'lark', status: 'disconnected', lastSyncAt: 1 }],
        }),
        runtime({
          agentId: 'a2',
          connectedChannels: [{ channelType: 'lark', status: 'connected', lastSyncAt: 2 }],
        }),
      ];
      const health = AgentOrchestrationService.computeSystemHealth(runtimes);
      expect(health.channelStatuses).toHaveLength(1);
      expect(health.channelStatuses[0].status).toBe('connected');
    });
  });

  describe('getActiveRuntimes', () => {
    it('filters to only active runtimes', () => {
      const runtimes = [
        runtime({ agentId: 'a1', runtimeStatus: 'working' }),
        runtime({ agentId: 'a2', runtimeStatus: 'idle' }),
        runtime({ agentId: 'a3', runtimeStatus: 'offline' }),
      ];
      const active = AgentOrchestrationService.getActiveRuntimes(runtimes);
      expect(active).toHaveLength(1);
      expect(active[0].agentId).toBe('a1');
    });
  });
});
