import { newId, nowIso } from '../../../shared/utils.js';
import { DEFAULT_QUOTAS, type TenantQuotas, type TenantFeatures } from './tenant.js';

export const PLAN_STATUS = { ACTIVE: 'active', ARCHIVED: 'archived' } as const;
export type PlanStatus = (typeof PLAN_STATUS)[keyof typeof PLAN_STATUS];

export interface Plan {
  id: string;
  name: string;
  slug: string;
  displayOrder: number;
  description: string | null;
  isDefault: boolean;
  status: PlanStatus;
  quotaTemplate: TenantQuotas;
  featureTemplate: TenantFeatures;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePlanInput {
  name: string;
  slug: string;
  displayOrder?: number;
  description?: string;
  isDefault?: boolean;
  quotaTemplate?: Partial<TenantQuotas>;
  featureTemplate?: Partial<TenantFeatures>;
}

const DEFAULT_FEATURES: TenantFeatures = {
  aiGateway: true,
  knowledgeBase: true,
  matrixIntegration: false,
  customTools: true,
};

function mergeQuotas(input?: Partial<TenantQuotas>): TenantQuotas {
  const base = DEFAULT_QUOTAS.standard;
  if (!input || typeof input !== 'object') return { ...base };
  return { ...base, ...input } as TenantQuotas;
}

function mergeFeatures(input?: Partial<TenantFeatures>): TenantFeatures {
  if (!input || typeof input !== 'object') return { ...DEFAULT_FEATURES };
  return {
    aiGateway: input.aiGateway !== false,
    knowledgeBase: input.knowledgeBase !== false,
    matrixIntegration: input.matrixIntegration === true,
    customTools: input.customTools !== false,
  };
}

export function validatePlanSlug(slug: string): { valid: boolean; reason?: string } {
  const s = String(slug || '').trim();
  if (!s) return { valid: false, reason: 'slug is required' };
  if (s.length < 2 || s.length > 48) return { valid: false, reason: 'slug must be 2-48 chars' };
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s)) {
    return { valid: false, reason: 'slug must be lowercase alphanumeric with hyphens' };
  }
  return { valid: true };
}

export function createPlan(input: CreatePlanInput): Plan {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('plan name is required');
  const slugCheck = validatePlanSlug(input.slug);
  if (!slugCheck.valid) throw new Error(slugCheck.reason);
  const now = nowIso();
  return {
    id: newId('plan'),
    name,
    slug: input.slug.trim(),
    displayOrder: Number(input.displayOrder) || 0,
    description: String(input.description || '').trim() || null,
    isDefault: input.isDefault === true,
    status: PLAN_STATUS.ACTIVE,
    quotaTemplate: mergeQuotas(input.quotaTemplate),
    featureTemplate: mergeFeatures(input.featureTemplate),
    createdAt: now,
    updatedAt: now,
  };
}

export function updatePlan(plan: Plan, patch: Partial<CreatePlanInput>): Plan {
  const updated = { ...plan, updatedAt: nowIso() };
  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) throw new Error('plan name cannot be empty');
    updated.name = name;
  }
  if (patch.displayOrder !== undefined) updated.displayOrder = Number(patch.displayOrder) || 0;
  if (patch.description !== undefined)
    updated.description = String(patch.description || '').trim() || null;
  if (patch.isDefault !== undefined) updated.isDefault = patch.isDefault === true;
  if (patch.quotaTemplate) {
    updated.quotaTemplate = { ...updated.quotaTemplate, ...patch.quotaTemplate } as TenantQuotas;
  }
  if (patch.featureTemplate) {
    updated.featureTemplate = mergeFeatures({
      ...updated.featureTemplate,
      ...patch.featureTemplate,
    });
  }
  return updated;
}
