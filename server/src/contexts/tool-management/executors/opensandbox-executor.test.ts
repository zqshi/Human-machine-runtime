import { describe, it, expect } from 'vitest';
import { mapSearchEntries } from './opensandbox-executor.js';

/**
 * mapSearchEntries 单测(§2.2 domain 100% 覆盖)。
 *
 * 修复点(T53 遗留):listFiles 此前硬编码 type:'file',忽略 SDK FileInfo.type,
 * 致目录被标 file,前端文件树无法递归展开。抽出纯函数后用 FileInfo.type 正确映射。
 *
 * OpenSandbox SDK files.search 递归返回子树(FileInfo[]),前端按 path 构建树,
 * 无需递归调 API。type 映射:directory→dir,其余(file/symlink/other/缺失)→file。
 */
describe('mapSearchEntries — search 结果映射(含 type 修正)', () => {
  it('directory → dir, file → file(类型正确映射,修复硬编码 file bug)', () => {
    const entries = [
      { path: '/workspace/src', type: 'directory' },
      { path: '/workspace/src/App.tsx', type: 'file' },
      { path: '/workspace/package.json', type: 'file' },
    ];
    const result = mapSearchEntries(entries as never, '.');
    expect(result[0]).toEqual({ name: 'src', path: 'src', type: 'dir' });
    expect(result[1]).toEqual({ name: 'App.tsx', path: 'src/App.tsx', type: 'file' });
    expect(result[2]).toEqual({ name: 'package.json', path: 'package.json', type: 'file' });
  });

  it('type 缺失 / symlink / other → file(防御:非目录一律按文件)', () => {
    const entries = [
      { path: '/workspace/README.md' }, // 无 type
      { path: '/workspace/link', type: 'symlink' },
      { path: '/workspace/socket', type: 'other' },
    ];
    const result = mapSearchEntries(entries as never, '.');
    expect(result.every((e) => e.type === 'file')).toBe(true);
  });

  it('去 /workspace 前缀转相对路径(前端展示用)', () => {
    const entries = [{ path: '/workspace/src/index.ts', type: 'file' }];
    const result = mapSearchEntries(entries as never, '.');
    expect(result[0].path).toBe('src/index.ts');
  });

  it('name 取路径最后一段', () => {
    const entries = [{ path: '/workspace/a/b/c.ts', type: 'file' }];
    const result = mapSearchEntries(entries as never, '.');
    expect(result[0].name).toBe('c.ts');
  });

  it('string entry 兼容(search 偶发返回字符串路径)', () => {
    const entries = ['/workspace/x.ts'];
    const result = mapSearchEntries(entries as never, '.');
    expect(result[0]).toEqual({ name: 'x.ts', path: 'x.ts', type: 'file' });
  });

  it('绝对路径不含 WORKSPACE 前缀时原样保留(兼容 LLM 偶发绝对路径)', () => {
    const entries = [{ path: '/tmp/other.ts', type: 'file' }];
    const result = mapSearchEntries(entries as never, '.');
    expect(result[0].path).toBe('/tmp/other.ts');
  });

  it('空数组 → 空', () => {
    expect(mapSearchEntries([], '.')).toEqual([]);
  });
});
