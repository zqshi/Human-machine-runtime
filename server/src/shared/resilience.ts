/**
 * 韧性原语：CircuitBreaker（熔断）、retryWithBackoff（指数退避重试）、withTimeout（超时）。
 *
 * 用于包装外部调用（LLM/工具/MCP/渠道/gateway），防止级联失败与雪崩。
 * 时间与睡眠均可注入，便于测试；生产用 Date.now / setTimeout / Math.random。
 */

export class CircuitOpenError extends Error {
  constructor() {
    super('circuit breaker open');
    this.name = 'CircuitOpenError';
  }
}

export class TimeoutError extends Error {
  constructor(ms: number) {
    super(`operation timed out after ${ms}ms`);
    this.name = 'TimeoutError';
  }
}

// ── CircuitBreaker ──────────────────────────────────────────────────

type BreakerState = 'closed' | 'open' | 'half-open';

export interface CircuitBreakerOptions {
  /** 连续失败达此数 → 打开 */
  failureThreshold: number;
  /** 打开后经过此时长 → 进入半开（允许试探） */
  resetTimeoutMs: number;
  /** 半开连续成功达此数 → 闭合 */
  halfOpenSuccessThreshold: number;
  /** 注入时钟（测试） */
  now?: () => number;
}

export class CircuitBreaker {
  private _state: BreakerState = 'closed';
  private failureCount = 0;
  private successCount = 0;
  private openedAt = 0;
  private readonly now: () => number;

  constructor(private readonly opts: CircuitBreakerOptions) {
    this.now = opts.now ?? Date.now;
  }

  /** 当前状态（惰性把过期的 open 转为 half-open） */
  get state(): BreakerState {
    if (this._state === 'open' && this.now() - this.openedAt >= this.opts.resetTimeoutMs) {
      this._state = 'half-open';
      this.successCount = 0;
    }
    return this._state;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === 'open') {
      throw new CircuitOpenError();
    }
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this._state === 'half-open') {
      this.successCount += 1;
      if (this.successCount >= this.opts.halfOpenSuccessThreshold) this.close();
      return;
    }
    this.failureCount = 0; // closed 成功 → 重置失败计数
  }

  private onFailure(): void {
    if (this._state === 'half-open') {
      this.trip(); // 半开失败 → 立即重新打开
      return;
    }
    this.failureCount += 1;
    if (this.failureCount >= this.opts.failureThreshold) this.trip();
  }

  private trip(): void {
    this._state = 'open';
    this.openedAt = this.now();
    this.failureCount = 0;
    this.successCount = 0;
  }

  private close(): void {
    this._state = 'closed';
    this.failureCount = 0;
    this.successCount = 0;
  }
}

// ── retryWithBackoff ────────────────────────────────────────────────

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  maxDelayMs?: number;
  /** 哪些错误值得重试（默认全部）。返回 false 立即抛出 */
  shouldRetry?: (err: unknown) => boolean;
  /** 注入睡眠（测试） */
  sleep?: (ms: number) => Promise<void>;
}

export async function retryWithBackoff<T>(fn: () => Promise<T>, opts: RetryOptions): Promise<T> {
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const shouldRetry = opts.shouldRetry ?? (() => true);
  const maxDelay = opts.maxDelayMs ?? Number.MAX_SAFE_INTEGER;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt >= opts.maxAttempts) break;
      if (!shouldRetry(err)) break;
      // 指数退避：第 attempt 次失败后等 base·2^(attempt-1)，jitter 落在 [delay, delay·2)
      const exp = opts.baseDelayMs * 2 ** (attempt - 1);
      const capped = Math.min(exp, maxDelay);
      const jittered = Math.min(capped * (1 + Math.random()), maxDelay);
      await sleep(jittered);
    }
  }
  throw lastErr;
}

// ── withTimeout ─────────────────────────────────────────────────────

export async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new TimeoutError(ms)), ms);
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
