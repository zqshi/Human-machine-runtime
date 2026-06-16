import { describe, it, expect, vi } from 'vitest';
import { SignalBus, type BusSignal, type NoiseFilter } from '../SignalBus';

function makeSig(overrides?: Partial<BusSignal>): BusSignal {
  return {
    id: `sig-${Date.now()}`,
    type: 'test-event',
    level: 'normal',
    payload: { foo: 'bar' },
    timestamp: Date.now(),
    ...overrides,
  };
}

describe('SignalBus', () => {
  it('dispatches signal to type subscribers', () => {
    const bus = new SignalBus();
    const handler = vi.fn();
    bus.onSignal('test-event', handler);
    bus.emit(makeSig());
    expect(handler).toHaveBeenCalledTimes(1);
    bus.dispose();
  });

  it('dispatches signal to level subscribers', () => {
    const bus = new SignalBus();
    const handler = vi.fn();
    bus.onLevel('critical', handler);
    bus.emit(makeSig({ level: 'critical' }));
    bus.emit(makeSig({ level: 'normal' }));
    expect(handler).toHaveBeenCalledTimes(1);
    bus.dispose();
  });

  it('dispatches signal to wildcard subscribers', () => {
    const bus = new SignalBus();
    const handler = vi.fn();
    bus.onAll(handler);
    bus.emit(makeSig({ type: 'a' }));
    bus.emit(makeSig({ type: 'b' }));
    expect(handler).toHaveBeenCalledTimes(2);
    bus.dispose();
  });

  it('unsubscribe removes handler', () => {
    const bus = new SignalBus();
    const handler = vi.fn();
    const unsub = bus.onSignal('test-event', handler);
    unsub();
    bus.emit(makeSig());
    expect(handler).not.toHaveBeenCalled();
    bus.dispose();
  });

  it('filters noise signals', () => {
    const bus = new SignalBus();
    const handler = vi.fn();
    bus.onSignal('test-event', handler);

    const filter: NoiseFilter = {
      id: 'block-low',
      test: (s) => s.level === 'low',
    };
    bus.addFilter(filter);

    bus.emit(makeSig({ level: 'low' }));
    expect(handler).not.toHaveBeenCalled();

    bus.emit(makeSig({ level: 'normal' }));
    expect(handler).toHaveBeenCalledTimes(1);

    bus.removeFilter('block-low');
    bus.emit(makeSig({ level: 'low' }));
    expect(handler).toHaveBeenCalledTimes(2);

    bus.dispose();
  });

  it('aggregation window batches signals', async () => {
    vi.useFakeTimers();
    const bus = new SignalBus();
    const typeHandler = vi.fn();
    const batchHandler = vi.fn();
    bus.onSignal('batch-type', typeHandler);
    bus.onBatch('batch-type', batchHandler);

    bus.setAggregationWindow({ type: 'batch-type', windowMs: 100, maxBatchSize: 10 });

    bus.emit(makeSig({ type: 'batch-type', id: 's1' }));
    bus.emit(makeSig({ type: 'batch-type', id: 's2' }));

    expect(typeHandler).not.toHaveBeenCalled();
    expect(batchHandler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(batchHandler).toHaveBeenCalledTimes(1);
    expect(batchHandler.mock.calls[0][0]).toHaveLength(2);
    expect(typeHandler).toHaveBeenCalledTimes(2);

    bus.dispose();
    vi.useRealTimers();
  });

  it('aggregation window flushes at max batch size', () => {
    vi.useFakeTimers();
    const bus = new SignalBus();
    const batchHandler = vi.fn();
    bus.onBatch('flush-type', batchHandler);

    bus.setAggregationWindow({ type: 'flush-type', windowMs: 10000, maxBatchSize: 3 });

    bus.emit(makeSig({ type: 'flush-type', id: 's1' }));
    bus.emit(makeSig({ type: 'flush-type', id: 's2' }));
    bus.emit(makeSig({ type: 'flush-type', id: 's3' }));

    expect(batchHandler).toHaveBeenCalledTimes(1);
    expect(batchHandler.mock.calls[0][0]).toHaveLength(3);

    bus.dispose();
    vi.useRealTimers();
  });

  it('createSignal produces valid signal', () => {
    const sig = SignalBus.createSignal('my-event', 'high', { data: 1 }, 'agent-A');
    expect(sig.type).toBe('my-event');
    expect(sig.level).toBe('high');
    expect(sig.source).toBe('agent-A');
    expect(sig.id).toMatch(/^sig-/);
  });

  it('dispose clears all handlers and timers', () => {
    const bus = new SignalBus();
    const handler = vi.fn();
    bus.onSignal('test', handler);
    bus.onLevel('critical', handler);
    bus.onAll(handler);
    bus.dispose();
    bus.emit(makeSig({ type: 'test', level: 'critical' }));
    expect(handler).not.toHaveBeenCalled();
  });
});
