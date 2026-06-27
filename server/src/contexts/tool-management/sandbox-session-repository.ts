/**
 * SandboxSession 仓储 — 持久化 callerId → sandboxId 映射(sandbox_sessions 表)。
 *
 * 解决"sandbox 不持久"硬伤(T54):OpenSandboxExecutor 的 sandbox 缓存是进程内,
 * server 重启后丢失 sandboxId → 找不到已创建的应用文件。本仓储把映射落 DB,
 * server 启动后可经 sandboxId 重连已存在的 sandbox(而非新建空 sandbox)。
 *
 * 用 raw SQL(经 db client),不引入 drizzle schema 类型(表结构简单 + migration 已建)。
 */
import { db } from '../../db/client.js';
import { sql } from 'drizzle-orm';

export interface SandboxSessionRow {
  callerId: string;
  sandboxId: string;
  tenantId: string | null;
  status: string;
}

/** 按 callerId 查持久化的 sandboxId(active 状态)。无记录返回 null。 */
export async function findSandboxSession(
  callerId: string
): Promise<SandboxSessionRow | null> {
  const rows = (await db.execute(sql`
    SELECT caller_id, sandbox_id, tenant_id, status
    FROM sandbox_sessions
    WHERE caller_id = ${callerId} AND status = 'active'
    LIMIT 1
  `)) as unknown as Array<{ caller_id: string; sandbox_id: string; tenant_id: string | null; status: string }>;
  const r = rows?.[0];
  if (!r) return null;
  return { callerId: r.caller_id, sandboxId: r.sandbox_id, tenantId: r.tenant_id, status: r.status };
}

/** upsert callerId → sandboxId 映射(新建或更新 sandboxId,如 callerId 换了新 sandbox)。 */
export async function upsertSandboxSession(
  callerId: string,
  sandboxId: string,
  tenantId?: string
): Promise<void> {
  await db.execute(sql`
    INSERT INTO sandbox_sessions (caller_id, sandbox_id, tenant_id, status, last_used_at)
    VALUES (${callerId}, ${sandboxId}, ${tenantId ?? null}, 'active', now())
    ON CONFLICT (caller_id) DO UPDATE
      SET sandbox_id = EXCLUDED.sandbox_id,
          tenant_id = COALESCE(EXCLUDED.tenant_id, sandbox_sessions.tenant_id),
          status = 'active',
          last_used_at = now()
  `);
}

/** 标记 sandbox 失效(status=evicted,保留记录用于审计;不删,防 sandboxId 复用混乱)。 */
export async function markSandboxEvicted(callerId: string): Promise<void> {
  await db.execute(sql`
    UPDATE sandbox_sessions SET status = 'evicted', last_used_at = now()
    WHERE caller_id = ${callerId}
  `);
}

/** 更新 last_used_at(keepalive,用于判断是否需 renew TTL)。 */
export async function touchSandboxSession(callerId: string): Promise<void> {
  await db.execute(sql`
    UPDATE sandbox_sessions SET last_used_at = now()
    WHERE caller_id = ${callerId} AND status = 'active'
  `);
}
