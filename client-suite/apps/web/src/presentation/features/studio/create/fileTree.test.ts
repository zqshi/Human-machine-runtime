import { describe, it, expect } from 'vitest';
import { buildFileTree } from './fileTree.js';
import type { SandboxEntry } from './fileTree.js';

/**
 * buildFileTree 单测 — 把 list_files(search 递归返回的扁平 FileInfo[])构建为前端文件树。
 *
 * 后端 listFiles 已修 type 映射(T53 fix):directory→dir, file→file。
 * search 递归返回子树(含目录条目),前端按 path 用 / 分割逐层构建,无需递归调 API。
 */
describe('buildFileTree — 扁平 entries → 文件树', () => {
  it('混合目录+文件 → 正确嵌套(目录含 children)', () => {
    const entries: SandboxEntry[] = [
      { name: 'src', path: 'src', type: 'dir' },
      { name: 'App.tsx', path: 'src/App.tsx', type: 'file' },
      { name: 'package.json', path: 'package.json', type: 'file' },
    ];
    const tree = buildFileTree(entries);
    expect(tree).toHaveLength(2);
    const src = tree.find((n) => n.name === 'src');
    expect(src?.type).toBe('dir');
    expect(src?.children).toHaveLength(1);
    expect(src?.children?.[0]).toMatchObject({ name: 'App.tsx', type: 'file' });
    const pkg = tree.find((n) => n.name === 'package.json');
    expect(pkg?.type).toBe('file');
    expect(pkg?.children).toBeUndefined();
  });

  it('多级嵌套路径 → 逐层构建(a/b/c.ts)', () => {
    const entries: SandboxEntry[] = [
      { name: 'c.ts', path: 'a/b/c.ts', type: 'file' },
      { name: 'a', path: 'a', type: 'dir' },
      { name: 'b', path: 'a/b', type: 'dir' },
    ];
    const tree = buildFileTree(entries);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('a');
    expect(tree[0].children?.[0].name).toBe('b');
    expect(tree[0].children?.[0].children?.[0]).toMatchObject({ name: 'c.ts', type: 'file' });
  });

  it('中间目录不在 entries 时自动推断为目录(文件路径推断层级)', () => {
    // search 偶发只返回文件不返回目录条目:从 a/b/c.ts 推断 a、b 为目录
    const entries: SandboxEntry[] = [{ name: 'c.ts', path: 'a/b/c.ts', type: 'file' }];
    const tree = buildFileTree(entries);
    expect(tree[0].name).toBe('a');
    expect(tree[0].type).toBe('dir');
    expect(tree[0].children?.[0].name).toBe('b');
    expect(tree[0].children?.[0].type).toBe('dir');
    expect(tree[0].children?.[0].children?.[0]).toMatchObject({ name: 'c.ts', type: 'file' });
  });

  it('单文件 → 根级单节点无 children', () => {
    const entries: SandboxEntry[] = [{ name: 'README.md', path: 'README.md', type: 'file' }];
    const tree = buildFileTree(entries);
    expect(tree).toEqual([{ name: 'README.md', path: 'README.md', type: 'file' }]);
  });

  it('空数组 → 空树', () => {
    expect(buildFileTree([])).toEqual([]);
  });

  it('目录排序:目录在前,文件在后(同层内便于浏览)', () => {
    const entries: SandboxEntry[] = [
      { name: 'z.txt', path: 'z.txt', type: 'file' },
      { name: 'src', path: 'src', type: 'dir' },
      { name: 'a.txt', path: 'a.txt', type: 'file' },
    ];
    const tree = buildFileTree(entries);
    // 目录 src 排前,文件按名排序
    expect(tree[0].name).toBe('src');
    expect(tree.map((n) => n.name)).toEqual(['src', 'a.txt', 'z.txt']);
  });
});
