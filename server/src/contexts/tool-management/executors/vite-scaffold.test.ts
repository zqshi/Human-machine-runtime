import { describe, it, expect, vi } from 'vitest';
import {
  ensureViteSandbox,
  VITE_SCAFFOLD_FILES,
} from './vite-scaffold.js';
import type { Sandbox } from '@alibaba-group/opensandbox';

/**
 * 构造 mock sandbox。
 * - pkgExists: readFile('/workspace/package.json') 是否成功
 * - appTsxExists: readFile('/workspace/src/App.tsx') 是否成功
 * - writeFails: writeFiles 是否抛错
 * readFile 按 path 返回不同结果(精确模拟"文件存在性"判断)。
 */
function makeSandbox(
  opts: { pkgExists?: boolean; appTsxExists?: boolean; writeFails?: boolean } = {}
): Sandbox {
  const readFile = vi.fn(async (path: string) => {
    if (path === '/workspace/package.json' && opts.pkgExists) return '{}';
    if (path === '/workspace/src/App.tsx' && opts.appTsxExists) return 'export default function App() {}';
    throw new Error('not found');
  });
  return {
    files: {
      readFile,
      writeFiles: opts.writeFails
        ? vi.fn().mockRejectedValue(new Error('write failed'))
        : vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Sandbox;
}

describe('ensureViteSandbox', () => {
  it('已有 package.json → 不注入(injected=false,尊重 LLM 已建项目)', async () => {
    const sb = makeSandbox({ pkgExists: true });
    const result = await ensureViteSandbox(sb);

    expect(result.injected).toBe(false);
    expect(sb.files.writeFiles).not.toHaveBeenCalled();
  });

  it('无 package.json → 注入脚手架(injected=true,writeFiles 被调)', async () => {
    const sb = makeSandbox({}); // pkg 不存在,App.tsx 不存在
    const result = await ensureViteSandbox(sb);

    expect(result.injected).toBe(true);
    expect(sb.files.writeFiles).toHaveBeenCalledTimes(1);
    const written = (sb.files.writeFiles as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
      path: string;
      data: string;
      mode: number;
    }>;
    expect(written.every((w) => w.path.startsWith('/workspace/'))).toBe(true);
    expect(written.map((w) => w.path)).toEqual(
      expect.arrayContaining(VITE_SCAFFOLD_FILES.map((f) => `/workspace/${f.path}`))
    );
    // package.json 含 vite dev 脚本(--host 让 OpenSandbox 端口转发可达)
    const pkg = written.find((w) => w.path === '/workspace/package.json');
    expect(pkg?.data).toContain('"dev": "vite --host"');
    expect(pkg?.data).toContain('react');
    // index.html 挂入口 main.tsx
    const html = written.find((w) => w.path === '/workspace/index.html');
    expect(html?.data).toContain('src/main.tsx');
  });

  it('无 package.json 但 src/App.tsx 已存在 → 注入脚手架但跳过 App.tsx(不覆盖 LLM 业务代码)', async () => {
    const sb = makeSandbox({ appTsxExists: true });
    const result = await ensureViteSandbox(sb);

    expect(result.injected).toBe(true);
    const written = (sb.files.writeFiles as ReturnType<typeof vi.fn>).mock.calls[0][0] as Array<{
      path: string;
    }>;
    const writtenPaths = written.map((w) => w.path);
    expect(writtenPaths).not.toContain('/workspace/src/App.tsx');
    expect(writtenPaths).toContain('/workspace/package.json');
    expect(writtenPaths).toContain('/workspace/index.html');
    expect(writtenPaths).toContain('/workspace/src/main.tsx');
  });

  it('readFile 抛错(目录未建) → 视为无 package.json,注入(writeFiles 自动建目录)', async () => {
    const sb = makeSandbox({}); // readFile 全抛 not found
    const result = await ensureViteSandbox(sb);

    expect(result.injected).toBe(true);
  });

  it('writeFiles 抛错 → 容错不抛,返回 injected=false', async () => {
    const sb = makeSandbox({ writeFails: true });
    const result = await ensureViteSandbox(sb);

    expect(result.injected).toBe(false);
  });
});

describe('VITE_SCAFFOLD_FILES', () => {
  it('脚手架含最小可运行 vite+React+TS 必需文件', () => {
    const paths = VITE_SCAFFOLD_FILES.map((f) => f.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'package.json',
        'index.html',
        'vite.config.ts',
        'tsconfig.json',
        'src/main.tsx',
        'src/App.tsx',
        'src/index.css',
      ])
    );
  });
});
