import { randomUUID } from 'crypto';
import { newId, nowIso } from '../../../shared/utils.js';

export const TENANT_STATUS = {
  ACTIVE: 'active',
  SUSPENDED: 'suspended',
  ARCHIVED: 'archived',
} as const;
export const TENANT_PLAN = {
  FREE: 'free',
  TRIAL: 'trial',
  STANDARD: 'standard',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
} as const;

export type TenantStatus = (typeof TENANT_STATUS)[keyof typeof TENANT_STATUS];
export type TenantPlan = (typeof TENANT_PLAN)[keyof typeof TENANT_PLAN];

export interface TenantQuotas {
  maxInstances: number;
  maxConcurrentInstances: number;
  maxUsers: number;
  totalCpuMillis: number;
  totalMemoryMB: number;
  totalStorageGB: number;
  instanceCpu: string;
  instanceMemory: string;
  instanceStorage: string;
  knowledgeBaseSizeMB: number;
  tokenBudgetMonthly: number;
  tokenBudgetDaily: number;
  apiCallsDaily: number;
  rateLimitPerMinute: number;
  dataRetentionDays: number;
  maxWebhooks: number;
}

export interface TenantFeatures {
  aiGateway: boolean;
  knowledgeBase: boolean;
  matrixIntegration: boolean;
  customTools: boolean;
}

export interface TenantModelAccess {
  allowedProviders: string[];
}

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  status: TenantStatus;
  quotas: TenantQuotas;
  features: TenantFeatures;
  modelAccess: TenantModelAccess;
  contactEmail: string | null;
  contactName: string | null;
  contactPhone: string | null;
  industry: string;
  companySize: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_QUOTAS: Record<string, TenantQuotas> = {
  free: {
    maxInstances: 3,
    maxConcurrentInstances: 2,
    maxUsers: 5,
    totalCpuMillis: 1000,
    totalMemoryMB: 1024,
    totalStorageGB: 5,
    instanceCpu: '250m',
    instanceMemory: '256Mi',
    instanceStorage: '1Gi',
    knowledgeBaseSizeMB: 256,
    tokenBudgetMonthly: 100000,
    tokenBudgetDaily: 5000,
    apiCallsDaily: 1000,
    rateLimitPerMinute: 20,
    dataRetentionDays: 30,
    maxWebhooks: 2,
  },
  trial: {
    maxInstances: 3,
    maxConcurrentInstances: 2,
    maxUsers: 5,
    totalCpuMillis: 1000,
    totalMemoryMB: 1024,
    totalStorageGB: 5,
    instanceCpu: '250m',
    instanceMemory: '256Mi',
    instanceStorage: '1Gi',
    knowledgeBaseSizeMB: 256,
    tokenBudgetMonthly: 100000,
    tokenBudgetDaily: 5000,
    apiCallsDaily: 1000,
    rateLimitPerMinute: 20,
    dataRetentionDays: 30,
    maxWebhooks: 2,
  },
  standard: {
    maxInstances: 10,
    maxConcurrentInstances: 5,
    maxUsers: 50,
    totalCpuMillis: 8000,
    totalMemoryMB: 8192,
    totalStorageGB: 20,
    instanceCpu: '500m',
    instanceMemory: '512Mi',
    instanceStorage: '2Gi',
    knowledgeBaseSizeMB: 1024,
    tokenBudgetMonthly: 1000000,
    tokenBudgetDaily: 50000,
    apiCallsDaily: 10000,
    rateLimitPerMinute: 60,
    dataRetentionDays: 90,
    maxWebhooks: 10,
  },
  professional: {
    maxInstances: 20,
    maxConcurrentInstances: 10,
    maxUsers: 100,
    totalCpuMillis: 32000,
    totalMemoryMB: 32768,
    totalStorageGB: 100,
    instanceCpu: '1000m',
    instanceMemory: '1Gi',
    instanceStorage: '5Gi',
    knowledgeBaseSizeMB: 5120,
    tokenBudgetMonthly: 5000000,
    tokenBudgetDaily: 250000,
    apiCallsDaily: 50000,
    rateLimitPerMinute: 150,
    dataRetentionDays: 180,
    maxWebhooks: 25,
  },
  enterprise: {
    maxInstances: 100,
    maxConcurrentInstances: 50,
    maxUsers: 500,
    totalCpuMillis: 128000,
    totalMemoryMB: 131072,
    totalStorageGB: 500,
    instanceCpu: '1000m',
    instanceMemory: '1Gi',
    instanceStorage: '5Gi',
    knowledgeBaseSizeMB: 10240,
    tokenBudgetMonthly: 10000000,
    tokenBudgetDaily: 500000,
    apiCallsDaily: 100000,
    rateLimitPerMinute: 300,
    dataRetentionDays: 365,
    maxWebhooks: 50,
  },
};

