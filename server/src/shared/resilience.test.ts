import { describe, it, expect, vi } from 'vitest';
import {
  CircuitBreaker,
  CircuitOpenError,
  TimeoutError,
  retryWithBackoff,
  withTimeout,
} from './resilience.js';

/**
 * 韧性原语单测：CircuitBreaker（熔断状态机）、retryWithBackoff（指数退避重试）、withTimeout。
 * 时间/睡眠均注入，保证测试确定、不依赖真实时钟或随机种子。
 */

describe('CircuitBreaker', () => {
  function makeBreaker(
    over: Partial<{
      failureThreshold: number;
      resetTimeoutMs: number;
      halfOpenSuccessThreshold: number;
    }> = {}
  ) {
    let t = 1000;
    const breaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 5000,
      halfOpenSuccessThreshold: 2,
      now: () => t,
      ...over,
    });
    return {
      breaker,
      advance: (ms: number) => {
        t += ms;
      },
    };
  }

  it('闭合状态连续失败达阈值 → 打开', async () => {
    const { breaker } = makeBreaker();
    for (let i = 0; i < 3; i++) {
      await expect(breaker.execute(() => Promise.reject(new Error('fail')))).rejects.toThrow(
        'fail'
      );
    }
    expect(breaker.state).toBe('open');
  });

  it('打开状态拒绝请求：抛 CircuitOpenError 且不调 fn', async () => {
    const { breaker } = makeBreaker();
    const fn = vi.fn(() => Promise.reject(new Error('fail')));
    for (let i = 0; i < 3; i++) await breaker.execute(fn).catch(() => {});
    fn.mockClear();
    await expect(breaker.execute(fn)).rejects.toBeInstanceOf(CircuitOpenError);
    expect(fn).not.toHaveBeenCalled();
  });

  it('打开经过 resetTimeout → 半开，允许试探请求', async () => {
    const { breaker, advance } = makeBreaker();
    for (let i = 0; i < 3; i++)
      await breaker.execute(() => Promise.reject(new Error('x'))).catch(() => {});
    expect(breaker.state).toBe('open');
    advance(5001);
    const fn = vi.fn(() => Promise.resolve('ok'));
    const r = await breaker.execute(fn);
    expect(r).toBe('ok');
    expect(breaker.state).toBe('half-open');
  });

  it('半开连续成功达阈值 → 闭合', async () => {
    const { breaker, advance } = makeBreaker();
    for (let i = 0; i < 3; i++)
      await breaker.execute(() => Promise.reject(new Error('x'))).catch(() => {});
    advance(5001);
    await breaker.execute(() => Promise.resolve(1));
    await breaker.execute(() => Promise.resolve(2));
    expect(breaker.state).toBe('closed');
  });

  it('半开失败 → 重新打开', async () => {
    const { breaker, advance } = makeBreaker();
    for (let i = 0; i < 3; i++)
      await breaker.execute(() => Promise.reject(new Error('x'))).catch(() => {});
    advance(5001);
    await breaker.execute(() => Promise.resolve(1));
    await expect(breaker.execute(() => Promise.reject(new Error('boom')))).rejects.toThrow('boom');
    expect(breaker.state).toBe('open');
  });

  it('成功重置失败计数（避免历史失败累积误开）', async () => {
    const { breaker } = makeBreaker();
    await breaker.execute(() => Promise.reject(new Error('x'))).catch(() => {});
    await breaker.execute(() => Promise.reject(new Error('x'))).catch(() => {});
    await breaker.execute(() => Promise.resolve('ok')); // 成功，重置计数
    await breaker.execute(() => Promise.reject(new Error('x'))).catch(() => {});
    await breaker.execute(() => Promise.reject(new Error('x'))).catch(() => {});
    expect(breaker.state).toBe('closed'); // 重置后仅 2 次失败，未到阈值 3
  });
});

describe('retryWithBackoff', () => {
  const noSleep = () => Promise.resolve();

  it('首次成功不重试、不 sleep', async () => {
    const fn = vi.fn(async () => 'ok');
    const sleeps: number[] = [];
    const r = await retryWithBackoff(fn, {
      maxAttempts: 3,
      baseDelayMs: 10,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    });
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledOnce();
    expect(sleeps).toEqual([]);
  });

  it('失败重试到成功', async () => {
    let calls = 0;
    const fn = vi.fn(async () => {
      calls += 1;
      if (calls < 3) throw new Error('fail');
      return 'ok';
    });
    const r = await retryWithBackoff(fn, { maxAttempts: 3, baseDelayMs: 10, sleep: noSleep });
    expect(r).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('超过 maxAttempts 抛最后一次错误', async () => {
    const fn = vi.fn(async () => {
      throw new Error('always');
    });
    await expect(
      retryWithBackoff(fn, { maxAttempts: 2, baseDelayMs: 10, sleep: noSleep })
    ).rejects.toThrow('always');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('shouldRetry=false 的错误立即抛出，不重试', async () => {
    const fn = vi.fn(async () => {
      throw new TypeError('bad arg');
    });
    await expect(
      retryWithBackoff(fn, {
        maxAttempts: 3,
        baseDelayMs: 10,
        shouldRetry: (e) => !(e instanceof TypeError),
        sleep: noSleep,
      })
    ).rejects.toThrow(TypeError);
    expect(fn).toHaveBeenCalledOnce();
  });

  it('退避指数增长且有界（每次落在 [base·2^i, base·2^(i+1)) 内）', async () => {
    const sleeps: number[] = [];
    const fn = vi.fn(async () => {
      throw new Error('x');
    });
    await retryWithBackoff(fn, {
      maxAttempts: 4,
      baseDelayMs: 100,
      maxDelayMs: 10_000,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    }).catch(() => {});
    expect(sleeps).toHaveLength(3);
    expect(sleeps[0]).toBeGreaterThanOrEqual(100);
    expect(sleeps[0]).toBeLessThan(200);
    expect(sleeps[1]).toBeGreaterThanOrEqual(200);
    expect(sleeps[1]).toBeLessThan(400);
    expect(sleeps[2]).toBeGreaterThanOrEqual(400);
    expect(sleeps[2]).toBeLessThan(800);
  });

  it('退避不超过 maxDelayMs', async () => {
    const sleeps: number[] = [];
    const fn = vi.fn(async () => {
      throw new Error('x');
    });
    await retryWithBackoff(fn, {
      maxAttempts: 8,
      baseDelayMs: 1000,
      maxDelayMs: 3000,
      sleep: (ms) => {
        sleeps.push(ms);
        return Promise.resolve();
      },
    }).catch(() => {});
    for (const s of sleeps) expect(s).toBeLessThanOrEqual(3000);
  });
});

describe('withTimeout', () => {
  it('及时完成返回结果', async () => {
    const r = await withTimeout(Promise.resolve('ok'), 1000);
    expect(r).toBe('ok');
  });

  it('超时抛 TimeoutError', async () => {
    const never = new Promise<string>(() => {}); // 既不 resolve 也不 reject
    await expect(withTimeout(never, 30)).rejects.toBeInstanceOf(TimeoutError);
  });
});
