import { eq, inArray } from 'drizzle-orm';
import type { Database } from '../client.js';
import { skillReports, sharedAssets, assetBindings } from '../schema/skill.js';
import type { ISkillRepository } from '../../contexts/shared-assets/skill-service.js';
import type {
  SkillReport,
  SharedAsset,
  AssetBinding,
  ReviewEntry,
} from '../../contexts/shared-assets/domain/shared-skill.js';

export class SkillRepository implements ISkillRepository {
  constructor(private db: Database) {}

  async addAssetReport(report: SkillReport): Promise<void> {
    await this.db.insert(skillReports).values(toReportRow(report));
  }

  async getAssetReport(reportId: string): Promise<SkillReport | null> {
    const [row] = await this.db
      .select()
      .from(skillReports)
      .where(eq(skillReports.id, reportId))
      .limit(1);
    return row ? toReportDomain(row) : null;
  }

  async updateAssetReport(report: SkillReport): Promise<void> {
    const values = toReportRow(report);
    await this.db.update(skillReports).set(values).where(eq(skillReports.id, report.id));
  }

  async listAssetReports(): Promise<SkillReport[]> {
    const rows = await this.db.select().from(skillReports);
    return rows.map(toReportDomain);
  }

  async listSharedAssets(assetType?: string): Promise<SharedAsset[]> {
    if (assetType) {
      const rows = await this.db
        .select()
        .from(sharedAssets)
        .where(eq(sharedAssets.assetType, assetType));
      return rows.map(toSharedDomain);
    }
    const rows = await this.db.select().from(sharedAssets);
    return rows.map(toSharedDomain);
  }

  async getSharedAsset(assetId: string): Promise<SharedAsset | null> {
    const [row] = await this.db
      .select()
      .from(sharedAssets)
      .where(eq(sharedAssets.id, assetId))
      .limit(1);
    return row ? toSharedDomain(row) : null;
  }

  async addSharedAsset(asset: SharedAsset): Promise<void> {
    await this.db.insert(sharedAssets).values({
      id: asset.id,
      assetType: asset.assetType,
      sourceReportId: asset.sourceReportId,
      sourceTenantId: asset.sourceTenantId,
      sourceInstanceId: asset.sourceInstanceId,
      name: asset.name,
      description: asset.description,
      contentRef: asset.contentRef,
      content: asset.content,
      tags: asset.tags,
      version: asset.version,
      status: asset.status,
      publishedBy: asset.publishedBy,
      publishedAt: new Date(asset.publishedAt),
      createdAt: new Date(asset.createdAt),
      updatedAt: new Date(asset.updatedAt),
    });
  }

  async updateSharedAsset(asset: SharedAsset): Promise<void> {
    await this.db
      .update(sharedAssets)
      .set({
        name: asset.name,
        description: asset.description,
        contentRef: asset.contentRef,
        content: asset.content,
        tags: asset.tags,
        version: asset.version,
        status: asset.status,
        updatedAt: new Date(asset.updatedAt),
      })
      .where(eq(sharedAssets.id, asset.id));
  }

  /** v1.4:批量按 id 查 content(组装层 boundSkills→skillsContext 用)。content 为 null 的不进 Map。 */
  async getContentsByIds(ids: string[]): Promise<Map<string, string>> {
    if (ids.length === 0) return new Map();
    const rows = await this.db
      .select({ id: sharedAssets.id, content: sharedAssets.content, name: sharedAssets.name })
      .from(sharedAssets)
      .where(inArray(sharedAssets.id, ids));
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.content) map.set(r.id, r.content);
    }
    return map;
  }

  /** v1.4:批量按 id 查 SharedAsset 元数据(组装层 skillsContext 拼名字+描述用)。 */
  async getSharedAssetsByIds(ids: string[]): Promise<SharedAsset[]> {
    if (ids.length === 0) return [];
    const rows = await this.db.select().from(sharedAssets).where(inArray(sharedAssets.id, ids));
    return rows.map(toSharedDomain);
  }

  async deleteSharedAsset(assetId: string): Promise<boolean> {
    const result = await this.db.delete(sharedAssets).where(eq(sharedAssets.id, assetId));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async findAssetBinding(tenantId: string, assetId: string): Promise<AssetBinding | null> {
    const { and } = await import('drizzle-orm');
    const [row] = await this.db
      .select()
      .from(assetBindings)
      .where(and(eq(assetBindings.tenantId, tenantId), eq(assetBindings.assetId, assetId)))
      .limit(1);
    if (row) return toBindingDomain(row);

    const [row2] = await this.db
      .select()
      .from(assetBindings)
      .where(and(eq(assetBindings.tenantId, tenantId), eq(assetBindings.skillId, assetId)))
      .limit(1);
    return row2 ? toBindingDomain(row2) : null;
  }

  async addAssetBinding(binding: AssetBinding): Promise<void> {
    await this.db.insert(assetBindings).values({
      id: binding.id,
      tenantId: binding.tenantId,
      skillId: binding.skillId ?? null,
      assetId: binding.assetId ?? null,
      assetType: binding.assetType,
      status: binding.status,
      createdBy: binding.createdBy,
      createdAt: new Date(binding.createdAt),
      updatedAt: new Date(binding.updatedAt),
    });
  }

  async removeAssetBinding(bindingId: string): Promise<boolean> {
    const result = await this.db.delete(assetBindings).where(eq(assetBindings.id, bindingId));
    return (result as unknown as { rowCount: number }).rowCount > 0;
  }

  async findBindingsByAsset(assetId: string): Promise<AssetBinding[]> {
    const { or } = await import('drizzle-orm');
    const rows = await this.db
      .select()
      .from(assetBindings)
      .where(or(eq(assetBindings.assetId, assetId), eq(assetBindings.skillId, assetId)));
    return rows.map(toBindingDomain);
  }

  async listAssetBindings(assetType?: string): Promise<AssetBinding[]> {
    if (assetType) {
      const rows = await this.db
        .select()
        .from(assetBindings)
        .where(eq(assetBindings.assetType, assetType));
      return rows.map(toBindingDomain);
    }
    const rows = await this.db.select().from(assetBindings);
    return rows.map(toBindingDomain);
  }

  /** T13 studio:按 tenantId 列已安装资产绑定 */
  async listBindingsByTenant(tenantId: string): Promise<AssetBinding[]> {
    const rows = await this.db
      .select()
      .from(assetBindings)
      .where(eq(assetBindings.tenantId, tenantId));
    return rows.map(toBindingDomain);
  }
}

