/**
 * PgAdvisoryLockProvider —— 基于 PostgreSQL advisory lock 的 LockProvider 实现
 *
 * 用 hashtext(taskId) 作为锁 key（int4 会话级 advisory lock）。
 * 不引入 Redis（项目无 Redis，过度设计）。
 */

import type { LockProvider } from './domain/lock.js';

/** postgres-js 客户端的最小约束（参数化查询） */
interface UnsafeSqlClient {
  unsafe(sql: string, params?: unknown[]): Promise<Record<string, unknown>[]>;
}

export class PgAdvisoryLockProvider implements LockProvider {
  constructor(private pool: UnsafeSqlClient) {}

  async tryLock(key: string): Promise<boolean> {
    const rows = await this.pool.unsafe('SELECT pg_try_advisory_lock(hashtext($1)) AS ok', [key]);
    return Boolean((rows[0] as { ok?: boolean } | undefined)?.ok);
  }

  async unlock(key: string): Promise<void> {
    await this.pool.unsafe('SELECT pg_advisory_unlock(hashtext($1)) AS ok', [key]);
  }
}
