import { describe, it, expect } from 'vitest';
import { Document } from '../Document';

const baseProps = {
  id: 'doc-1',
  title: '产品需求文档',
  content: '<p>这是一份产品需求文档</p>',
  folderId: 'folder-1',
  type: 'doc' as const,
  createdAt: '2026-03-01T10:00:00Z',
  updatedAt: '2026-03-05T14:30:00Z',
  author: { name: 'Alice' },
};

describe('Document', () => {
  it('creates with required props and defaults', () => {
    const doc = Document.create(baseProps);
    expect(doc.id).toBe('doc-1');
    expect(doc.title).toBe('产品需求文档');
    expect(doc.type).toBe('doc');
    expect(doc.tags).toEqual([]);
    expect(doc.starred).toBe(false);
    expect(doc.size).toBe('0 KB');
    // New defaults
    expect(doc.status).toBe('draft');
    expect(doc.categoryId).toBe('folder-1'); // defaults to folderId
    expect(doc.ownerId).toBe('');
    expect(doc.permissions).toEqual([]);
    expect(doc.reviewedBy).toBeNull();
    expect(doc.readCount).toBe(0);
    expect(doc.securitySettings).toEqual({
      watermark: false,
      preventCopy: false,
      preventDownload: false,
    });
  });

  it('creates with optional props', () => {
    const doc = Document.create({
      ...baseProps,
      tags: ['PRD', 'Q3'],
      starred: true,
      size: '24 KB',
      status: 'published',
      categoryId: 'cat-official',
      ownerId: 'user-1',
    });
    expect(doc.tags).toEqual(['PRD', 'Q3']);
    expect(doc.starred).toBe(true);
    expect(doc.size).toBe('24 KB');
    expect(doc.status).toBe('published');
    expect(doc.categoryId).toBe('cat-official');
    expect(doc.ownerId).toBe('user-1');
  });

  it('returns excerpt from HTML content', () => {
    const doc = Document.create(baseProps);
    expect(doc.excerpt).toBe('这是一份产品需求文档');
  });

  it('updates content immutably', () => {
    const doc = Document.create(baseProps);
    const updated = doc.withContent('新内容');
    expect(updated.content).toBe('新内容');
    expect(doc.content).toBe('<p>这是一份产品需求文档</p>');
  });

  it('toggles starred immutably', () => {
    const doc = Document.create(baseProps);
    const starred = doc.withStarred(true);
    expect(starred.starred).toBe(true);
    expect(doc.starred).toBe(false);
  });

  it('matches search by title and tags', () => {
    const doc = Document.create({ ...baseProps, tags: ['PRD'] });
    expect(doc.matchesSearch('产品')).toBe(true);
    expect(doc.matchesSearch('prd')).toBe(true);
    expect(doc.matchesSearch('设计')).toBe(false);
    expect(doc.matchesSearch('')).toBe(true);
  });

  // ── Lifecycle tests ──

  describe('lifecycle transitions', () => {
    it('draft → pending_review', () => {
      const doc = Document.create({ ...baseProps, status: 'draft' });
      expect(doc.canTransitionTo('pending_review')).toBe(true);
      const submitted = doc.submitForReview();
      expect(submitted.status).toBe('pending_review');
      expect(doc.status).toBe('draft'); // immutable
    });

    it('draft → published (direct publish)', () => {
      const doc = Document.create({ ...baseProps, status: 'draft' });
      expect(doc.canTransitionTo('published')).toBe(true);
      const published = doc.publish();
      expect(published.status).toBe('published');
    });

    it('pending_review → published (approve)', () => {
      const doc = Document.create({ ...baseProps, status: 'pending_review' });
      const approved = doc.approve({ name: '审核员' });
      expect(approved.status).toBe('published');
      expect(approved.reviewedBy).toEqual({ name: '审核员' });
    });

    it('pending_review → draft (reject)', () => {
      const doc = Document.create({ ...baseProps, status: 'pending_review' });
      const rejected = doc.reject({ name: '审核员' }, '内容需要修改');
      expect(rejected.status).toBe('draft');
      expect(rejected.reviewComment).toBe('内容需要修改');
      expect(rejected.reviewedBy).toEqual({ name: '审核员' });
    });

    it('published → archived', () => {
      const doc = Document.create({ ...baseProps, status: 'published' });
      expect(doc.canTransitionTo('archived')).toBe(true);
      const archived = doc.archive();
      expect(archived.status).toBe('archived');
    });

    it('archived → draft (restore)', () => {
      const doc = Document.create({ ...baseProps, status: 'archived' });
      expect(doc.canTransitionTo('draft')).toBe(true);
    });

    it('throws on invalid transition', () => {
      const doc = Document.create({ ...baseProps, status: 'archived' });
      expect(() => doc.publish()).toThrow('Cannot publish from status: archived');
      expect(() => doc.submitForReview()).toThrow('Cannot submit for review from status: archived');
    });

    it('throws reject on non-pending doc', () => {
      const doc = Document.create({ ...baseProps, status: 'draft' });
      expect(() => doc.reject({ name: 'X' }, 'reason')).toThrow('Cannot reject from status: draft');
    });
  });

  // ── Status helpers ──

  describe('status helpers', () => {
    it('isDraft / isPublished / etc', () => {
      expect(Document.create({ ...baseProps, status: 'draft' }).isDraft).toBe(true);
      expect(Document.create({ ...baseProps, status: 'published' }).isPublished).toBe(true);
      expect(Document.create({ ...baseProps, status: 'pending_review' }).isPendingReview).toBe(true);
      expect(Document.create({ ...baseProps, status: 'archived' }).isArchived).toBe(true);
    });

    it('statusLabel returns Chinese label', () => {
      expect(Document.create({ ...baseProps, status: 'draft' }).statusLabel).toBe('草稿');
      expect(Document.create({ ...baseProps, status: 'published' }).statusLabel).toBe('已发布');
    });
  });

  // ── Permission tests ──

  describe('permissions', () => {
    it('owner always has access', () => {
      const doc = Document.create({ ...baseProps, ownerId: 'user-1' });
      expect(doc.isAccessibleBy('user-1', 'admin')).toBe(true);
    });

    it('checks permission level', () => {
      const doc = Document.create({
        ...baseProps,
        ownerId: 'user-1',
        permissions: [
          { userId: 'user-2', userName: 'Bob', level: 'edit', grantedBy: 'user-1', grantedAt: '2026-01-01' },
          { userId: 'user-3', userName: 'Carol', level: 'view', grantedBy: 'user-1', grantedAt: '2026-01-01' },
        ],
      });
      expect(doc.isAccessibleBy('user-2', 'edit')).toBe(true);
      expect(doc.isAccessibleBy('user-2', 'admin')).toBe(false);
      expect(doc.isAccessibleBy('user-3', 'view')).toBe(true);
      expect(doc.isAccessibleBy('user-3', 'edit')).toBe(false);
      expect(doc.isAccessibleBy('user-999')).toBe(false);
    });
  });

  // ── toProps roundtrip ──

  it('toProps roundtrip preserves all fields', () => {
    const props = {
      ...baseProps,
      status: 'published' as const,
      categoryId: 'cat-official',
      ownerId: 'user-1',
      departmentId: 'dept-1',
      readCount: 42,
      tags: ['tag1'],
      starred: true,
    };
    const doc = Document.create(props);
    const roundtrip = Document.create(doc.toProps());
    expect(roundtrip.id).toBe(doc.id);
    expect(roundtrip.status).toBe(doc.status);
    expect(roundtrip.categoryId).toBe(doc.categoryId);
    expect(roundtrip.readCount).toBe(doc.readCount);
  });
});
