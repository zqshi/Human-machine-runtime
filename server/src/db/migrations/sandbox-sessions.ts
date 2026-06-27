import { sql } from 'drizzle-orm';
import type { MigrateDb } from './types.js';

/**
 * sandbox 会话持久化表(T54:解决"sandbox 不持久"硬伤)。
 *
 * OpenSandbox sandbox 在服务端按 TTL 存活(默认 1h),但 HMR server 的 sandbox 缓存是进程内,
 * server 重启后丢失 sandboxId → 找不到已创建的应用文件。本表持久化 callerId → sandboxId 映射,
 * server 启动时从 DB 恢复,getOrCreateSandbox 优先重连已存在的 sandbox(而非新建空 sandbox)。
 *
 * 生命周期:sandbox 由 OpenSandbox 服务端 TTL 管理(超时自动销毁);本表记录仅作重连索引,
 * last_used_at + 状态字段辅助判断是否需 renew(延长 TTL)或重建(sandbox 已失效)。
 */
export async function migrateSandboxSessions(db: MigrateDb): Promise<void> {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS sandbox_sessions (
      id SERIAL PRIMARY KEY,
      caller_id VARCHAR(128) NOT NULL UNIQUE,
      sandbox_id VARCHAR(128) NOT NULL,
      tenant_id VARCHAR(64),
      status VARCHAR(32) NOT NULL DEFAULT 'active',
      last_used_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  // 按 caller_id 查(主查询路径)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_caller_id ON sandbox_sessions(caller_id)
  `);
  // 按 tenant_id 查(租户隔离/清理)
  await db.execute(sql`
    CREATE INDEX IF NOT EXISTS idx_sandbox_sessions_tenant_id ON sandbox_sessions(tenant_id)
  `);
}