function toReportRow(r: SkillReport) {
  return {
    id: r.id,
    assetType: r.assetType,
    sourceTenantId: r.sourceTenantId,
    sourceInstanceId: r.sourceInstanceId,
    sourceSkillId: r.sourceSkillId,
    name: r.name,
    description: r.description,
    contentRef: r.contentRef,
    tags: r.tags,
    version: r.version,
    status: r.status,
    requiredApprovals: r.requiredApprovals,
    approvals: r.approvals,
    reviewHistory: r.reviewHistory as unknown[],
    reviewedBy: r.reviewedBy,
    reviewedAt: r.reviewedAt ? new Date(r.reviewedAt) : null,
    rejectReason: r.rejectReason ?? null,
    slaDueAt: r.slaDueAt ? new Date(r.slaDueAt) : null,
    reviewEscalationLevel: r.reviewEscalationLevel ?? 0,
    lastEscalatedAt: r.lastEscalatedAt ? new Date(r.lastEscalatedAt) : null,
    escalationHistory: (r.escalationHistory ?? []) as unknown[],
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
  };
}

function toReportDomain(row: typeof skillReports.$inferSelect): SkillReport {
  return {
    id: row.id,
    assetType: row.assetType as SkillReport['assetType'],
    sourceTenantId: row.sourceTenantId,
    sourceInstanceId: row.sourceInstanceId,
    sourceSkillId: row.sourceSkillId ?? null,
    name: row.name,
    description: row.description ?? '',
    contentRef: row.contentRef ?? null,
    tags: (row.tags ?? []) as string[],
    version: row.version,
    status: row.status,
    requiredApprovals: row.requiredApprovals,
    approvals: (row.approvals ?? []) as string[],
    reviewHistory: (row.reviewHistory ?? []) as ReviewEntry[],
    reviewedBy: row.reviewedBy ?? null,
    reviewedAt: row.reviewedAt?.toISOString() ?? null,
    rejectReason: row.rejectReason ?? null,
    slaDueAt: row.slaDueAt?.toISOString() ?? null,
    reviewEscalationLevel: row.reviewEscalationLevel,
    lastEscalatedAt: row.lastEscalatedAt?.toISOString() ?? null,
    escalationHistory: (row.escalationHistory ?? []) as SkillReport['escalationHistory'],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toSharedDomain(row: typeof sharedAssets.$inferSelect): SharedAsset {
  return {
    id: row.id,
    assetType: row.assetType as SharedAsset['assetType'],
    sourceReportId: row.sourceReportId,
    sourceTenantId: row.sourceTenantId,
    sourceInstanceId: row.sourceInstanceId,
    name: row.name,
    description: row.description ?? '',
    contentRef: row.contentRef ?? null,
    content: row.content ?? null,
    tags: (row.tags ?? []) as string[],
    version: row.version,
    status: row.status,
    publishedBy: row.publishedBy,
    publishedAt: row.publishedAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toBindingDomain(row: typeof assetBindings.$inferSelect): AssetBinding {
  return {
    id: row.id,
    tenantId: row.tenantId,
    skillId: row.skillId ?? undefined,
    assetId: row.assetId ?? undefined,
    assetType: row.assetType as AssetBinding['assetType'],
    status: row.status,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
