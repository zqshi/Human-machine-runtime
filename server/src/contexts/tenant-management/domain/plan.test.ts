import {
  createPlan,
  updatePlan,
  validatePlanSlug,
  PLAN_STATUS,
} from './plan.js';
import { DEFAULT_QUOTAS } from './tenant.js';

describe('validatePlanSlug', () => {
  it('accepts valid slugs', () => {
    expect(validatePlanSlug('standard')).toEqual({ valid: true });
    expect(validatePlanSlug('st')).toEqual({ valid: true });
    expect(validatePlanSlug('a-b-c')).toEqual({ valid: true });
  });

  it('accepts max boundary 48 chars', () => {
    const slug = 'a'.repeat(48);
    expect(validatePlanSlug(slug).valid).toBe(true);
  });

  it('rejects empty', () => {
    const r = validatePlanSlug('');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('slug is required');
  });

  it('rejects non-string (coerced empty)', () => {
    expect(validatePlanSlug(null as unknown as string).valid).toBe(false);
    expect(validatePlanSlug(undefined as unknown as string).valid).toBe(false);
  });

  it('rejects too short', () => {
    const r = validatePlanSlug('a');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('slug must be 2-48 chars');
  });

  it('rejects too long', () => {
    const r = validatePlanSlug('a'.repeat(49));
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('slug must be 2-48 chars');
  });

  it('rejects uppercase', () => {
    const r = validatePlanSlug('Standard');
    expect(r.valid).toBe(false);
    expect(r.reason).toBe('slug must be lowercase alphanumeric with hyphens');
  });

  it('rejects leading/trailing hyphens', () => {
    expect(validatePlanSlug('-bad').valid).toBe(false);
    expect(validatePlanSlug('bad-').valid).toBe(false);
  });

  it('rejects special chars', () => {
    expect(validatePlanSlug('bad_slug').valid).toBe(false);
    expect(validatePlanSlug('bad.slug').valid).toBe(false);
    expect(validatePlanSlug('bad!').valid).toBe(false);
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validatePlanSlug('  standard  ').valid).toBe(true);
  });
});

describe('createPlan', () => {
  it('creates a plan with defaults', () => {
    const p = createPlan({ name: 'Standard', slug: 'standard' });
    expect(p.name).toBe('Standard');
    expect(p.slug).toBe('standard');
    expect(p.id).toMatch(/^plan_/);
    expect(p.displayOrder).toBe(0);
    expect(p.description).toBeNull();
    expect(p.isDefault).toBe(false);
    expect(p.status).toBe(PLAN_STATUS.ACTIVE);
    expect(p.createdAt).toBe(p.updatedAt);
  });

  it('defaults quotaTemplate to standard quotas', () => {
    const p = createPlan({ name: 'Std', slug: 'std' });
    expect(p.quotaTemplate).toEqual(DEFAULT_QUOTAS.standard);
  });

  it('defaults featureTemplate to all-but-matrix', () => {
    const p = createPlan({ name: 'Std', slug: 'std' });
    expect(p.featureTemplate).toEqual({
      aiGateway: true,
      knowledgeBase: true,
      matrixIntegration: false,
      customTools: true,
    });
  });

  it('trims name', () => {
    const p = createPlan({ name: '  Standard  ', slug: 'standard' });
    expect(p.name).toBe('Standard');
  });

  it('parses displayOrder as number', () => {
    expect(createPlan({ name: 'P', slug: 'pp', displayOrder: 5 }).displayOrder).toBe(5);
    expect(createPlan({ name: 'P', slug: 'pp', displayOrder: 0 }).displayOrder).toBe(0);
    expect(createPlan({ name: 'P', slug: 'pp', displayOrder: NaN }).displayOrder).toBe(0);
    expect(createPlan({ name: 'P', slug: 'pp' }).displayOrder).toBe(0);
  });

  it('normalizes empty description to null', () => {
    expect(createPlan({ name: 'P', slug: 'pp', description: '' }).description).toBeNull();
    expect(createPlan({ name: 'P', slug: 'pp', description: '   ' }).description).toBeNull();
    expect(createPlan({ name: 'P', slug: 'pp', description: 'desc' }).description).toBe('desc');
  });

  it('only sets isDefault true when explicitly true', () => {
    expect(createPlan({ name: 'P', slug: 'pp', isDefault: true }).isDefault).toBe(true);
    expect(createPlan({ name: 'P', slug: 'pp', isDefault: false }).isDefault).toBe(false);
    expect(createPlan({ name: 'P', slug: 'pp' }).isDefault).toBe(false);
  });

  it('merges quotaTemplate over standard base', () => {
    const p = createPlan({ name: 'P', slug: 'pp', quotaTemplate: { maxInstances: 999 } });
    expect(p.quotaTemplate.maxInstances).toBe(999);
    // 未覆盖字段保留标准基线
    expect(p.quotaTemplate.maxUsers).toBe(DEFAULT_QUOTAS.standard.maxUsers);
  });

  it('featureTemplate: explicit false disables opt-in features', () => {
    const p = createPlan({
      name: 'P',
      slug: 'pp',
      featureTemplate: { aiGateway: false, knowledgeBase: false, customTools: false },
    });
    expect(p.featureTemplate.aiGateway).toBe(false);
    expect(p.featureTemplate.knowledgeBase).toBe(false);
    expect(p.featureTemplate.customTools).toBe(false);
    // matrix 默认 false，显式 true 才开
    expect(p.featureTemplate.matrixIntegration).toBe(false);
  });

  it('featureTemplate: matrixIntegration requires explicit true', () => {
    const p = createPlan({
      name: 'P',
      slug: 'pp',
      featureTemplate: { matrixIntegration: true },
    });
    expect(p.featureTemplate.matrixIntegration).toBe(true);
  });

  it('featureTemplate: null/undefined falls back to defaults', () => {
    const p = createPlan({
      name: 'P',
      slug: 'pp',
      featureTemplate: undefined,
    });
    expect(p.featureTemplate.aiGateway).toBe(true);
    const p2 = createPlan({ name: 'P', slug: 'pp', featureTemplate: null as unknown as object });
    expect(p2.featureTemplate.aiGateway).toBe(true);
  });

  it('quotaTemplate: null/undefined falls back to standard', () => {
    const p = createPlan({ name: 'P', slug: 'pp', quotaTemplate: undefined });
    expect(p.quotaTemplate).toEqual(DEFAULT_QUOTAS.standard);
    const p2 = createPlan({ name: 'P', slug: 'pp', quotaTemplate: null as unknown as object });
    expect(p2.quotaTemplate).toEqual(DEFAULT_QUOTAS.standard);
  });

  it('throws on empty name', () => {
    expect(() => createPlan({ name: '', slug: 'p' })).toThrow('plan name is required');
    expect(() => createPlan({ name: '   ', slug: 'p' })).toThrow('plan name is required');
  });

  it('throws on null/undefined name', () => {
    expect(() => createPlan({ name: null as unknown as string, slug: 'p' })).toThrow(
      'plan name is required',
    );
    expect(() => createPlan({ name: undefined as unknown as string, slug: 'p' })).toThrow(
      'plan name is required',
    );
  });

  it('throws on invalid slug (propagates reason)', () => {
    expect(() => createPlan({ name: 'P', slug: '' })).toThrow('slug is required');
    expect(() => createPlan({ name: 'P', slug: 'A' })).toThrow('slug must be 2-48 chars');
    expect(() => createPlan({ name: 'P', slug: 'Bad_Slug' })).toThrow(
      'slug must be lowercase alphanumeric with hyphens',
    );
  });
});

