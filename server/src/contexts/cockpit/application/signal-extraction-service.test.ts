import { describe, it, expect, vi } from 'vitest';
import { SignalExtractionService } from './signal-extraction-service.js';
import { EmergentSignal } from '../domain/sensing/emergent-signal.js';

type TraceRow = { traceId: string; operationName: string; status: string };

function mockAiGatewayRepo(traces: TraceRow[]) {
  return {
    listTraces: vi.fn().mockImplementation((filters?: { status?: string }) => {
      const items = filters?.status ? traces.filter((t) => t.status === filters.status) : traces;
      return Promise.resolve({ items, total: items.length, page: 1 });
    }),
  } as never;
}

function mockEmergentSignalRepo(existing: EmergentSignal[] = []) {
  return {
    list: vi.fn().mockResolvedValue(existing),
    save: vi.fn().mockResolvedValue(undefined),
  } as never;
}

const mockEventBus = { publish: vi.fn() };

describe('SignalExtractionService', () => {
  it('无 error/failed trace → 返回空，不发事件', async () => {
    const svc = new SignalExtractionService(
      mockAiGatewayRepo([]),
      mockEmergentSignalRepo(),
      mockEventBus
    );
    const signals = await svc.extract({ sinceMinutes: 30 });
    expect(signals).toEqual([]);
    expect(mockEventBus.publish).not.toHaveBeenCalled();
  });

  it('同 operationName 失败 >= threshold → 生成信号 + save + publish', async () => {
    const traces: TraceRow[] = [
      { traceId: 't1', operationName: 'tool.exec', status: 'error' },
      { traceId: 't2', operationName: 'tool.exec', status: 'failed' },
    ];
    const repo = mockEmergentSignalRepo();
    const svc = new SignalExtractionService(mockAiGatewayRepo(traces), repo, mockEventBus);
    const signals = await svc.extract({ sinceMinutes: 30, failureThreshold: 2 });
    expect(signals).toHaveLength(1);
    expect(signals[0].pattern).toContain('tool.exec');
    expect(signals[0].pattern).toContain('2 次');
    expect(signals[0].severity).toBe('medium'); // 2 次 = medium
    expect(signals[0].correlatedCount).toBe(2);
    expect(repo.save).toHaveBeenCalledTimes(1);
    expect(mockEventBus.publish).toHaveBeenCalledWith(
      'emergent-signal:detected',
      expect.any(Object)
    );
  });

  it('查 error + failed 两次（listTraces 调 2 次）', async () => {
    const aiRepo = mockAiGatewayRepo([]);
    const svc = new SignalExtractionService(aiRepo, mockEmergentSignalRepo(), mockEventBus);
    await svc.extract({ sinceMinutes: 30 });
    expect(aiRepo.listTraces).toHaveBeenCalledTimes(2);
  });

  it('单次失败 < threshold → 不生成', async () => {
    const traces: TraceRow[] = [{ traceId: 't1', operationName: 'tool.exec', status: 'error' }];
    const repo = mockEmergentSignalRepo();
    const svc = new SignalExtractionService(mockAiGatewayRepo(traces), repo, mockEventBus);
    const signals = await svc.extract({ failureThreshold: 2 });
    expect(signals).toEqual([]);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('severity: 3 次=high, 5 次=critical', async () => {
    const mk = (n: number, op: string) =>
      Array.from({ length: n }, (_, i) => ({
        traceId: `t${i}`,
        operationName: op,
        status: 'error',
      })) as TraceRow[];

    const svc3 = new SignalExtractionService(
      mockAiGatewayRepo(mk(3, 'op3')),
      mockEmergentSignalRepo(),
      mockEventBus
    );
    expect((await svc3.extract({ failureThreshold: 2 }))[0].severity).toBe('high');

    const svc5 = new SignalExtractionService(
      mockAiGatewayRepo(mk(5, 'op5')),
      mockEmergentSignalRepo(),
      mockEventBus
    );
    expect((await svc5.extract({ failureThreshold: 2 }))[0].severity).toBe('critical');
  });

  it('去重：同 pattern 已有 → 跳过', async () => {
    const traces: TraceRow[] = [
      { traceId: 't1', operationName: 'op', status: 'error' },
      { traceId: 't2', operationName: 'op', status: 'error' },
    ];
    const existing = EmergentSignal.create({
      pattern: '操作「op」近 30 分钟失败 2 次',
      severity: 'medium',
    });
    const repo = mockEmergentSignalRepo([existing]);
    const svc = new SignalExtractionService(mockAiGatewayRepo(traces), repo, mockEventBus);
    const signals = await svc.extract({ sinceMinutes: 30, failureThreshold: 2 });
    expect(signals).toEqual([]);
    expect(repo.save).not.toHaveBeenCalled();
  });

  it('不同 operationName 各自聚合', async () => {
    const traces: TraceRow[] = [
      { traceId: 't1', operationName: 'opA', status: 'error' },
      { traceId: 't2', operationName: 'opA', status: 'error' },
      { traceId: 't3', operationName: 'opB', status: 'error' },
      { traceId: 't4', operationName: 'opB', status: 'error' },
    ];
    const svc = new SignalExtractionService(
      mockAiGatewayRepo(traces),
      mockEmergentSignalRepo(),
      mockEventBus
    );
    const signals = await svc.extract({ failureThreshold: 2 });
    expect(signals).toHaveLength(2);
    const ops = signals.map((s) => s.pattern).sort();
    expect(ops[0]).toContain('opA');
    expect(ops[1]).toContain('opB');
  });
});
