import { eq, and, desc } from 'drizzle-orm';
import type { Database } from '../client.js';
import { agentRuntimeManifests } from '../schema/runtime-manifest.js';
import type { RuntimeManifest, ManifestStatus } from '../../contexts/agent-core/domain/runtime-manifest.js';
import { canTransition } from '../../contexts/agent-core/domain/runtime-manifest.js';

/**
 * agent_runtime_manifests 表的 DB 实现(v2.0 Layer 2)。
 *
 * 不可变性约束(设计文档 §3.2):
 * - saveBaked 只在 pending→baked 时写一次 manifest(jsonb)+ bakedAt + status,此后不可改 manifest 字段
 * - updateStatus 只允许 status 状态流转(baked→expired / failed→pending),拒绝碰 manifest 字段
 * - manifest 字段对 baked 行只读,由 domain 层 sealManifest(Object.freeze) + DB 层双保险保证
 *
 * 唯一约束 (agentDefinitionId + generation) 在 DB 层兜底防并发重复 bake;upsertPending 用 ON CONFLICT
 * 语义(存在 pending/failed 则复用占位,baked 已存在则抛唯一约束错由调用方处理)。
 */
export class RuntimeManifestRepository {
  constructor(private db: Database) {}

  /** 查 manifest(defId + generation)。返回 RuntimeManifest 反序列化对象,非 baked 返 null(harness 只认 baked)。 */
  async findManifest(agentDefinitionId: string, generation: number): Promise<RuntimeManifest | null> {
    const rows = await this.db
      .select()
      .from(agentRuntimeManifests)
      .where(
        and(
          eq(agentRuntimeManifests.agentDefinitionId, agentDefinitionId),
          eq(agentRuntimeManifests.generation, generation)
        )
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return this.mapRow(row);
  }

  /** 查 baked manifest(运行时 harness 读,只认 status=baked)。 */
  async findBakedManifest(agentDefinitionId: string, generation: number): Promise<RuntimeManifest | null> {
    const rows = await this.db
      .select()
      .from(agentRuntimeManifests)
      .where(
        and(
          eq(agentRuntimeManifests.agentDefinitionId, agentDefinitionId),
          eq(agentRuntimeManifests.generation, generation),
          eq(agentRuntimeManifests.status, 'baked')
        )
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return this.mapRow(row);
  }

  /**
   * 查某定义全部 manifest(generation 倒序,版本对比/回滚)。
   * limit 下推 DB 层(§7.2.1 第2条:禁止全量读后内存切片)。默认 50。
   */
  async listByDefinition(agentDefinitionId: string, limit: number = 50): Promise<RuntimeManifest[]> {
    const rows = await this.db
      .select()
      .from(agentRuntimeManifests)
      .where(eq(agentRuntimeManifests.agentDefinitionId, agentDefinitionId))
      .orderBy(desc(agentRuntimeManifests.generation))
      .limit(limit);
    return rows.map((r) => this.mapRow(r)).filter((m): m is RuntimeManifest => m !== null);
  }

  /** 落 pending 占位(bake 开始时,防并发重复 bake)。已存在 baked 则抛错,pending/failed 复用占位。 */
  async upsertPending(
    id: string,
    agentDefinitionId: string,
    generation: number
  ): Promise<void> {
    // 查原始 row(含 status,不经 mapRow 过滤——mapRow 只认 baked,会漏检 pending/failed)
    const existing = await this.findRaw(agentDefinitionId, generation);
    if (existing?.status === 'baked') {
      throw new Error(`manifest already baked: ${agentDefinitionId} gen ${generation}`);
    }
    // pending/failed 占位可复用(失败重试场景)
    if (existing) {
      // failed → pending 重置(状态流转校验);pending 已是 pending 无需改
      if (existing.status !== 'pending' && canTransition(existing.status, 'pending')) {
        await this.db
          .update(agentRuntimeManifests)
          .set({ status: 'pending', errorMsg: null, updatedAt: new Date() })
          .where(eq(agentRuntimeManifests.id, id));
      }
      return;
    }
    // 新建 pending 占位
    await this.db.insert(agentRuntimeManifests).values({
      id,
      agentDefinitionId,
      generation,
      manifest: {},
      status: 'pending',
      bakedAt: null,
      errorMsg: null,
    });
  }

  /** 保存 baked manifest(pending→baked,写 manifest jsonb + bakedAt + status)。只写一次。 */
  async saveBaked(id: string, manifest: RuntimeManifest): Promise<void> {
    await this.db
      .update(agentRuntimeManifests)
      .set({
        manifest: manifest as unknown as Record<string, unknown>,
        status: 'baked',
        bakedAt: new Date(manifest.bakedAt),
        errorMsg: null,
        updatedAt: new Date(),
      })
      .where(eq(agentRuntimeManifests.id, id));
  }

  /** 标记 failed(pending→failed,只写 status + errorMsg,不碰 manifest)。 */
  async saveFailed(id: string, errorMsg: string): Promise<void> {
    await this.db
      .update(agentRuntimeManifests)
      .set({ status: 'failed', errorMsg, updatedAt: new Date() })
      .where(eq(agentRuntimeManifests.id, id));
  }

  /** status 状态流转(baked→expired 终态,只改 status 不碰 manifest)。非法流转抛错。 */
  async updateStatus(id: string, to: ManifestStatus): Promise<void> {
    // 查当前 status 校验流转合法性
    const rows = await this.db
      .select({ status: agentRuntimeManifests.status })
      .from(agentRuntimeManifests)
      .where(eq(agentRuntimeManifests.id, id))
      .limit(1);
    const current = rows[0]?.status as ManifestStatus | undefined;
    if (!current) throw new Error(`manifest not found: ${id}`);
    if (!canTransition(current, to)) {
      throw new Error(`illegal status transition: ${current} → ${to}`);
    }
    await this.db
      .update(agentRuntimeManifests)
      .set({ status: to, updatedAt: new Date() })
      .where(eq(agentRuntimeManifests.id, id));
  }

  /** 查原始 DB row(含 status,供 upsertPending 检测 pending/failed 占位,不经 mapRow 过滤)。 */
  private async findRaw(
    agentDefinitionId: string,
    generation: number
  ): Promise<{ status: ManifestStatus } | null> {
    const rows = await this.db
      .select({ status: agentRuntimeManifests.status })
      .from(agentRuntimeManifests)
      .where(
        and(
          eq(agentRuntimeManifests.agentDefinitionId, agentDefinitionId),
          eq(agentRuntimeManifests.generation, generation)
        )
      )
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return { status: row.status as ManifestStatus };
  }

  /** DB row → domain RuntimeManifest(反序列化 manifest jsonb)。 */
  private mapRow(row: typeof agentRuntimeManifests.$inferSelect): RuntimeManifest | null {
    if (row.status !== 'baked') return null;
    const manifest = row.manifest as RuntimeManifest;
    // 补充 DB 层元信息(若 manifest 内未存)
    return {
      ...manifest,
      id: row.id,
      agentDefinitionId: row.agentDefinitionId,
      generation: row.generation,
      status: row.status,
    };
  }
}
