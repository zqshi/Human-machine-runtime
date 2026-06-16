/**
 * SignalBus — 异步信号总线
 *
 * 信号分级路由 + 噪声过滤 + 聚合窗口。
 * 纯域模型，零外部依赖。
 */

export type SignalLevel = 'critical' | 'high' | 'normal' | 'low';

export interface BusSignal {
  readonly id: string;
  readonly type: string;
  readonly level: SignalLevel;
  readonly payload: unknown;
  readonly timestamp: number;
  readonly source?: string;
}

export interface NoiseFilter {
  readonly id: string;
  test(signal: BusSignal): boolean;
}

export interface AggregationWindow {
  readonly type: string;
  readonly windowMs: number;
  readonly maxBatchSize: number;
}

type SignalHandler = (signal: BusSignal) => void;
type BatchHandler = (signals: BusSignal[]) => void;

export class SignalBus {
  private handlers = new Map<string, Set<SignalHandler>>();
  private levelHandlers = new Map<SignalLevel, Set<SignalHandler>>();
  private wildcardHandlers = new Set<SignalHandler>();
  private filters: NoiseFilter[] = [];
  private windows = new Map<string, AggregationWindow>();
  private windowBuffers = new Map<string, BusSignal[]>();
  private windowTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private batchHandlers = new Map<string, Set<BatchHandler>>();

  onSignal(type: string, handler: SignalHandler): () => void {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, new Set());
    }
    this.handlers.get(type)!.add(handler);
    return () => {
      this.handlers.get(type)?.delete(handler);
    };
  }

  onLevel(level: SignalLevel, handler: SignalHandler): () => void {
    if (!this.levelHandlers.has(level)) {
      this.levelHandlers.set(level, new Set());
    }
    this.levelHandlers.get(level)!.add(handler);
    return () => {
      this.levelHandlers.get(level)?.delete(handler);
    };
  }

  onAll(handler: SignalHandler): () => void {
    this.wildcardHandlers.add(handler);
    return () => {
      this.wildcardHandlers.delete(handler);
    };
  }

  onBatch(type: string, handler: BatchHandler): () => void {
    if (!this.batchHandlers.has(type)) {
      this.batchHandlers.set(type, new Set());
    }
    this.batchHandlers.get(type)!.add(handler);
    return () => {
      this.batchHandlers.get(type)?.delete(handler);
    };
  }

  emit(signal: BusSignal): boolean {
    if (this.isFiltered(signal)) return false;

    const window = this.windows.get(signal.type);
    if (window) {
      this.bufferSignal(signal, window);
      return true;
    }

    this.dispatch(signal);
    return true;
  }

  addFilter(filter: NoiseFilter): void {
    this.filters.push(filter);
  }

  removeFilter(filterId: string): void {
    this.filters = this.filters.filter((f) => f.id !== filterId);
  }

  setAggregationWindow(window: AggregationWindow): void {
    this.windows.set(window.type, window);
  }

  removeAggregationWindow(type: string): void {
    this.windows.delete(type);
    const timer = this.windowTimers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.windowTimers.delete(type);
    }
    this.windowBuffers.delete(type);
  }

  getActiveFilters(): readonly NoiseFilter[] {
    return this.filters;
  }

  getAggregationWindows(): ReadonlyMap<string, AggregationWindow> {
    return this.windows;
  }

  dispose(): void {
    this.handlers.clear();
    this.levelHandlers.clear();
    this.wildcardHandlers.clear();
    this.filters = [];
    for (const timer of this.windowTimers.values()) {
      clearTimeout(timer);
    }
    this.windowTimers.clear();
    this.windowBuffers.clear();
    this.batchHandlers.clear();
  }

  private isFiltered(signal: BusSignal): boolean {
    return this.filters.some((f) => f.test(signal));
  }

  private dispatch(signal: BusSignal): void {
    const typeHandlers = this.handlers.get(signal.type);
    if (typeHandlers) {
      typeHandlers.forEach((h) => h(signal));
    }

    const lvlHandlers = this.levelHandlers.get(signal.level);
    if (lvlHandlers) {
      lvlHandlers.forEach((h) => h(signal));
    }

    this.wildcardHandlers.forEach((h) => h(signal));
  }

  private bufferSignal(signal: BusSignal, window: AggregationWindow): void {
    const buffer = this.windowBuffers.get(signal.type) ?? [];
    buffer.push(signal);
    this.windowBuffers.set(signal.type, buffer);

    if (buffer.length >= window.maxBatchSize) {
      this.flushBuffer(signal.type);
      return;
    }

    if (!this.windowTimers.has(signal.type)) {
      const timer = setTimeout(() => {
        this.flushBuffer(signal.type);
      }, window.windowMs);
      this.windowTimers.set(signal.type, timer);
    }
  }

  private flushBuffer(type: string): void {
    const buffer = this.windowBuffers.get(type);
    if (!buffer || buffer.length === 0) return;

    this.windowBuffers.set(type, []);
    const timer = this.windowTimers.get(type);
    if (timer) {
      clearTimeout(timer);
      this.windowTimers.delete(type);
    }

    const batchH = this.batchHandlers.get(type);
    if (batchH) {
      batchH.forEach((h) => h(buffer));
    }

    buffer.forEach((s) => this.dispatch(s));
  }

  static createSignal(
    type: string,
    level: SignalLevel,
    payload: unknown,
    source?: string
  ): BusSignal {
    return {
      id: `sig-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      level,
      payload,
      timestamp: Date.now(),
      source,
    };
  }
}