const CPU_OPTIONS = ['250m', '500m', '1000m', '2000m', '4000m'];
const MEMORY_OPTIONS = ['256Mi', '512Mi', '1Gi', '2Gi', '4Gi', '8Gi'];
const STORAGE_OPTIONS = ['1Gi', '2Gi', '5Gi', '10Gi', '20Gi', '50Gi'];
export const INDUSTRY_VALUES = [
  'fintech',
  'ecommerce',
  'healthcare',
  'education',
  'manufacturing',
  'technology',
  'other',
];
export const COMPANY_SIZE_VALUES = ['startup', 'small', 'medium', 'large', 'enterprise'];

const DEFAULT_FEATURES: TenantFeatures = {
  aiGateway: true,
  knowledgeBase: true,
  matrixIntegration: false,
  customTools: true,
};
const DEFAULT_MODEL_ACCESS: TenantModelAccess = { allowedProviders: [] };

function posInt(val: unknown, fallback: number, min: number): number {
  const n = Number(val);
  return Number.isFinite(n) && n >= min ? Math.floor(n) : fallback;
}

export function validateSlug(slug: string): { valid: boolean; slug?: string; reason?: string } {
  const s = String(slug || '').trim();
  if (!s) return { valid: false, reason: 'slug is required' };
  if (s.length < 2 || s.length > 48) return { valid: false, reason: 'slug must be 2-48 chars' };
  if (!/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(s)) {
    return { valid: false, reason: 'slug must be lowercase alphanumeric with hyphens' };
  }
  return { valid: true, slug: s };
}

function parseFeatures(input?: Partial<TenantFeatures>): TenantFeatures {
  if (!input || typeof input !== 'object') return { ...DEFAULT_FEATURES };
  return {
    aiGateway: input.aiGateway !== false,
    knowledgeBase: input.knowledgeBase !== false,
    matrixIntegration: input.matrixIntegration === true,
    customTools: input.customTools !== false,
  };
}

function parseModelAccess(input?: Partial<TenantModelAccess>): TenantModelAccess {
  if (!input || typeof input !== 'object') return { ...DEFAULT_MODEL_ACCESS };
  return {
    allowedProviders: Array.isArray(input.allowedProviders)
      ? input.allowedProviders.map((p) => String(p).trim()).filter(Boolean)
      : [],
  };
}

function parseQuotas(input: Partial<TenantQuotas> | undefined, plan: string): TenantQuotas {
  const defaults = DEFAULT_QUOTAS[plan] || DEFAULT_QUOTAS.standard;
  if (!input || typeof input !== 'object') return { ...defaults };
  return {
    maxInstances: posInt(input.maxInstances, defaults.maxInstances, 1),
    maxConcurrentInstances: posInt(
      input.maxConcurrentInstances,
      defaults.maxConcurrentInstances,
      1
    ),
    maxUsers: posInt(input.maxUsers, defaults.maxUsers, 1),
    totalCpuMillis: posInt(input.totalCpuMillis, defaults.totalCpuMillis, 0),
    totalMemoryMB: posInt(input.totalMemoryMB, defaults.totalMemoryMB, 0),
    totalStorageGB: posInt(input.totalStorageGB, defaults.totalStorageGB, 0),
    instanceCpu: CPU_OPTIONS.includes(input.instanceCpu || '')
      ? input.instanceCpu!
      : defaults.instanceCpu,
    instanceMemory: MEMORY_OPTIONS.includes(input.instanceMemory || '')
      ? input.instanceMemory!
      : defaults.instanceMemory,
    instanceStorage: STORAGE_OPTIONS.includes(input.instanceStorage || '')
      ? input.instanceStorage!
      : defaults.instanceStorage,
    knowledgeBaseSizeMB: posInt(input.knowledgeBaseSizeMB, defaults.knowledgeBaseSizeMB, 0),
    tokenBudgetMonthly: posInt(input.tokenBudgetMonthly, defaults.tokenBudgetMonthly, 0),
    tokenBudgetDaily: posInt(input.tokenBudgetDaily, defaults.tokenBudgetDaily, 0),
    apiCallsDaily: posInt(input.apiCallsDaily, defaults.apiCallsDaily, 0),
    rateLimitPerMinute: posInt(input.rateLimitPerMinute, defaults.rateLimitPerMinute, 1),
    dataRetentionDays: posInt(input.dataRetentionDays, defaults.dataRetentionDays, 1),
    maxWebhooks: posInt(input.maxWebhooks, defaults.maxWebhooks, 0),
  };
}

