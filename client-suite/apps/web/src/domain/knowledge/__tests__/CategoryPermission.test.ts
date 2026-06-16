import { describe, it, expect } from 'vitest';
import { findCategoryById, getCategoryName, SYSTEM_CATEGORIES } from '../Category';
import { hasAtLeast } from '../Permission';

describe('Category', () => {
  it('SYSTEM_CATEGORIES has 5 entries', () => {
    expect(SYSTEM_CATEGORIES).toHaveLength(5);
  });

  it('findCategoryById returns match', () => {
    const cat = findCategoryById('cat-official');
    expect(cat).toBeDefined();
    expect(cat!.name).toBe('官方指南');
  });

  it('findCategoryById returns undefined for unknown', () => {
    expect(findCategoryById('no-such')).toBeUndefined();
  });

  it('getCategoryName returns name or fallback', () => {
    expect(getCategoryName('cat-personal')).toBe('个人空间');
    expect(getCategoryName('unknown-id')).toBe('unknown-id');
  });
});

describe('Permission.hasAtLeast', () => {
  it('admin has at least all levels', () => {
    expect(hasAtLeast('admin', 'view')).toBe(true);
    expect(hasAtLeast('admin', 'comment')).toBe(true);
    expect(hasAtLeast('admin', 'edit')).toBe(true);
    expect(hasAtLeast('admin', 'admin')).toBe(true);
  });

  it('view only has view level', () => {
    expect(hasAtLeast('view', 'view')).toBe(true);
    expect(hasAtLeast('view', 'comment')).toBe(false);
    expect(hasAtLeast('view', 'edit')).toBe(false);
    expect(hasAtLeast('view', 'admin')).toBe(false);
  });

  it('edit has comment and view', () => {
    expect(hasAtLeast('edit', 'view')).toBe(true);
    expect(hasAtLeast('edit', 'comment')).toBe(true);
    expect(hasAtLeast('edit', 'edit')).toBe(true);
    expect(hasAtLeast('edit', 'admin')).toBe(false);
  });

  it('comment has view but not edit', () => {
    expect(hasAtLeast('comment', 'view')).toBe(true);
    expect(hasAtLeast('comment', 'comment')).toBe(true);
    expect(hasAtLeast('comment', 'edit')).toBe(false);
  });
});
