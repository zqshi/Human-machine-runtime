import { describe, it, expect } from 'vitest';
import {
  createTenant,
  updateTenant,
  suspendTenant,
  activateTenant,
  archiveTenant,
  validateSlug,
  generateSlug,
  TENANT_STATUS,
  TENANT_PLAN,
} from './tenant.js';

describe('validateSlug', () => {
  it('accepts valid slugs', () => {
    expect(validateSlug('dcf-demo')).toEqual({ valid: true, slug: 'dcf-demo' });
    expect(validateSlug('ab')).toEqual({ valid: true, slug: 'ab' });
  });
  it('rejects empty', () => {
    expect(validateSlug('').valid).toBe(false);
  });
  it('rejects too short', () => {
    expect(validateSlug('a').valid).toBe(false);
  });
  it('rejects uppercase', () => {
    expect(validateSlug('Hello').valid).toBe(false);
  });
  it('rejects leading/trailing hyphens', () => {
    expect(validateSlug('-bad').valid).toBe(false);
    expect(validateSlug('bad-').valid).toBe(false);
  });
});

describe('createTenant', () => {
  it('creates a tenant with defaults', () => {
    const t = createTenant({ name: 'Test Inc', slug: 'test-inc' });
    expect(t.name).toBe('Test Inc');
    expect(t.slug).toBe('test-inc');
    expect(t.plan).toBe(TENANT_PLAN.STANDARD);
    expect(t.status).toBe(TENANT_STATUS.ACTIVE);
    expect(t.id).toMatch(/^tn_/);
    expect(t.quotas.maxInstances).toBe(10);
  });

  it('applies enterprise plan quotas', () => {
    const t = createTenant({ name: 'Big Corp', slug: 'big-corp', plan: 'enterprise' });
    expect(t.plan).toBe(TENANT_PLAN.ENTERPRISE);
    expect(t.quotas.maxInstances).toBe(100);
    expect(t.quotas.maxUsers).toBe(500);
  });

  it('applies free plan quotas', () => {
    const t = createTenant({ name: 'Startup', slug: 'startup', plan: 'free' });
    expect(t.quotas.maxInstances).toBe(3);
  });

  it('throws on empty name', () => {
    expect(() => createTenant({ name: '', slug: 'valid' })).toThrow('name is required');
  });

  it('auto-generates slug when not provided', () => {
    const t = createTenant({ name: 'Test' });
    expect(t.slug).toMatch(/^test-[a-f0-9]{6}$/);
  });

  it('auto-generates slug for non-ASCII name', () => {
    const t = createTenant({ name: '测试租户' });
    expect(t.slug).toMatch(/^tenant-[a-f0-9]{6}$/);
  });

  it('throws on explicitly invalid slug', () => {
    expect(() => createTenant({ name: 'Test', slug: '-bad' })).toThrow();
  });

  it('falls back to standard for unknown plan', () => {
    const t = createTenant({ name: 'Test', slug: 'test', plan: 'gold' });
    expect(t.plan).toBe(TENANT_PLAN.STANDARD);
  });

  it('parses features with defaults', () => {
    const t = createTenant({ name: 'Test', slug: 'test', features: { matrixIntegration: true } });
    expect(t.features.matrixIntegration).toBe(true);
    expect(t.features.aiGateway).toBe(true);
  });

  it('parses modelAccess', () => {
    const t = createTenant({
      name: 'Test',
      slug: 'test',
      modelAccess: { allowedProviders: ['openai', 'anthropic'] },
    });
    expect(t.modelAccess.allowedProviders).toEqual(['openai', 'anthropic']);
  });

  it('normalizes quotas with posInt', () => {
    const t = createTenant({
      name: 'Test',
      slug: 'test',
      plan: 'standard',
      quotas: { maxInstances: -5, maxUsers: 999 },
    });
    expect(t.quotas.maxInstances).toBe(10);
    expect(t.quotas.maxUsers).toBe(999);
  });

  it('validates CPU/memory/storage options', () => {
    const t = createTenant({
      name: 'Test',
      slug: 'test',
      quotas: { instanceCpu: '9999m', instanceMemory: '1Gi' },
    });
    expect(t.quotas.instanceCpu).toBe('500m');
    expect(t.quotas.instanceMemory).toBe('1Gi');
  });
});

describe('updateTenant', () => {
  const base = createTenant({ name: 'Test', slug: 'test', plan: 'standard' });

  it('updates name', () => {
    const updated = updateTenant(base, { name: 'New Name' });
    expect(updated.name).toBe('New Name');
    expect(updated.updatedAt).not.toBe(base.updatedAt);
  });

  it('throws on empty name update', () => {
    expect(() => updateTenant(base, { name: '' })).toThrow('cannot be empty');
  });

  it('updates plan', () => {
    const updated = updateTenant(base, { plan: 'enterprise' });
    expect(updated.plan).toBe('enterprise');
  });

  it('throws on invalid plan', () => {
    expect(() => updateTenant(base, { plan: 'gold' })).toThrow('invalid plan');
  });

  it('merges quotas', () => {
    const updated = updateTenant(base, { quotas: { maxInstances: 50 } });
    expect(updated.quotas.maxInstances).toBe(50);
    expect(updated.quotas.maxUsers).toBe(base.quotas.maxUsers);
  });

  it('updates contact info', () => {
    const updated = updateTenant(base, { contactEmail: 'a@b.com', contactName: 'Alice' });
    expect(updated.contactEmail).toBe('a@b.com');
    expect(updated.contactName).toBe('Alice');
  });
});

describe('tenant state transitions', () => {
  const active = createTenant({ name: 'Test', slug: 'test' });

  it('suspends an active tenant', () => {
    const suspended = suspendTenant(active);
    expect(suspended.status).toBe(TENANT_STATUS.SUSPENDED);
  });

  it('activates a suspended tenant', () => {
    const suspended = suspendTenant(active);
    const reactivated = activateTenant(suspended);
    expect(reactivated.status).toBe(TENANT_STATUS.ACTIVE);
  });

  it('archives a tenant', () => {
    const archived = archiveTenant(active);
    expect(archived.status).toBe(TENANT_STATUS.ARCHIVED);
  });

  it('cannot suspend archived', () => {
    const archived = archiveTenant(active);
    expect(() => suspendTenant(archived)).toThrow('cannot suspend archived');
  });

  it('cannot activate archived', () => {
    const archived = archiveTenant(active);
    expect(() => activateTenant(archived)).toThrow('cannot activate archived');
  });
});
