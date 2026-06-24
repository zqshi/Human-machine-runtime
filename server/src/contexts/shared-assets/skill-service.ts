import {
  createSkillReport,
  createSharedSkillFromReport,
  createSkillBinding,
  createAssetBinding,
  normalizeAssetType,
  type SkillReport,
  type SharedAsset,
  type AssetBinding,
} from './domain/shared-skill.js';
import { nowIso, AppError } from '../../shared/utils.js';

export interface ISkillRepository {
  addAssetReport(report: SkillReport): Promise<void>;
  getAssetReport(reportId: string): Promise<SkillReport | null>;
  updateAssetReport(report: SkillReport): Promise<void>;
  listAssetReports(): Promise<SkillReport[]>;
  listSharedAssets(assetType?: string): Promise<SharedAsset[]>;
  getSharedAsset(assetId: string): Promise<SharedAsset | null>;
  /** v1.4:批量按 id 查 content(组装层 skillsContext 用) */
  getContentsByIds(ids: string[]): Promise<Map<string, string>>;
  /** v1.4:批量按 id 查 SharedAsset 元数据(组装层拼 skillsContext 名字+描述用) */
  getSharedAssetsByIds(ids: string[]): Promise<SharedAsset[]>;
  addSharedAsset(asset: SharedAsset): Promise<void>;
  updateSharedAsset(asset: SharedAsset): Promise<void>;
  deleteSharedAsset(assetId: string): Promise<boolean>;
  findAssetBinding(tenantId: string, assetId: string): Promise<AssetBinding | null>;
  addAssetBinding(binding: AssetBinding): Promise<void>;
  removeAssetBinding(bindingId: string): Promise<boolean>;
  listAssetBindings(assetType?: string): Promise<AssetBinding[]>;
  findBindingsByAsset(assetId: string): Promise<AssetBinding[]>;
}

interface IAudit {
  log(type: string, payload: Record<string, unknown>): Promise<unknown>;
}

export class SkillService {
  private repo: ISkillRepository;
  private audit: IAudit;

  constructor(repo: ISkillRepository, audit: IAudit) {
    this.repo = repo;
    this.audit = audit;
  }

  private nowMs(): number {
    return Date.now();
  }

  async reportAsset(input: {
    assetType?: string;
    sourceTenantId: string;
    sourceInstanceId: string;
    sourceSkillId?: string;
    sourceAssetId?: string;
    name: string;
    description?: string;
    contentRef?: string;
    tags?: string[];
    version?: string;
    requiredApprovals?: number;
    slaHours?: number;
  }): Promise<SkillReport> {
    if (!String(input.sourceTenantId || '').trim())
      throw new AppError('sourceTenantId is required', 400, 'SKILL_SOURCE_TENANT_REQUIRED');
    if (!String(input.sourceInstanceId || '').trim())
      throw new AppError('sourceInstanceId is required', 400, 'SKILL_SOURCE_INSTANCE_REQUIRED');
    if (!String(input.name || '').trim())
      throw new AppError('name is required', 400, 'SKILL_NAME_REQUIRED');

    const report = createSkillReport(input);
    report.slaDueAt = new Date(
      this.nowMs() + Math.max(1, Number(input.slaHours || 24)) * 3600000
    ).toISOString();
    report.reviewEscalationLevel = 0;
    report.lastEscalatedAt = null;
    report.escalationHistory = [];
    await this.repo.addAssetReport(report);
    await this.audit.log('skill.reported', {
      reportId: report.id,
      assetType: report.assetType,
      sourceTenantId: report.sourceTenantId,
      name: report.name,
    });
    return report;
  }

  async report(input: Parameters<SkillService['reportAsset']>[0]): Promise<SkillReport> {
    return this.reportAsset({ ...input, assetType: input.assetType || 'skill' });
  }

  async listReportsByType(assetType?: string): Promise<SkillReport[]> {
    const rows = await this.repo.listAssetReports();
    if (!assetType) return rows;
    const type = normalizeAssetType(assetType);
    return rows.filter((x) => (x.assetType || 'skill') === type);
  }

  async listReportsByStatus(status: string): Promise<SkillReport[]> {
    const rows = await this.repo.listAssetReports();
    return rows.filter((x) => x.status === status);
  }

  private buildApprovalStage(report: SkillReport) {
    const approvals = report.approvals || [];
    const required = Math.max(1, report.requiredApprovals || 1);
    return {
      approvedCount: approvals.length,
      requiredApprovals: required,
      remainingApprovals: Math.max(0, required - approvals.length),
    };
  }

