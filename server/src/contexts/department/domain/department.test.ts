import { describe, it, expect } from 'vitest';
import {
  createDepartment,
  updateDepartment,
  slugify,
  validateDepartmentName,
  validateSlug,
  type Department,
} from './department.js';

describe('slugify', () => {
  it('lowercases and dash-joins ascii words', () => {
    expect(slugify('Human Resources')).toBe('human-resources');
  });

  it('collapses non-alphanumeric runs into a single dash', () => {
    expect(slugify('Finance / Billing')).toBe('finance-billing');
  });

  it('trims leading/trailing dashes', () => {
    expect(slugify(' -- Engineering -- ')).toBe('engineering');
  });

  it('falls back to deterministic dept-<hash8> for CJK input', () => {
    const s = slugify('财务部');
    expect(s).toMatch(/^dept-[a-z0-9]{1,8}$/);
    expect(slugify('财务部')).toBe(s);
  });
});

describe('validateDepartmentName', () => {
  it('rejects empty / whitespace', () => {
    expect(validateDepartmentName('')).not.toBeNull();
    expect(validateDepartmentName('   ')).not.toBeNull();
  });

  it('accepts a valid name', () => {
    expect(validateDepartmentName('Finance')).toBeNull();
  });
});

describe('validateSlug', () => {
  it('rejects empty / uppercase / whitespace', () => {
    expect(validateSlug('')).not.toBeNull();
    expect(validateSlug('UPPER')).not.toBeNull();
    expect(validateSlug('has space')).not.toBeNull();
  });

  it('accepts valid slugs', () => {
    expect(validateSlug('finance')).toBeNull();
    expect(validateSlug('human-resources')).toBeNull();
  });
});

describe('createDepartment', () => {
  it('auto-derives slug from name', () => {
    const d = createDepartment({ tenantId: 't1', name: 'Human Resources' });
    expect(d.id).toMatch(/^dept_/);
    expect(d.tenantId).toBe('t1');
    expect(d.name).toBe('Human Resources');
    expect(d.slug).toBe('human-resources');
    expect(d.description).toBe('');
  });

  it('uses explicit slug when valid', () => {
    const d = createDepartment({ tenantId: 't1', name: 'Finance', slug: 'fin' });
    expect(d.slug).toBe('fin');
  });

  it('regenerates slug when explicit slug is invalid', () => {
    const d = createDepartment({ tenantId: 't1', name: 'Finance', slug: 'Bad Slug!' });
    expect(d.slug).toBe('finance');
  });

  it('throws on empty name', () => {
    expect(() => createDepartment({ tenantId: 't1', name: '' })).toThrow();
  });

  it('throws on empty tenantId', () => {
    expect(() => createDepartment({ tenantId: '', name: 'Finance' })).toThrow();
  });
});

describe('updateDepartment', () => {
  const base: Department = createDepartment({ tenantId: 't1', name: 'Finance' });

  it('updates name while keeping slug and identity', () => {
    const u = updateDepartment(base, { name: 'Finance Dept' });
    expect(u.name).toBe('Finance Dept');
    expect(u.slug).toBe(base.slug);
    expect(u.id).toBe(base.id);
    expect(u.tenantId).toBe(base.tenantId);
  });

  it('updates description', () => {
    const u = updateDepartment(base, { description: 'money things' });
    expect(u.description).toBe('money things');
  });

  it('throws on invalid name', () => {
    expect(() => updateDepartment(base, { name: '' })).toThrow();
  });
});
