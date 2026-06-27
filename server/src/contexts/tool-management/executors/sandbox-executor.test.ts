import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { SandboxExecutor } from './sandbox-executor.js';

/**
 * SandboxExecutor 单测(§2.2 domain 100% 覆盖)。
 * 重点验证安全不变式:路径逃逸防护(../、绝对路径、符号链接)。
 */
const TEST_ROOT = path.join(os.tmpdir(), `hmr-sandbox-test-${process.pid}`);
const CALLER = 'inst_test_001';

async function exec(op: string, params: Record<string, unknown>) {
  const executor = new SandboxExecutor();
  return executor.execute({ op }, { ...params, __callerId: CALLER });
}

describe('SandboxExecutor', () => {
  beforeEach(async () => {
    process.env.HMR_SANDBOX_ROOT = TEST_ROOT;
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
    await fs.mkdir(path.join(TEST_ROOT, CALLER), { recursive: true });
  });
  afterEach(async () => {
    await fs.rm(TEST_ROOT, { recursive: true, force: true });
  });

  it('write_file 正常写入 → 返回字节数 + 文件真实存在', async () => {
    const r = await exec('write_file', { path: 'hello.txt', content: 'hello world' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ path: 'hello.txt', bytes: 11 });
    const content = await fs.readFile(path.join(TEST_ROOT, CALLER, 'hello.txt'), 'utf8');
    expect(content).toBe('hello world');
  });

  it('write_file 带子目录 → 自动创建父目录', async () => {
    const r = await exec('write_file', { path: 'src/index.ts', content: 'export {}' });
    expect(r.success).toBe(true);
    const content = await fs.readFile(path.join(TEST_ROOT, CALLER, 'src/index.ts'), 'utf8');
    expect(content).toBe('export {}');
  });

  it('read_file 读取已写文件 → 返回 content', async () => {
    await exec('write_file', { path: 'data.json', content: '{"k":1}' });
    const r = await exec('read_file', { path: 'data.json' });
    expect(r.success).toBe(true);
    expect(r.data).toMatchObject({ path: 'data.json', content: '{"k":1}' });
  });

  it('read_file 不存在 → success:false + file not found', async () => {
    const r = await exec('read_file', { path: 'nope.txt' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('file not found');
  });

  it('list_files 列目录 → 返回 entries', async () => {
    await exec('write_file', { path: 'a.txt', content: 'a' });
    await exec('write_file', { path: 'b.txt', content: 'b' });
    const r = await exec('list_files', { path: '.' });
    expect(r.success).toBe(true);
    const names = (r.data as { entries: { name: string }[] }).entries.map((e) => e.name);
    expect(names).toContain('a.txt');
    expect(names).toContain('b.txt');
  });

  // 安全不变式(最关键):路径逃逸防护
  it('write_file 绝对路径 → 拒绝(防写到 sandbox 外)', async () => {
    const r = await exec('write_file', { path: '/etc/passwd', content: 'evil' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('relative');
  });

  it('write_file .. 穿越逃逸 → 拒绝(防 ../sandbox-root 逃逸)', async () => {
    const r = await exec('write_file', { path: '../../../etc/evil', content: 'x' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('escapes');
  });

  it('read_file .. 穿越 → 拒绝(防读取 /etc/passwd 等)', async () => {
    const r = await exec('read_file', { path: '../../../etc/passwd' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('escapes');
  });

  it('content 超 256KB → 拒绝(防耗尽磁盘)', async () => {
    const big = 'x'.repeat(256 * 1024 + 1);
    const r = await exec('write_file', { path: 'big.txt', content: big });
    expect(r.success).toBe(false);
    expect(r.error).toContain('too large');
  });

  it('未知 op → 拒绝(只允许 write_file/read_file/list_files,防任意操作)', async () => {
    const r = await exec('run_command', { command: 'rm -rf /' });
    expect(r.success).toBe(false);
    expect(r.error).toContain('unknown sandbox op');
  });

  it('空 path → 拒绝', async () => {
    const r = await exec('write_file', { path: '', content: 'x' });
    expect(r.success).toBe(false);
  });
});
