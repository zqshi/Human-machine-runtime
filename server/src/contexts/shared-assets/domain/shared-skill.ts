import { newId, nowIso } from '../../../shared/utils.js';

export const ASSET_TYPES = ['skill', 'tool', 'knowledge'] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export function normalizeAssetType(input: string): AssetType {
  const value = String(input || 'skill')
    .trim()
    .toLowerCase();
  if (!(ASSET_TYPES as readonly string[]).includes(value)) return 'skill';
  return value as AssetType;
}

export interface SkillReport {
  id: string;
  assetType: AssetType;
  sourceTenantId: string;
  sourceInstanceId: string;
  sourceSkillId: string | null;
  name: string;
  description: string;
  contentRef: string | null;
  tags: string[];
  version: string;
  status: string;
  requiredApprovals: number;
  approvals: string[];
  reviewHistory: ReviewEntry[];
  reviewedBy: string | null;
  reviewedAt: string | null;
  rejectReason?: string | null;
  slaDueAt?: string | null;
  reviewEscalationLevel?: number;
  lastEscalatedAt?: string | null;
  escalationHistory?: EscalationEntry[];
  createdAt: string;
  updatedAt: string;
}

export interface ReviewEntry {
  reviewer: string;
  decision: string;
  opinion: string | null;
  at: string;
}

interface EscalationEntry {
  at: string;
  level: number;
  trigger: string;
  escalateTo: string;
}

export interface SharedAsset {
  id: string;
  assetType: AssetType;
  sourceReportId: string;
  sourceTenantId: string;
  sourceInstanceId: string;
  name: string;
  description: string;
  contentRef: string | null;
  tags: string[];
  version: string;
  status: string;
  publishedBy: string;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetBinding {
  id: string;
  tenantId: string;
  skillId?: string;
  assetId?: string;
  assetType: AssetType;
  status: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function createSkillReport(input: {
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
}): SkillReport {
  return {
    id: newId('skill_report'),
    assetType: normalizeAssetType(input.assetType || 'skill'),
    sourceTenantId: String(input.sourceTenantId || '').trim(),
    sourceInstanceId: String(input.sourceInstanceId || '').trim(),
    sourceSkillId: String(input.sourceSkillId || input.sourceAssetId || '').trim() || null,
    name: String(input.name || '').trim(),
    description: String(input.description || '').trim(),
    contentRef: String(input.contentRef || '').trim() || null,
    tags: Array.isArray(input.tags) ? input.tags.map((x) => String(x).trim()).filter(Boolean) : [],
    version: String(input.version || '1.0.0').trim(),
    status: 'pending_review',
    requiredApprovals: Math.max(1, Number(input.requiredApprovals || 1)),
    approvals: [],
    reviewHistory: [],
    reviewedBy: null,
    reviewedAt: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  };
}

export function createSharedSkillFromReport(report: SkillReport, actor: string): SharedAsset {
  const now = nowIso();
  return {
    id: newId('shared_skill'),
    assetType: normalizeAssetType(report.assetType),
    sourceReportId: report.id,
    sourceTenantId: report.sourceTenantId,
    sourceInstanceId: report.sourceInstanceId,
    name: report.name,
    description: report.description,
    contentRef: report.contentRef,
    tags: report.tags || [],
    version: report.version,
    status: 'active',
    publishedBy: actor,
    publishedAt: now,
    createdAt: now,
    updatedAt: now,
  };
}

export function createSkillBinding(tenantId: string, skillId: string, actor: string): AssetBinding {
  const now = nowIso();
  return {
    id: newId('skill_binding'),
    tenantId,
    skillId,
    assetType: 'skill',
    status: 'active',
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
}

export function createAssetBinding(
  tenantId: string,
  assetId: string,
  assetType: string,
  actor: string
): AssetBinding {
  const now = nowIso();
  return {
    id: newId('asset_binding'),
    tenantId,
    assetId,
    assetType: normalizeAssetType(assetType),
    status: 'active',
    createdBy: actor,
    createdAt: now,
    updatedAt: now,
  };
}
