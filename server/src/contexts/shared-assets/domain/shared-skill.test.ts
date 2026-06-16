import { describe, it, expect } from 'vitest';
import {
  normalizeAssetType,
  createSkillReport,
  createSharedSkillFromReport,
  createSkillBinding,
  createAssetBinding,
} from './shared-skill.js';

describe('normalizeAssetType', () => {
  it('returns known types as-is', () => {
    expect(normalizeAssetType('skill')).toBe('skill');
    expect(normalizeAssetType('tool')).toBe('tool');
    expect(normalizeAssetType('knowledge')).toBe('knowledge');
  });
  it('is case insensitive', () => {
    expect(normalizeAssetType('SKILL')).toBe('skill');
    expect(normalizeAssetType('Tool')).toBe('tool');
  });
  it('defaults to skill for unknown', () => {
    expect(normalizeAssetType('unknown')).toBe('skill');
    expect(normalizeAssetType('')).toBe('skill');
  });
});

describe('createSkillReport', () => {
  it('creates a report in pending_review status', () => {
    const report = createSkillReport({
      sourceTenantId: 'tn_1',
      sourceInstanceId: 'inst_1',
      name: 'Python 编程',
    });
    expect(report.status).toBe('pending_review');
    expect(report.name).toBe('Python 编程');
    expect(report.assetType).toBe('skill');
    expect(report.id).toMatch(/^skill_report_/);
    expect(report.approvals).toEqual([]);
    expect(report.reviewHistory).toEqual([]);
    expect(report.requiredApprovals).toBe(1);
  });

  it('normalizes tags', () => {
    const report = createSkillReport({
      sourceTenantId: 'tn_1',
      sourceInstanceId: 'inst_1',
      name: 'Test',
      tags: [' python ', '', ' ml '],
    });
    expect(report.tags).toEqual(['python', 'ml']);
  });

  it('accepts custom assetType', () => {
    const report = createSkillReport({
      sourceTenantId: 'tn_1',
      sourceInstanceId: 'inst_1',
      name: 'Test',
      assetType: 'tool',
    });
    expect(report.assetType).toBe('tool');
  });

  it('clamps requiredApprovals to at least 1', () => {
    const report = createSkillReport({
      sourceTenantId: 'tn_1',
      sourceInstanceId: 'inst_1',
      name: 'Test',
      requiredApprovals: 0,
    });
    expect(report.requiredApprovals).toBe(1);
  });
});

describe('createSharedSkillFromReport', () => {
  it('creates an active shared asset from a report', () => {
    const report = createSkillReport({
      sourceTenantId: 'tn_1',
      sourceInstanceId: 'inst_1',
      name: 'Python 编程',
    });
    const asset = createSharedSkillFromReport(report, 'reviewer1');
    expect(asset.status).toBe('active');
    expect(asset.sourceReportId).toBe(report.id);
    expect(asset.publishedBy).toBe('reviewer1');
    expect(asset.name).toBe('Python 编程');
    expect(asset.id).toMatch(/^shared_skill_/);
  });
});

describe('createSkillBinding', () => {
  it('creates a binding with skill type', () => {
    const binding = createSkillBinding('tn_1', 'skill_1', 'admin');
    expect(binding.tenantId).toBe('tn_1');
    expect(binding.skillId).toBe('skill_1');
    expect(binding.assetType).toBe('skill');
    expect(binding.status).toBe('active');
    expect(binding.createdBy).toBe('admin');
  });
});

describe('createAssetBinding', () => {
  it('creates a binding with normalized asset type', () => {
    const binding = createAssetBinding('tn_1', 'asset_1', 'TOOL', 'admin');
    expect(binding.assetType).toBe('tool');
    expect(binding.assetId).toBe('asset_1');
  });
});
