import { describe, it, expect } from 'vitest';
import { Folder } from '../Folder';

describe('Folder', () => {
  it('creates a root folder with defaults', () => {
    const folder = Folder.create({
      id: 'f-1',
      name: '产品文档',
      parentId: null,
      icon: 'inventory_2',
    });
    expect(folder.id).toBe('f-1');
    expect(folder.isRoot).toBe(true);
    expect(folder.hasChildren).toBe(false);
    expect(folder.documentCount).toBe(0);
    expect(folder.type).toBe('user');
    expect(folder.departmentId).toBe('');
    expect(folder.ownerId).toBe('');
  });

  it('creates a system folder', () => {
    const folder = Folder.create({
      id: 'cat-official',
      name: '官方指南',
      parentId: null,
      icon: 'verified',
      type: 'system',
    });
    expect(folder.isSystem).toBe(true);
    expect(folder.isDepartment).toBe(false);
  });

  it('creates a department folder', () => {
    const folder = Folder.create({
      id: 'f-dept-finance',
      name: '财务部',
      parentId: 'cat-department',
      icon: 'corporate_fare',
      type: 'department',
      departmentId: 'dept-finance',
      documentCount: 128,
    });
    expect(folder.isDepartment).toBe(true);
    expect(folder.departmentId).toBe('dept-finance');
    expect(folder.documentCount).toBe(128);
  });

  it('creates a child folder', () => {
    const folder = Folder.create({
      id: 'f-2',
      name: 'API 文档',
      parentId: 'f-1',
      icon: 'code',
      documentCount: 3,
    });
    expect(folder.isRoot).toBe(false);
    expect(folder.parentId).toBe('f-1');
    expect(folder.documentCount).toBe(3);
  });

  it('supports nested children', () => {
    const child = Folder.create({
      id: 'f-child',
      name: '子目录',
      parentId: 'f-root',
      icon: 'folder',
    });
    const root = Folder.create({
      id: 'f-root',
      name: '根目录',
      parentId: null,
      icon: 'folder',
      children: [child],
    });
    expect(root.hasChildren).toBe(true);
    expect(root.children[0].id).toBe('f-child');
  });

  it('replaces children immutably', () => {
    const folder = Folder.create({
      id: 'f-1',
      name: '文档',
      parentId: null,
      icon: 'folder',
    });
    const newChild = Folder.create({
      id: 'f-new',
      name: '新增',
      parentId: 'f-1',
      icon: 'folder',
    });
    const updated = folder.withChildren([newChild]);
    expect(updated.hasChildren).toBe(true);
    expect(folder.hasChildren).toBe(false);
  });

  it('adds child immutably', () => {
    const folder = Folder.create({ id: 'f-1', name: '根', parentId: null, icon: 'folder' });
    const child = Folder.create({ id: 'f-c', name: '子', parentId: 'f-1', icon: 'folder' });
    const updated = folder.addChild(child);
    expect(updated.children).toHaveLength(1);
    expect(folder.children).toHaveLength(0);
  });

  it('removes child immutably', () => {
    const child = Folder.create({ id: 'f-c', name: '子', parentId: 'f-1', icon: 'folder' });
    const folder = Folder.create({ id: 'f-1', name: '根', parentId: null, icon: 'folder', children: [child] });
    const updated = folder.removeChild('f-c');
    expect(updated.children).toHaveLength(0);
    expect(folder.children).toHaveLength(1);
  });

  it('withName updates name immutably', () => {
    const folder = Folder.create({ id: 'f-1', name: '旧名', parentId: null, icon: 'folder' });
    const renamed = folder.withName('新名');
    expect(renamed.name).toBe('新名');
    expect(folder.name).toBe('旧名');
  });

  it('matches search query', () => {
    const folder = Folder.create({
      id: 'f-1',
      name: '技术文档',
      parentId: null,
      icon: 'code',
    });
    expect(folder.matchesSearch('技术')).toBe(true);
    expect(folder.matchesSearch('设计')).toBe(false);
    expect(folder.matchesSearch('')).toBe(true);
  });

  it('toProps roundtrip preserves fields', () => {
    const folder = Folder.create({
      id: 'f-1',
      name: '测试',
      parentId: null,
      icon: 'folder',
      type: 'department',
      departmentId: 'dept-1',
      description: '描述',
    });
    const roundtrip = Folder.create(folder.toProps());
    expect(roundtrip.type).toBe('department');
    expect(roundtrip.departmentId).toBe('dept-1');
    expect(roundtrip.description).toBe('描述');
  });
});
