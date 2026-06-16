import { describe, it, expect } from 'vitest';
import { fromDTO, toCreateDTO, toUpdateDTO } from '../documentAdapter';
import type { DocumentDTO } from '../dcfApiClient';

function makeDTO(overrides: Partial<DocumentDTO> = {}): DocumentDTO {
  return {
    id: 'doc-1',
    title: 'Test Doc',
    type: 'doc',
    content: { html: '<p>hello</p>', _meta: {} },
    createdBy: 'alice',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-02T00:00:00Z',
    version: 1,
    ...overrides,
  };
}

describe('documentAdapter', () => {
  describe('fromDTO', () => {
    it('maps basic fields', () => {
      const doc = fromDTO(makeDTO());
      expect(doc.id).toBe('doc-1');
      expect(doc.title).toBe('Test Doc');
      expect(doc.content).toBe('<p>hello</p>');
      expect(doc.type).toBe('doc');
    });

    it('maps new lifecycle fields', () => {
      const doc = fromDTO(makeDTO({ status: 'published', categoryId: 'cat-1', departmentId: 'dept-1', ownerId: 'bob' } as any));
      expect(doc.status).toBe('published');
      expect(doc.categoryId).toBe('cat-1');
      expect(doc.departmentId).toBe('dept-1');
      expect(doc.ownerId).toBe('bob');
    });

    it('defaults status to draft when missing', () => {
      const doc = fromDTO(makeDTO());
      expect(doc.status).toBe('draft');
    });

    it('maps permissions array', () => {
      const perms = [{ userId: 'u1', level: 'edit', grantedBy: 'admin', grantedAt: '2026-01-01' }];
      const doc = fromDTO(makeDTO({ permissions: perms } as any));
      expect(doc.permissions).toEqual(perms);
    });

    it('converts code type to markdown', () => {
      const doc = fromDTO(makeDTO({ type: 'code' as any }));
      expect(doc.type).toBe('markdown');
    });

    it('handles missing content gracefully', () => {
      const doc = fromDTO(makeDTO({ content: undefined as any }));
      expect(doc.content).toBe('');
    });

    it('extracts tags from _meta', () => {
      const doc = fromDTO(makeDTO({ content: { html: '', _meta: { tags: ['a', 'b'] } } }));
      expect(doc.tags).toEqual(['a', 'b']);
    });
  });

  describe('toCreateDTO', () => {
    it('builds minimal create payload', () => {
      const dto = toCreateDTO({ title: 'New' });
      expect(dto.title).toBe('New');
      expect(dto.type).toBe('doc');
      expect(dto.content?.html).toBe('');
    });

    it('includes tags and starred in _meta', () => {
      const dto = toCreateDTO({ title: 'T', tags: ['x'], starred: true });
      expect(dto.content?._meta?.tags).toEqual(['x']);
      expect(dto.content?._meta?.starred).toBe(true);
    });
  });

  describe('toUpdateDTO', () => {
    it('includes only provided fields', () => {
      const dto = toUpdateDTO({ title: 'Updated' });
      expect(dto.title).toBe('Updated');
      expect(dto.version).toBeUndefined();
    });

    it('puts folderId in _meta', () => {
      const dto = toUpdateDTO({ folderId: 'f-1' });
      expect(dto.content?._meta?.folderId).toBe('f-1');
    });
  });
});
