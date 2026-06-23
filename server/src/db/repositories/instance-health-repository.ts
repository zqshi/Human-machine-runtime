import { eq, and, gte, desc } from 'drizzle-orm';
import type { Database } from '../client.js';
import { instanceHealthSnapshots } from '../schema/observability.js';

export interface InstanceHealthSnapshotRow {
  id: number;
  instanceId: string;
  tenantId: string;
  /** healthy | unhealthy | missing | rebuild_triggered | rebuild_failed */
  status: string;
  cpuUsage: number | null;
  memoryUsage: number | null;
  uptimeSeconds: number | null;
  lastActivityAt: Date | null;
  checkedAt: Date;
}

/**
 * instance_health_snapshots 仓库 —— 实例健康监控的持久化层
 *
 * status 取值:
 * - healthy / unhealthy:ContainerOrchestrator 探活结果
 * - missing:本端 Instance 存在但上游 FarmInstance 列表找不到
 * - rebuild_triggered:连续失败已触发 InstanceService.rebuild(同时用于 cooldown 去重)
 * - rebuild_failed:rebuild 抛错
 */
export class InstanceHealthRepository {
  constructor(private db: Database) {}

  async insertSnapshot(data: {
    instanceId: string;
    tenantId: string;
    status: string;
    cpuUsage?: number | null;
    memoryUsage?: number | null;
    uptimeSeconds?: number | null;
    lastActivityAt?: Date | null;
  }): Promise<void> {
    await this.db.insert(instanceHealthSnapshots).values({
      instanceId: data.instanceId,
      tenantId: data.tenantId,
      status: data.status,
      cpuUsage: data.cpuUsage ?? null,
      memoryUsage: data.memoryUsage ?? null,
      uptimeSeconds: data.uptimeSeconds ?? null,
      lastActivityAt: data.lastActivityAt ?? null,
    });
  }

  /** 最近 N 条快照(按 checkedAt 倒序),用于连续失败判定 */
  async listRecent(instanceId: string, limit: number): Promise<InstanceHealthSnapshotRow[]> {
    return this.db
      .select()
      .from(instanceHealthSnapshots)
      .where(eq(instanceHealthSnapshots.instanceId, instanceId))
      .orderBy(desc(instanceHealthSnapshots.checkedAt))
      .limit(limit);
  }

  /** 最近 windowMs 内是否存在指定 status 的快照(rebuild cooldown 去重用) */
  async hasRecentByStatus(
    instanceId: string,
    status: string,
    windowMs: number
  ): Promise<boolean> {
    const since = new Date(Date.now() - windowMs);
    const rows = await this.db
      .select({ id: instanceHealthSnapshots.id })
      .from(instanceHealthSnapshots)
      .where(
        and(
          eq(instanceHealthSnapshots.instanceId, instanceId),
          eq(instanceHealthSnapshots.status, status),
          gte(instanceHealthSnapshots.checkedAt, since)
        )
      )
      .limit(1);
    return rows.length > 0;
  }
}
