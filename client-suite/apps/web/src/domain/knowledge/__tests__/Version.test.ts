import { describe, it, expect } from 'vitest';
import { Version } from '../Version';

describe('Version', () => {
  const baseProps = {
    id: 'v-1',
    documentId: 'doc-1',
    version: 1,
    author: { name: 'Alice' },
    createdAt: '2026-03-01T10:00:00Z',
    changeDescription: '初始创建',
    diffStats: { added: 50, removed: 0 },
  };

  it('creates with defaults', () => {
    const v = Version.create(baseProps);
    expect(v.version).toBe(1);
    expect(v.contentSnapshot).toBe('');
    expect(v.status).toBe('auto');
    expect(v.totalChanges).toBe(50);
  });

  it('creates with snapshot and status', () => {
    const v = Version.create({
      ...baseProps,
      contentSnapshot: '<p>内容快照</p>',
      status: 'published',
    });
    expect(v.hasSnapshot).toBe(true);
    expect(v.isPublished).toBe(true);
    expect(v.statusLabel).toBe('发布版本');
  });

  it('hasSnapshot is false when empty', () => {
    const v = Version.create(baseProps);
    expect(v.hasSnapshot).toBe(false);
  });

  it('statusLabel returns correct Chinese label', () => {
    expect(Version.create({ ...baseProps, status: 'auto' }).statusLabel).toBe('自动保存');
    expect(Version.create({ ...baseProps, status: 'manual' }).statusLabel).toBe('手动保存');
    expect(Version.create({ ...baseProps, status: 'published' }).statusLabel).toBe('发布版本');
  });
});
