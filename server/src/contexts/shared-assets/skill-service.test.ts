import { describe, it, expect, vi } from 'vitest';
import { SkillService, type ISkillRepository } from './skill-service.js';
import { type SkillReport, type SharedAsset, type AssetBinding } from './domain/shared-skill.js';

function makeRepo(): ISkillRepository & {
  reports: SkillReport[];
  assets: SharedAsset[];
  bindings: AssetBinding[];
} {
  const reports: SkillReport[] = [];
  const assets: SharedAsset[] = [];
  const bindings: AssetBinding[] = [];
  return {
    reports,
    assets,
    bindings,
    addAssetReport: vi.fn(async (r: SkillReport) => {
      reports.push(r);
    }),
    getAssetReport: vi.fn(async (id: string) => reports.find((r) => r.id === id) || null),
    updateAssetReport: vi.fn(async (r: SkillReport) => {
      const idx = reports.findIndex((x) => x.id === r.id);
      if (idx >= 0) reports[idx] = r;
    }),
    listAssetReports: vi.fn(async () => [...reports]),
    listSharedAssets: vi.fn(async (type?: string) =>
      type ? assets.filter((a) => a.assetType === type) : [...assets]
    ),
    getSharedAsset: vi.fn(async (id: string) => assets.find((a) => a.id === id) || null),
    addSharedAsset: vi.fn(async (a: SharedAsset) => {
      assets.push(a);
    }),
    findAssetBinding: vi.fn(
      async (tid: string, aid: string) =>
        bindings.find((b) => b.tenantId === tid && (b.assetId === aid || b.skillId === aid)) || null
    ),
    addAssetBinding: vi.fn(async (b: AssetBinding) => {
      bindings.push(b);
    }),
    listAssetBindings: vi.fn(async (type?: string) =>
      type ? bindings.filter((b) => b.assetType === type) : [...bindings]
    ),
  };
}

function makeAudit() {
  return { log: vi.fn(async () => {}) };
}

describe('SkillService', () => {
  describe('reportAsset', () => {
    it('creates a skill report', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      const report = await svc.reportAsset({
        sourceTenantId: 'tn_1',
        sourceInstanceId: 'inst_1',
        name: '智能问答',
      });
      expect(report.id).toBeDefined();
      expect(report.name).toBe('智能问答');
      expect(report.status).toBe('pending_review');
      expect(repo.addAssetReport).toHaveBeenCalledTimes(1);
    });

    it('throws when sourceTenantId missing', async () => {
      const svc = new SkillService(makeRepo(), makeAudit());
      await expect(
        svc.reportAsset({ sourceTenantId: '', sourceInstanceId: 'x', name: 'x' })
      ).rejects.toThrow('sourceTenantId is required');
    });

    it('throws when name missing', async () => {
      const svc = new SkillService(makeRepo(), makeAudit());
      await expect(
        svc.reportAsset({ sourceTenantId: 't', sourceInstanceId: 'i', name: '' })
      ).rejects.toThrow('name is required');
    });
  });

  describe('listReportsByType', () => {
    it('returns all reports when no type', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      await svc.report({ sourceTenantId: 't', sourceInstanceId: 'i', name: 'a' });
      await svc.reportAsset({
        assetType: 'tool',
        sourceTenantId: 't',
        sourceInstanceId: 'i',
        name: 'b',
      });
      const all = await svc.listReportsByType();
      expect(all).toHaveLength(2);
    });

    it('filters by type', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      await svc.report({ sourceTenantId: 't', sourceInstanceId: 'i', name: 'skill1' });
      await svc.reportAsset({
        assetType: 'tool',
        sourceTenantId: 't',
        sourceInstanceId: 'i',
        name: 'tool1',
      });
      const skills = await svc.listReportsByType('skill');
      expect(skills).toHaveLength(1);
      expect(skills[0].name).toBe('skill1');
    });
  });

  describe('reviewReport', () => {
    it('approves a pending report', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      const report = await svc.report({
        sourceTenantId: 't',
        sourceInstanceId: 'i',
        name: '技能A',
      });
      const {
        report: reviewed,
        sharedSkill,
        stage,
      } = await svc.reviewReport(report.id, 'reviewer1', 'approve');
      expect(reviewed.status).toBe('approved');
      expect(sharedSkill).not.toBeNull();
      expect(sharedSkill!.name).toBe('技能A');
      expect(stage.remainingApprovals).toBe(0);
    });

    it('rejects a pending report', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      const report = await svc.report({
        sourceTenantId: 't',
        sourceInstanceId: 'i',
        name: '技能B',
      });
      const { report: reviewed, sharedSkill } = await svc.reviewReport(
        report.id,
        'reviewer1',
        'reject',
        '不符合标准'
      );
      expect(reviewed.status).toBe('rejected');
      expect(sharedSkill).toBeNull();
    });

    it('throws for invalid decision', async () => {
      const svc = new SkillService(makeRepo(), makeAudit());
      await expect(svc.reviewReport('id', 'r', 'maybe')).rejects.toThrow(
        'decision must be approve or reject'
      );
    });

    it('throws for unknown report', async () => {
      const svc = new SkillService(makeRepo(), makeAudit());
      await expect(svc.reviewReport('nope', 'r', 'approve')).rejects.toThrow(
        'skill report not found'
      );
    });

    it('returns existing shared skill for already-approved report', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      const report = await svc.report({ sourceTenantId: 't', sourceInstanceId: 'i', name: '已审' });
      await svc.reviewReport(report.id, 'r1', 'approve');
      const { report: again } = await svc.reviewReport(report.id, 'r2', 'approve');
      expect(again.status).toBe('approved');
    });
  });

  describe('bindSharedAsset', () => {
    it('binds an asset to a tenant', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      const report = await svc.report({ sourceTenantId: 't', sourceInstanceId: 'i', name: 'X' });
      const { sharedSkill } = await svc.reviewReport(report.id, 'r1', 'approve');
      const binding = await svc.bindSharedAsset('tn_2', sharedSkill!.id);
      expect(binding.tenantId).toBe('tn_2');
      expect(binding.skillId).toBe(sharedSkill!.id);
    });

    it('returns existing binding on duplicate', async () => {
      const repo = makeRepo();
      const svc = new SkillService(repo, makeAudit());
      const report = await svc.report({ sourceTenantId: 't', sourceInstanceId: 'i', name: 'Y' });
      const { sharedSkill } = await svc.reviewReport(report.id, 'r1', 'approve');
      await svc.bindSharedAsset('tn_2', sharedSkill!.id);
      const again = await svc.bindSharedAsset('tn_2', sharedSkill!.id);
      expect(repo.addAssetBinding).toHaveBeenCalledTimes(1);
      expect(again.tenantId).toBe('tn_2');
    });

    it('throws for empty tenantId', async () => {
      const svc = new SkillService(makeRepo(), makeAudit());
      await expect(svc.bindSharedAsset('', 'x')).rejects.toThrow('tenantId is required');
    });

    it('throws for unknown asset', async () => {
      const svc = new SkillService(makeRepo(), makeAudit());
      await expect(svc.bindSharedAsset('tn_1', 'nope')).rejects.toThrow('shared asset not found');
    });
  });
});
