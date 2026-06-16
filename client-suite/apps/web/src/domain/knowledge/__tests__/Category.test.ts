import { describe, it, expect } from 'vitest';
import { findCategoryById, getCategoryName, SYSTEM_CATEGORIES } from '../Category';

describe('Category', () => {
  it('finds existing category by id', () => {
    const cat = findCategoryById('cat-official');
    expect(cat).toBeDefined();
    expect(cat!.name).toBe('官方指南');
  });

  it('returns undefined for unknown id', () => {
    expect(findCategoryById('nonexistent')).toBeUndefined();
  });

  it('getCategoryName returns name for known id', () => {
    expect(getCategoryName('cat-personal')).toBe('个人空间');
  });

  it('getCategoryName returns raw id for unknown id', () => {
    expect(getCategoryName('unknown-id')).toBe('unknown-id');
  });

  it('has 5 system categories', () => {
    expect(SYSTEM_CATEGORIES).toHaveLength(5);
  });
});
