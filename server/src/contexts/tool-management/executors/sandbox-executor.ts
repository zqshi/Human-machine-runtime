/**
 * Sandbox Executor — 受限文件操作执行器(路径B:让 LLM 经 tool-loop 真实创建/读取文件)。
 *
 * 设计目标(安全优先):
 *   - 仅支持受限操作:write_file / read_file / list_files(不暴露任意 shell,防 RCE)
 *   - 路径强校验:拒绝 .. / 绝对路径 / 符号链接逃逸,强制限定在 sandboxRoot 之下
 *   - 工作目录隔离:按 callerId(实例/任务)分目录,跨实例不可见
 *   - 内容长度限制:防 LLM 写超大文件耗尽磁盘
 *
 * PoC 说明:当前在 server 进程内用 node fs 执行(隔离到 SANDBOX_ROOT/<callerId>)。
 * **投产级需改 docker 隔离**(docker run --rm 挂载 sandbox 目录,避免宿主文件系统逃逸),
 * 当前实现已做路径校验但非容器级隔离,仅供能力链路验证。
 *
 * 工具调用经 ToolRegistryService.invoke → 审批 gate(riskLevel=medium 触发 #7 审批)→ 本执行器。
 */
import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import type { IToolExecutor, ExecutionResult } from '../types.js';

/** sandbox 根目录(进程内隔离)。投产改 docker 挂载目录。每次执行时读 env(支持测试覆盖)。 */
function sandboxRoot(): string {
  return process.env.HMR_SANDBOX_ROOT || '/tmp/hmr-sandbox';
}
/** 单文件内容上限(256KB),防 LLM 写超大文件。 */
const MAX_CONTENT_BYTES = 256 * 1024;
/** 单次 list 返回文件数上限。 */
const MAX_LIST_ENTRIES = 200;

/** 受限操作白名单(枚举,非 LLM 任意传入)。 */
type SandboxOp = 'write_file' | 'read_file' | 'list_files';

export class SandboxExecutor implements IToolExecutor {
  async execute(
    config: Record<string, unknown>,
    params: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const op = String(config.op ?? params.op ?? '') as SandboxOp;
    const callerId = String(params.__callerId || config.callerId || 'default');
    const sandboxDir = path.join(sandboxRoot(), callerId);

    try {
      await fs.mkdir(sandboxDir, { recursive: true });
      switch (op) {
        case 'write_file':
          return await this.writeFile(sandboxDir, params);
        case 'read_file':
          return await this.readFile(sandboxDir, params);
        case 'list_files':
          return await this.listFiles(sandboxDir, params);
        default:
          return {
            success: false,
            error: `unknown sandbox op: ${op}(allowed: write_file|read_file|list_files)`,
            durationMs: Date.now() - start,
          };
      }
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  private async writeFile(dir: string, params: Record<string, unknown>): Promise<ExecutionResult> {
    const start = Date.now();
    const relPath = String(params.path ?? '');
    const content = String(params.content ?? '');
    const safe = resolveSafePath(dir, relPath);
    if (!safe.ok) return { success: false, error: safe.error, durationMs: Date.now() - start };

    const buf = Buffer.from(content, 'utf8');
    if (buf.byteLength > MAX_CONTENT_BYTES) {
      return {
        success: false,
        error: `content too large: ${buf.byteLength} > ${MAX_CONTENT_BYTES} bytes`,
        durationMs: Date.now() - start,
      };
    }
    await fs.mkdir(path.dirname(safe.path), { recursive: true });
    await fs.writeFile(safe.path, content, 'utf8');
    return {
      success: true,
      data: { path: relPath, bytes: buf.byteLength },
      durationMs: Date.now() - start,
    };
  }

  private async readFile(dir: string, params: Record<string, unknown>): Promise<ExecutionResult> {
    const start = Date.now();
    const relPath = String(params.path ?? '');
    const safe = resolveSafePath(dir, relPath);
    if (!safe.ok) return { success: false, error: safe.error, durationMs: Date.now() - start };
    try {
      const content = await fs.readFile(safe.path, 'utf8');
      return { success: true, data: { path: relPath, content }, durationMs: Date.now() - start };
    } catch (err) {
      const code = (err as NodeJS.ErrnoException).code;
      if (code === 'ENOENT') {
        return { success: false, error: `file not found: ${relPath}`, durationMs: Date.now() - start };
      }
      throw err;
    }
  }

  private async listFiles(dir: string, params: Record<string, unknown>): Promise<ExecutionResult> {
    const start = Date.now();
    const relPath = String(params.path ?? '.');
    const safe = resolveSafePath(dir, relPath);
    if (!safe.ok) return { success: false, error: safe.error, durationMs: Date.now() - start };
    const entries = await fs.readdir(safe.path, { withFileTypes: true });
    const result = entries
      .slice(0, MAX_LIST_ENTRIES)
      .map((e) => ({ name: e.name, type: e.isDirectory() ? 'dir' : 'file' }));
    return {
      success: true,
      data: { path: relPath, entries: result, truncated: entries.length > MAX_LIST_ENTRIES },
      durationMs: Date.now() - start,
    };
  }
}

/**
 * 解析相对路径并校验不逃逸 sandboxDir。
 * 拒绝:绝对路径、.. 穿越、空路径。返回 sandboxDir 内的真实绝对路径。
 * 用 path.resolve + startsWith 二次校验防符号链接/`..` 拼接逃逸。
 */
function resolveSafePath(
  sandboxDir: string,
  relPath: string
): { ok: true; path: string } | { ok: false; error: string } {
  if (!relPath || relPath.startsWith('/')) {
    return { ok: false, error: 'path must be relative (no leading /)' };
  }
  const resolved = path.resolve(sandboxDir, relPath);
  // startsWith 校验:resolved 必须在 sandboxDir 之下(防 .. 穿越)
  if (resolved !== sandboxDir && !resolved.startsWith(sandboxDir + path.sep)) {
    return { ok: false, error: 'path escapes sandbox dir' };
  }
  return { ok: true, path: resolved };
}
