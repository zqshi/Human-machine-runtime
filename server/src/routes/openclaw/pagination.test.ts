import { describe, it, expect, vi } from 'vitest';
import { parsePagination, pagedResponse, filteredResponse } from './pagination.js';
import type { OpenclawRepository } from '../../db/repositories/openclaw-repository.js';

type RepoOverrides = Partial<Pick<OpenclawRepository, 'list' | 'listPaged'>>;

function mockRepo(overrides: RepoOverrides = {}): OpenclawRepository {
  return {
    list: overrides.list ?? vi.fn().mockResolvedValue([]),
    listPaged:
      overrides.listPaged ??
      vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 }),
    get: vi.fn(),
    upsert: vi.fn(),
    remove: vi.fn(),
  } as unknown as OpenclawRepository;
}

describe('parsePagination', () => {
  it('无参 → 默认 limit=50, offset=0', () => {
    expect(parsePagination(() => undefined)).toEqual({ limit: 50, offset: 0 });
  });

  it('limit=10 → limit=10', () => {
    expect(parsePagination((k) => (k === 'limit' ? '10' : undefined))).toEqual({
      limit: 10,
      offset: 0,
    });
  });

  it('limit 超上限 999 → 截断 200', () => {
    expect(parsePagination((k) => (k === 'limit' ? '999' : undefined)).limit).toBe(200);
  });

  it('limit=0/负数/非数字 → 默认 50', () => {
    expect(parsePagination((k) => (k === 'limit' ? '0' : undefined)).limit).toBe(50);
    expect(parsePagination((k) => (k === 'limit' ? '-5' : undefined)).limit).toBe(50);
    expect(parsePagination((k) => (k === 'limit' ? 'abc' : undefined)).limit).toBe(50);
  });

  it('offset=5 → offset=5;负数 → 0', () => {
    expect(parsePagination((k) => (k === 'offset' ? '5' : undefined)).offset).toBe(5);
    expect(parsePagination((k) => (k === 'offset' ? '-1' : undefined)).offset).toBe(0);
  });
});

describe('pagedResponse', () => {
  it('调 repo.listPaged 透传解析后的 limit/offset,返回其结果', async () => {
    const listPaged = vi
      .fn()
      .mockResolvedValue({ items: [{ id: '1' }], total: 1, limit: 10, offset: 0 });
    const repo = mockRepo({ listPaged });
    const res = await pagedResponse(repo, 'objective', (k) => (k === 'limit' ? '10' : undefined));
    expect(listPaged).toHaveBeenCalledWith('objective', { limit: 10, offset: 0 });
    expect(res).toEqual({ items: [{ id: '1' }], total: 1, limit: 10, offset: 0 });
  });

  it('不传参 → limit=50 传给 listPaged(默认非空,不全量)', async () => {
    const listPaged = vi.fn().mockResolvedValue({ items: [], total: 0, limit: 50, offset: 0 });
    const repo = mockRepo({ listPaged });
    await pagedResponse(repo, 'task', () => undefined);
    expect(listPaged).toHaveBeenCalledWith('task', { limit: 50, offset: 0 });
  });
});

describe('filteredResponse', () => {
  it('无 filterFn → 返回全部 slice + total=全长', async () => {
    const list = vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }]);
    const repo = mockRepo({ list });
    const res = await filteredResponse(repo, 'objective', () => undefined);
    expect(list).toHaveBeenCalledWith('objective');
    expect(res.total).toBe(3);
    expect(res.items).toHaveLength(3);
    expect(res.limit).toBe(50);
  });

  it('filterFn → filter 后 slice,total=filter 后真实长度', async () => {
    const list = vi.fn().mockResolvedValue([
      { id: '1', level: 'L0' },
      { id: '2', level: 'L1' },
      { id: '3', level: 'L0' },
    ]);
    const repo = mockRepo({ list });
    const res = await filteredResponse(
      repo,
      'objective',
      () => undefined,
      (items) => items.filter((o) => o.level === 'L0')
    );
    expect(res.total).toBe(2);
    expect(res.items).toHaveLength(2);
    expect(res.items.every((o) => o.level === 'L0')).toBe(true);
  });

  it('limit=1 → slice 取 1 条,total 仍为 filter 后总数', async () => {
    const list = vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }]);
    const repo = mockRepo({ list });
    const res = await filteredResponse(repo, 'task', (k) => (k === 'limit' ? '1' : undefined));
    expect(res.items).toHaveLength(1);
    expect(res.total).toBe(4);
    expect(res.limit).toBe(1);
  });

  it('offset 越界 → items 空,total 仍为 filter 后总数', async () => {
    const list = vi.fn().mockResolvedValue([{ id: '1' }, { id: '2' }]);
    const repo = mockRepo({ list });
    const res = await filteredResponse(repo, 'task', (k) => (k === 'offset' ? '100' : undefined));
    expect(res.items).toEqual([]);
    expect(res.total).toBe(2);
  });
});
