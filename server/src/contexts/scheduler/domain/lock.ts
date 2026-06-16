/**
 * LockProvider —— 分布式锁抽象（纯接口，零依赖）
 *
 * 实现方（PgAdvisoryLockProvider）用 PostgreSQL advisory lock。
 * SchedulerService 依赖此接口，保证多副本下同一任务同一时刻只执行一次，
 * 同时便于单元测试 mock。
 */
export interface LockProvider {
  /** 尝试获取锁，成功返回 true（已被他人持有返回 false） */
  tryLock(key: string): Promise<boolean>;
  /** 释放锁 */
  unlock(key: string): Promise<void>;
}
