import { eq, sql } from 'drizzle-orm';
import type { Database } from '../../client.js';
import { instanceModelGrants } from '../../schema/ai-gateway.js';

/** 查询某模型已授权的 instanceId 列表 */
export async function listGrantsByModel(db: Database, modelId: number): Promise<string[]> {
  const rows = await db
    .select({ instanceId: instanceModelGrants.instanceId })
    .from(instanceModelGrants)
    .where(eq(instanceModelGrants.modelId, modelId));
  return rows.map((r) => r.instanceId);
}

/** 查询某 instance 已被授权的 modelId 列表 */
export async function listGrantsByInstance(db: Database, instanceId: string): Promise<number[]> {
  const rows = await db
    .select({ modelId: instanceModelGrants.modelId })
    .from(instanceModelGrants)
    .where(eq(instanceModelGrants.instanceId, instanceId));
  return rows.map((r) => r.modelId);
}

/** 全量覆盖某模型的授权集合（事务内 delete + insert） */
export async function setModelGrants(
  db: Database,
  modelId: number,
  instanceIds: string[],
  tenantId: string,
  grantedBy?: string
): Promise<string[]> {
  await db.transaction(async (tx) => {
    await tx.delete(instanceModelGrants).where(eq(instanceModelGrants.modelId, modelId));
    if (instanceIds.length > 0) {
      await tx
        .insert(instanceModelGrants)
        .values(
          instanceIds.map((iid) => ({
            instanceId: iid,
            modelId,
            tenantId,
            grantedBy: grantedBy ?? null,
          }))
        )
        .onConflictDoNothing({
          target: [instanceModelGrants.instanceId, instanceModelGrants.modelId],
        });
    }
  });
  return listGrantsByModel(db, modelId);
}

/** 批量统计每个模型的授权数（卡片徽标用） */
export async function countGrantsByModel(db: Database): Promise<{ modelId: number; count: number }[]> {
  const rows = await db
    .select({
      modelId: instanceModelGrants.modelId,
      count: sql<number>`count(*)::int`,
    })
    .from(instanceModelGrants)
    .groupBy(instanceModelGrants.modelId);
  return rows.map((r) => ({ modelId: r.modelId, count: Number(r.count) }));
}