  async reviewReport(
    reportId: string,
    reviewer = 'platform_admin',
    decision = 'approve',
    opinion = ''
  ) {
    const d = String(decision || '')
      .trim()
      .toLowerCase();
    if (!['approve', 'reject'].includes(d))
      throw new AppError(
        'decision must be approve or reject',
        400,
        'SKILL_REVIEW_DECISION_INVALID'
      );

    const report = await this.repo.getAssetReport(reportId);
    if (!report) throw new AppError('skill report not found', 404, 'SKILL_REPORT_NOT_FOUND');
    if (report.status === 'approved') {
      const shared =
        (await this.repo.listSharedAssets()).find((x) => x.sourceReportId === report.id) || null;
      return { report, sharedSkill: shared, stage: this.buildApprovalStage(report) };
    }
    if (report.status === 'rejected')
      throw new AppError('rejected report cannot be reviewed', 409, 'SKILL_REPORT_REJECTED');

    const history = report.reviewHistory || [];
    history.push({
      reviewer,
      decision: d,
      opinion:
        String(opinion || '')
          .trim()
          .slice(0, 2000) || null,
      at: nowIso(),
    });
    report.reviewHistory = history;
    report.updatedAt = nowIso();

    await this.audit.log('skill.review.submitted', { reportId, reviewer, decision: d });

    if (d === 'reject') {
      report.status = 'rejected';
      report.reviewedBy = reviewer;
      report.reviewedAt = nowIso();
      report.rejectReason =
        String(opinion || '')
          .trim()
          .slice(0, 500) || null;
      await this.repo.updateAssetReport(report);
      return { report, sharedSkill: null, stage: this.buildApprovalStage(report) };
    }

    const approvals = report.approvals || [];
    if (!approvals.includes(reviewer)) approvals.push(reviewer);
    report.approvals = approvals;
    const stage = this.buildApprovalStage(report);
    let sharedSkill: SharedAsset | null = null;

    if (stage.remainingApprovals === 0) {
      report.status = 'approved';
      report.reviewedBy = reviewer;
      report.reviewedAt = nowIso();
      sharedSkill =
        (await this.repo.listSharedAssets()).find((x) => x.sourceReportId === report.id) || null;
      if (!sharedSkill) {
        sharedSkill = createSharedSkillFromReport(report, reviewer);
        await this.repo.addSharedAsset(sharedSkill);
      }
      await this.audit.log('skill.report.approved', { reportId, sharedSkillId: sharedSkill.id });
    }

    await this.repo.updateAssetReport(report);
    return { report, sharedSkill, stage: this.buildApprovalStage(report) };
  }

  async listSharedAssets(assetType?: string): Promise<SharedAsset[]> {
    return this.repo.listSharedAssets(assetType ? normalizeAssetType(assetType) : undefined);
  }

  async bindSharedAsset(
    tenantId: string,
    assetId: string,
    assetType = 'skill',
    actor = 'platform_admin'
  ): Promise<AssetBinding> {
    if (!tenantId.trim()) throw new AppError('tenantId is required', 400, 'TENANT_ID_REQUIRED');
    const skill = await this.repo.getSharedAsset(assetId);
    if (!skill) throw new AppError('shared asset not found', 404, 'SHARED_ASSET_NOT_FOUND');
    const type = normalizeAssetType(assetType || skill.assetType);
    const existed = await this.repo.findAssetBinding(tenantId, assetId);
    if (existed) return existed;
    const binding =
      type === 'skill'
        ? createSkillBinding(tenantId, assetId, actor)
        : createAssetBinding(tenantId, assetId, type, actor);
    await this.repo.addAssetBinding(binding);
    await this.audit.log('skill.binding.created', {
      tenantId,
      assetId,
      assetType: type,
      bindingId: binding.id,
    });
    return binding;
  }

  async listAssetBindings(assetType?: string): Promise<AssetBinding[]> {
    return this.repo.listAssetBindings(assetType ? normalizeAssetType(assetType) : undefined);
  }

  async getSharedAsset(assetId: string): Promise<SharedAsset | null> {
    return this.repo.getSharedAsset(assetId);
  }

  async updateSharedAsset(
    assetId: string,
    patch: Partial<
      Pick<SharedAsset, 'name' | 'description' | 'tags' | 'version' | 'status' | 'contentRef'>
    >
  ): Promise<SharedAsset> {
    const asset = await this.repo.getSharedAsset(assetId);
    if (!asset) throw new AppError('shared asset not found', 404, 'SHARED_ASSET_NOT_FOUND');
    const updated: SharedAsset = {
      ...asset,
      ...patch,
      updatedAt: nowIso(),
    };
    await this.repo.updateSharedAsset(updated);
    await this.audit.log('skill.asset.updated', { assetId, patch });
    return updated;
  }

  async deleteSharedAsset(assetId: string): Promise<boolean> {
    const asset = await this.repo.getSharedAsset(assetId);
    if (!asset) throw new AppError('shared asset not found', 404, 'SHARED_ASSET_NOT_FOUND');
    const ok = await this.repo.deleteSharedAsset(assetId);
    if (ok) {
      await this.audit.log('skill.asset.deleted', { assetId, name: asset.name });
    }
    return ok;
  }

  async linkAssetToInstance(
    assetId: string,
    instanceId: string,
    tenantId: string,
    actor = 'platform_admin'
  ): Promise<AssetBinding> {
    const asset = await this.repo.getSharedAsset(assetId);
    if (!asset) throw new AppError('shared asset not found', 404, 'SHARED_ASSET_NOT_FOUND');
    const existed = await this.repo.findAssetBinding(tenantId, assetId);
    if (existed) return existed;
    const binding = createAssetBinding(tenantId, assetId, asset.assetType, actor);
    await this.repo.addAssetBinding(binding);
    await this.audit.log('skill.linked', { assetId, instanceId, bindingId: binding.id });
    return binding;
  }

  async unlinkAsset(assetId: string, tenantId: string): Promise<boolean> {
    const binding = await this.repo.findAssetBinding(tenantId, assetId);
    if (!binding) return false;
    const ok = await this.repo.removeAssetBinding(binding.id);
    if (ok) {
      await this.audit.log('skill.unlinked', { assetId, bindingId: binding.id });
    }
    return ok;
  }

  async findBindingsByAsset(assetId: string): Promise<AssetBinding[]> {
    return this.repo.findBindingsByAsset(assetId);
  }
}