export interface CreateTenantInput {
  name: string;
  slug?: string;
  plan?: string;
  quotas?: Partial<TenantQuotas>;
  features?: Partial<TenantFeatures>;
  modelAccess?: Partial<TenantModelAccess>;
  contactEmail?: string;
  contactName?: string;
  contactPhone?: string;
  industry?: string;
  companySize?: string;
  description?: string;
}

/** Generate a slug from name: keep ASCII alphanumerics, collapse to hyphens, append random suffix. */
export function generateSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 6);
  const prefix = base.slice(0, 40) || 'tenant';
  return `${prefix}-${suffix}`;
}

export function createTenant(input: CreateTenantInput): Tenant {
  const name = String(input.name || '').trim();
  if (!name) throw new Error('tenant name is required');

  let slug: string;
  if (input.slug) {
    const slugResult = validateSlug(input.slug);
    if (!slugResult.valid) throw new Error(slugResult.reason);
    slug = slugResult.slug!;
  } else {
    slug = generateSlug(name);
  }

  const plan = (Object.values(TENANT_PLAN) as string[]).includes(input.plan || '')
    ? (input.plan as TenantPlan)
    : TENANT_PLAN.STANDARD;
  const now = nowIso();
  return {
    id: newId('tn'),
    name,
    slug,
    plan,
    status: TENANT_STATUS.ACTIVE,
    quotas: parseQuotas(input.quotas, plan),
    features: parseFeatures(input.features),
    modelAccess: parseModelAccess(input.modelAccess),
    contactEmail: String(input.contactEmail || '').trim() || null,
    contactName: String(input.contactName || '').trim() || null,
    contactPhone: String(input.contactPhone || '').trim() || null,
    industry: INDUSTRY_VALUES.includes(input.industry || '') ? input.industry! : 'other',
    companySize: COMPANY_SIZE_VALUES.includes(input.companySize || '')
      ? input.companySize!
      : 'small',
    description: String(input.description || '').trim() || null,
    createdAt: now,
    updatedAt: now,
  };
}

export function updateTenant(tenant: Tenant, patch: Partial<CreateTenantInput>): Tenant {
  const updated = { ...tenant, updatedAt: nowIso() };
  if (patch.name !== undefined) {
    const name = String(patch.name || '').trim();
    if (!name) throw new Error('tenant name cannot be empty');
    updated.name = name;
  }
  if (patch.plan !== undefined) {
    if (!(Object.values(TENANT_PLAN) as string[]).includes(patch.plan))
      throw new Error(`invalid plan: ${patch.plan}`);
    updated.plan = patch.plan as TenantPlan;
  }
  if (patch.quotas) {
    updated.quotas = parseQuotas({ ...updated.quotas, ...patch.quotas }, updated.plan);
  }
  if (patch.contactEmail !== undefined)
    updated.contactEmail = String(patch.contactEmail || '').trim() || null;
  if (patch.contactName !== undefined)
    updated.contactName = String(patch.contactName || '').trim() || null;
  if (patch.contactPhone !== undefined)
    updated.contactPhone = String(patch.contactPhone || '').trim() || null;
  if (patch.industry !== undefined && INDUSTRY_VALUES.includes(patch.industry))
    updated.industry = patch.industry;
  if (patch.companySize !== undefined && COMPANY_SIZE_VALUES.includes(patch.companySize))
    updated.companySize = patch.companySize;
  if (patch.description !== undefined)
    updated.description = String(patch.description || '').trim() || null;
  if (patch.features !== undefined)
    updated.features = parseFeatures({ ...updated.features, ...patch.features });
  if (patch.modelAccess !== undefined)
    updated.modelAccess = parseModelAccess({ ...updated.modelAccess, ...patch.modelAccess });
  return updated;
}

export function suspendTenant(tenant: Tenant): Tenant {
  if (tenant.status === TENANT_STATUS.ARCHIVED) throw new Error('cannot suspend archived tenant');
  return { ...tenant, status: TENANT_STATUS.SUSPENDED, updatedAt: nowIso() };
}

export function activateTenant(tenant: Tenant): Tenant {
  if (tenant.status === TENANT_STATUS.ARCHIVED) throw new Error('cannot activate archived tenant');
  return { ...tenant, status: TENANT_STATUS.ACTIVE, updatedAt: nowIso() };
}

export function archiveTenant(tenant: Tenant): Tenant {
  return { ...tenant, status: TENANT_STATUS.ARCHIVED, updatedAt: nowIso() };
}