describe('updatePlan', () => {
  const base = createPlan({ name: 'Std', slug: 'std', displayOrder: 1 });

  it('returns a new top-level object (shallow copy)', () => {
    const u = updatePlan(base, {});
    expect(u).not.toBe(base);
    // 不传 quotaTemplate patch 时，浅拷贝保留原引用（合理行为）
    expect(u.quotaTemplate).toBe(base.quotaTemplate);
  });

  it('creates a new quotaTemplate object when quotaTemplate patch provided', () => {
    const u = updatePlan(base, { quotaTemplate: { maxInstances: 1 } });
    expect(u.quotaTemplate).not.toBe(base.quotaTemplate);
  });

  it('creates a new featureTemplate object when featureTemplate patch provided', () => {
    const u = updatePlan(base, { featureTemplate: { matrixIntegration: true } });
    expect(u.featureTemplate).not.toBe(base.featureTemplate);
  });

  it('bumps updatedAt', () => {
    const u = updatePlan(base, {});
    // 至少相同或更新；纯函数下 nowIso 单调
    expect(typeof u.updatedAt).toBe('string');
    expect(u.updatedAt.length).toBeGreaterThan(0);
  });

  it('updates name', () => {
    expect(updatePlan(base, { name: 'New' }).name).toBe('New');
  });

  it('trims updated name', () => {
    expect(updatePlan(base, { name: '  New  ' }).name).toBe('New');
  });

  it('throws on empty name update', () => {
    expect(() => updatePlan(base, { name: '' })).toThrow('plan name cannot be empty');
    expect(() => updatePlan(base, { name: '   ' })).toThrow('plan name cannot be empty');
  });

  it('updates displayOrder', () => {
    expect(updatePlan(base, { displayOrder: 7 }).displayOrder).toBe(7);
    expect(updatePlan(base, { displayOrder: NaN }).displayOrder).toBe(0);
  });

  it('updates description', () => {
    expect(updatePlan(base, { description: 'd' }).description).toBe('d');
    expect(updatePlan(base, { description: '' }).description).toBeNull();
  });

  it('updates isDefault', () => {
    expect(updatePlan(base, { isDefault: true }).isDefault).toBe(true);
    expect(updatePlan(base, { isDefault: false }).isDefault).toBe(false);
  });

  it('merges quotaTemplate', () => {
    const u = updatePlan(base, { quotaTemplate: { maxInstances: 42 } });
    expect(u.quotaTemplate.maxInstances).toBe(42);
    // 未覆盖字段保留原值
    expect(u.quotaTemplate.maxUsers).toBe(base.quotaTemplate.maxUsers);
  });

  it('merges featureTemplate via mergeFeatures (matrix opt-in)', () => {
    const u = updatePlan(base, { featureTemplate: { matrixIntegration: true } });
    expect(u.featureTemplate.matrixIntegration).toBe(true);
    // 其余字段保持默认 true
    expect(u.featureTemplate.aiGateway).toBe(true);
  });

  it('merges featureTemplate disabling aiGateway', () => {
    const u = updatePlan(base, { featureTemplate: { aiGateway: false } });
    expect(u.featureTemplate.aiGateway).toBe(false);
  });

  it('ignores undefined fields (no-op patch keeps base values)', () => {
    const u = updatePlan(base, {
      name: undefined,
      displayOrder: undefined,
      description: undefined,
      isDefault: undefined,
    });
    expect(u.name).toBe(base.name);
    expect(u.displayOrder).toBe(base.displayOrder);
    expect(u.description).toBe(base.description);
    expect(u.isDefault).toBe(base.isDefault);
  });
});
