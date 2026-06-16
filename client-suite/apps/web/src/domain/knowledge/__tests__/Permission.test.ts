import { describe, it, expect } from 'vitest';
import { hasAtLeast } from '../Permission';
import type { PermissionLevel } from '../Permission';

describe('Permission.hasAtLeast', () => {
  it('admin has at least view', () => {
    expect(hasAtLeast('admin', 'view')).toBe(true);
  });

  it('view does not have at least edit', () => {
    expect(hasAtLeast('view', 'edit')).toBe(false);
  });

  it('same level satisfies check', () => {
    expect(hasAtLeast('comment', 'comment')).toBe(true);
  });

  it('respects full ordering', () => {
    const levels: PermissionLevel[] = ['view', 'comment', 'edit', 'admin'];
    for (let i = 0; i < levels.length; i++) {
      for (let j = 0; j < levels.length; j++) {
        expect(hasAtLeast(levels[i], levels[j])).toBe(i >= j);
      }
    }
  });
});
