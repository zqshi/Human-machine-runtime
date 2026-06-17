import type { Context, Next } from 'hono';
import { config } from '../config/index.js';
import type { Principal } from './auth.js';

// 限流存储抽象：Redis 可用时共享计数（多实例一致），不可用时 fallback 进程内内存。
// Redis 故障（连接失败/超时）自动降级内存，限流中间件永不因 Redis 阻塞请求。

interface LimitResult {
  count: number;
  /** 窗口重置时间（ms epoch）。 */
  resetAt: number;
}

interface LimitStore {
  /** 对 key 计数 +1，返回当前窗口内累计计数与窗口重置时间。 */
  incr(key: string, windowMs: number): Promise<LimitResult>;
}

// ---------------------------------------------------------------------------
// 内存实现（fallback，单实例行为）
// ---------------------------------------------------------------------------

const hits = new Map<string, { count: number; resetAt: number }>();

const CLEANUP_INTERVAL_MS = 60_000;
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of hits) {
    if (now > entry.resetAt) hits.delete(key);
  }
}, CLEANUP_INTERVAL_MS);
cleanupTimer.unref();

const memoryStore: LimitStore = {
  async incr(key, windowMs) {
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count++;
    return { count: entry.count, resetAt: entry.resetAt };
  },
};

// ---------------------------------------------------------------------------
// Redis 实现（惰性连接，故障自动降级内存）
// ---------------------------------------------------------------------------

// type-only import 避免 ioredis 成为硬依赖编译期问题；运行时动态 require。
type IoRedisClient = {
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<number>;
  ping(): Promise<string>;
  disconnect(): void;
  on(event: string, listener: (...args: unknown[]) => void): unknown;
};

let redisClient: IoRedisClient | null = null;
let redisInitPromise: Promise<IoRedisClient | null> | null = null;
let redisDegraded = false; // 一旦确认不可用，本轮进程不再重试（避免每个请求都尝试连接）

async function getRedisClient(): Promise<IoRedisClient | null> {
  if (!config.redis?.enabled) return null;
  if (redisDegraded) return null;
  if (redisClient) return redisClient;
  if (redisInitPromise) return redisInitPromise;

  redisInitPromise = (async () => {
    try {
      // 动态导入：ioredis 未安装时不影响编译（type-only），运行时缺失则降级。
      const mod = (await import('ioredis')) as { default: new (url: string, opts?: { lazyConnect?: boolean; maxRetriesPerRequest?: number; enableReadyCheck?: boolean; connectTimeout?: number }) => IoRedisClient };
      const client = new mod.default(config.redis.url, {
        lazyConnect: false,
        maxRetriesPerRequest: 1,
        enableReadyCheck: true,
        connectTimeout: 2_000,
      });
      client.on('error', () => {
        // 连接错误静默处理：下次 incr 调用会捕获并降级。
      });
      await client.ping();
      redisClient = client;
      return client;
    } catch {
      redisDegraded = true;
      redisClient = null;
      return null;
    }
  })();

  return redisInitPromise;
}

const REDIS_KEY_PREFIX = 'hmr:ratelimit:';

const redisStore: LimitStore = {
  async incr(key, windowMs) {
    const client = await getRedisClient();
    if (!client) {
      // Redis 未启用或已降级 → 走内存。
      return memoryStore.incr(key, windowMs);
    }
    try {
      const fullKey = `${REDIS_KEY_PREFIX}${key}`;
      const count = await client.incr(fullKey);
      // 首次进入窗口时设置 TTL，后续递增不刷新（固定窗口语义，与内存实现一致）。
      if (count === 1) {
        const ttlSec = Math.max(1, Math.ceil(windowMs / 1000));
        await client.expire(fullKey, ttlSec);
      }
      // resetAt 用 TTL 估算：当前时间 + 剩余窗口。
      const resetAt = Date.now() + windowMs;
      return { count, resetAt };
    } catch {
      // Redis 命令失败：降级内存，保证限流不中断。
      redisDegraded = true;
      return memoryStore.incr(key, windowMs);
    }
  },
};

function resolveStore(): LimitStore {
  return config.redis?.enabled ? redisStore : memoryStore;
}

// ---------------------------------------------------------------------------
// 中间件
// ---------------------------------------------------------------------------

export async function rateLimitMiddleware(c: Context, next: Next) {
  const user = c.get('user') as Principal | undefined;
  // 已认证用户用 username；未认证优先 socket remoteAddr（直连 IP，不可伪造），
  // x-forwarded-for / x-real-ip 可被客户端伪造，仅作反向代理后的兜底。
  const remoteAddr = (c.env as { remoteAddr?: { address?: string } })?.remoteAddr?.address;
  const identity =
    user?.username ||
    remoteAddr ||
    c.req.header('x-forwarded-for') ||
    c.req.header('x-real-ip') ||
    'unknown';

  const store = resolveStore();
  const { count, resetAt } = await store.incr(identity, config.rateLimit.windowMs);

  c.header('X-RateLimit-Limit', String(config.rateLimit.max));
  c.header('X-RateLimit-Remaining', String(Math.max(0, config.rateLimit.max - count)));
  c.header('X-RateLimit-Reset', String(Math.ceil(resetAt / 1000)));

  if (count > config.rateLimit.max) {
    return c.json({ error: 'Too many requests' }, 429);
  }

  await next();
}
