import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AnalyticsService } from './analytics-service.js';
import type { AiGatewayRepository } from '../../db/repositories/ai-gateway-repository.js';
import type { InstanceService } from '../tenant-instance/instance-service.js';

function mockInstances(
  items: Array<{
    id: string;
    name: string;
    state: string;
    department?: string;
    lastError?: string;
    updatedAt?: string;
  }> = []
): InstanceService {
  return {
    list: vi.fn(async () => items),
  } as unknown as InstanceService;
}

function mockAiRepo(
  overrides: {
    traceStats?: Partial<{
      totalCalls: number;
      totalTokens: number;
      avgLatency: number;
      errorRate: number;
    }>;
    costSummary?: Partial<{
      totalCostCny: number;
      recordCount: number;
    }>;
  } = {}
): AiGatewayRepository {
  return {
    getTraceStats: vi.fn(async () => ({
      totalCalls: 100,
      totalTokens: 5000,
      avgLatency: 200,
      errorRate: 2,
      ...overrides.traceStats,
    })),
    getCostSummary: vi.fn(async () => ({
      totalCostCny: 50,
      totalPromptTokens: 3000,
      totalCompletionTokens: 2000,
      recordCount: 100,
      ...overrides.costSummary,
    })),
  } as unknown as AiGatewayRepository;
}

function mockDb(selectResult: unknown[] = []) {
  const chainable = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(selectResult),
  };
  chainable.from.mockReturnValue(chainable);
  return {
    execute: vi.fn(async () => [{ '?column?': 1 }]),
    select: vi.fn(() => chainable),
  } as unknown as Parameters<(typeof AnalyticsService)['prototype']['checkDbHealth']> extends never
    ? never
    : ReturnType<typeof vi.fn>;
}

describe('AnalyticsService', () => {
  describe('getHealthMetrics', () => {
    it('returns score=100 when all instances running', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo(),
        mockInstances([
          { id: 'i1', name: 'A', state: 'running' },
          { id: 'i2', name: 'B', state: 'running' },
        ])
      );
      const result = await svc.getHealthMetrics();
      expect(result.score).toBe(100);
      expect(result.metrics).toHaveLength(4);
    });

    it('returns score=50 when half instances running', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo(),
        mockInstances([
          { id: 'i1', name: 'A', state: 'running' },
          { id: 'i2', name: 'B', state: 'failed' },
        ])
      );
      const result = await svc.getHealthMetrics();
      expect(result.score).toBe(50);
    });

    it('returns score=100 when no instances', async () => {
      const svc = new AnalyticsService(mockDb() as never, mockAiRepo(), mockInstances());
      const result = await svc.getHealthMetrics();
      expect(result.score).toBe(100);
    });

    it('marks error rate warn when >= 5%', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo({ traceStats: { errorRate: 8 } }),
        mockInstances([{ id: 'i1', name: 'A', state: 'running' }])
      );
      const result = await svc.getHealthMetrics();
      const aiError = result.metrics.find((m) => m.label === 'AI 错误率');
      expect(aiError?.status).toBe('warn');
    });

    it('marks latency warn when >= 3000ms', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo({ traceStats: { avgLatency: 5000 } }),
        mockInstances([{ id: 'i1', name: 'A', state: 'running' }])
      );
      const result = await svc.getHealthMetrics();
      const latency = result.metrics.find((m) => m.label === 'AI 平均延迟');
      expect(latency?.status).toBe('warn');
    });
  });

  describe('getAlerts', () => {
    it('returns empty when no issues', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo(),
        mockInstances([{ id: 'i1', name: 'A', state: 'running' }])
      );
      const result = await svc.getAlerts();
      expect(result.activeAlerts).toBe(0);
      expect(result.alerts).toEqual([]);
    });

    it('reports failed instances', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo(),
        mockInstances([
          { id: 'i1', name: 'FailBot', state: 'failed', lastError: 'OOM', updatedAt: '2024-01-01' },
        ])
      );
      const result = await svc.getAlerts();
      expect(result.activeAlerts).toBe(1);
      expect(result.alerts[0].level).toBe('error');
      expect(result.alerts[0].message).toContain('FailBot');
    });

    it('reports high error rate', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo({ traceStats: { errorRate: 15 } }),
        mockInstances([])
      );
      const result = await svc.getAlerts();
      expect(result.alerts.some((a) => a.level === 'warning')).toBe(true);
    });
  });

  describe('getLogStats', () => {
    it('returns stats from repo', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo({
          traceStats: { totalCalls: 42, avgLatency: 150, errorRate: 1, totalTokens: 9000 },
        }),
        mockInstances()
      );
      const result = await svc.getLogStats();
      expect(result.totalRequests24h).toBe(42);
      expect(result.avgLatency).toBe(150);
      expect(result.totalTokens).toBe(9000);
    });
  });

  describe('getCostSummary', () => {
    it('computes daily average', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo({ costSummary: { totalCostCny: 300, recordCount: 30 } }),
        mockInstances()
      );
      const result = await svc.getCostSummary();
      expect(result.totalCostCny).toBe(300);
      expect(result.dailyAvg).toBe(10);
    });

    it('returns 0 average when no records', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo({ costSummary: { totalCostCny: 0, recordCount: 0 } }),
        mockInstances()
      );
      const result = await svc.getCostSummary();
      expect(result.dailyAvg).toBe(0);
    });
  });

  describe('getPerformanceSummary', () => {
    it('computes throughput from totalCalls', async () => {
      const svc = new AnalyticsService(
        mockDb() as never,
        mockAiRepo({ traceStats: { totalCalls: 240 } }),
        mockInstances()
      );
      const result = await svc.getPerformanceSummary();
      expect(result.throughput).toBe(10);
    });
  });

  describe('checkDbHealth', () => {
    it('returns healthy on success', async () => {
      const db = mockDb();
      const svc = new AnalyticsService(db as never, mockAiRepo(), mockInstances());
      expect(await svc.checkDbHealth()).toBe('healthy');
    });

    it('returns unhealthy on failure', async () => {
      const db = mockDb();
      (db.execute as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('connection lost'));
      const svc = new AnalyticsService(db as never, mockAiRepo(), mockInstances());
      expect(await svc.checkDbHealth()).toBe('unhealthy');
    });
  });
});
