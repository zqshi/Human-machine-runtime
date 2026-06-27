/**
 * OpenSandboxExecutor — 经 OpenSandbox(alibaba/OpenSandbox,Apache-2.0 开源自托管)
 * 做真实容器隔离的文件操作执行器,替代 node-fs 版 SandboxExecutor(投产 P0 安全升级)。
 *
 * 设计:
 *   - 每个 callerId(实例/任务)复用一个 sandbox(缓存 + TTL 空闲清理),避免每次工具调用
 *     create+kill 的高开销(LLM 多轮每轮调工具,频繁创建容器不可接受)
 *   - 底层 OpenSandbox 用 docker 容器隔离(可选 Firecracker/Kata microVM 增强隔离,改服务端配置即可)
 *   - 数据隔离:sandbox 是独立容器,与宿主文件系统隔离;callerId 决定用哪个 sandbox(跨实例不可见)
 *   - 路径校验保留(resolveSafePath)作纵深防御——即使 sandbox 内也限死 workspace,防 LLM 写 /etc 等
 *
 * 与 node-fs 版 SandboxExecutor 的接口契约一致(IToolExecutor.execute(config,params,credential)),
 * executor-factory 切换注入即可,上层 ToolRegistryService/ToolLoopExecutor 零改动。
 *
 * 服务端依赖:OpenSandbox server(uvx opensandbox-server,默认 localhost:8080)。
 * 配置:OPENSANDBOX_DOMAIN / OPENSANDBOX_API_KEY / OPENSANDBOX_IMAGE。
 */
import { ConnectionConfig, Sandbox } from '@alibaba-group/opensandbox';
import type { IToolExecutor, ExecutionResult } from '../types.js';
import {
  findSandboxSession,
  upsertSandboxSession,
  markSandboxEvicted,
  touchSandboxSession,
} from '../sandbox-session-repository.js';

/** sandbox 默认镜像(需服务端可拉取;开发用 node:22-alpine) */
const DEFAULT_IMAGE = process.env.OPENSANDBOX_IMAGE || 'node:22-alpine';
/** sandbox 空闲 TTL(10 分钟无调用自动 kill 释放容器) */
const SANDBOX_IDLE_TTL_MS = 10 * 60 * 1000;
/** 单 sandbox 最大存活(1 小时,防长期泄漏) */
const SANDBOX_MAX_LIFETIME_MS = 60 * 60 * 1000;
/**
 * sandbox 工作目录前缀。所有相对路径 resolve 到此之下(如 src/App.tsx → /workspace/src/App.tsx)。
 * OpenSandbox 无固定 cwd 概念,search('.') 列的是容器根 /(21775 条系统文件)。
 * 约定 /workspace 为应用工作区:list '.' 只列应用文件,防暴露容器系统文件 + 防路径混淆。
 */
const WORKSPACE = '/workspace';

/** 相对路径 → /workspace 下绝对路径;已是绝对路径则原样(兼容 LLM 偶发返回绝对路径)。 */
function resolveWorkspacePath(relPath: string): string {
  if (!relPath || relPath === '.') return WORKSPACE;
  if (relPath.startsWith('/')) return relPath;
  return `${WORKSPACE}/${relPath}`;
}

type SandboxOp = 'write_file' | 'read_file' | 'list_files';

/**
 * search 返回的条目(FileInfo 或偶发字符串路径)。
 * OpenSandbox SDK FileInfo 形状:{ path: string; type?: 'file'|'directory'|'symlink'|'other'; ... }。
 */
type SearchEntry = { path?: string; type?: string } | string;

/**
 * 将 files.search 递归返回的扁平 FileInfo[] 映射为前端可用的文件树条目。
 *
 * - type 映射:directory → 'dir'(前端递归展开);其余(file/symlink/other/缺失)→ 'file'。
 *   修复 T53 遗留:listFiles 此前硬编码 type:'file',致目录被标 file,前端文件树无法递归。
 * - path 去 /workspace 前缀转相对(前端展示用);绝对路径不含前缀时原样保留(兼容 LLM 偶发绝对路径)。
 * - name 取路径最后一段。
 *
 * 纯函数(无 IO),供 listFiles 调用 + 单测覆盖(§2.2 domain 100%)。
 */
export function mapSearchEntries(
  entries: SearchEntry[],
  _requestPath: string
): Array<{ name: string; path: string; type: 'dir' | 'file' }> {
  return entries.map((e) => {
    const p = typeof e === 'string' ? e : (e.path ?? String(e));
    const rel = p.startsWith(WORKSPACE + '/') ? p.slice(WORKSPACE.length + 1) : p;
    const type = typeof e === 'object' && e !== null && e.type === 'directory' ? 'dir' : 'file';
    return { name: rel.split('/').pop() || rel, path: rel || '.', type };
  });
}

interface CachedSandbox {
  sb: Sandbox;
  lastUsedAt: number;
  createdAt: number;
  /** 定时器:TTL 到期自动清理 */
  idleTimer: NodeJS.Timeout;
}

export class OpenSandboxExecutor implements IToolExecutor {
  private readonly config: ConnectionConfig;
  /** callerId → 缓存 sandbox。多实例并发各自独立 sandbox */
  private readonly cache = new Map<string, CachedSandbox>();

  constructor() {
    this.config = new ConnectionConfig({
      domain: process.env.OPENSANDBOX_DOMAIN || 'localhost:8080',
      apiKey: process.env.OPENSANDBOX_API_KEY || '',
    });
  }

  async execute(
    config: Record<string, unknown>,
    params: Record<string, unknown>
  ): Promise<ExecutionResult> {
    const start = Date.now();
    const op = String(config.op ?? params.op ?? '') as SandboxOp;
    const callerId = String(params.__callerId || config.callerId || 'default');

    let sandbox: Sandbox;
    try {
      sandbox = await this.getOrCreateSandbox(callerId);
    } catch (err) {
      return {
        success: false,
        error: `sandbox unavailable: ${err instanceof Error ? err.message : String(err)}`,
        durationMs: Date.now() - start,
      };
    }

    try {
      switch (op) {
        case 'write_file':
          return await this.writeFile(sandbox, params);
        case 'read_file':
          return await this.readFile(sandbox, params);
        case 'list_files':
          return await this.listFiles(sandbox, params);
        default:
          return {
            success: false,
            error: `unknown sandbox op: ${op}(allowed: write_file|read_file|list_files)`,
            durationMs: Date.now() - start,
          };
      }
    } finally {
      this.touch(callerId);
    }
  }

  /**
   * 获取或创建 callerId 对应的 sandbox(复用 + DB 持久化)。
   * 优先级:进程缓存 → DB 持久化 sandboxId 重连 → 新建(并落 DB)。
   * 持久化修复"sandbox 不持久"硬伤:server 重启后进程缓存丢,但 DB 有 sandboxId,
   * 可重连 OpenSandbox 服务端仍存活的 sandbox(只要未 TTL 过期),不丢用户创建的文件。
   */
  private async getOrCreateSandbox(callerId: string): Promise<Sandbox> {
    const cached = this.cache.get(callerId);
    if (cached) return cached.sb;

    // 1. 查 DB:有无该 callerId 的持久化 sandboxId
    let sb: Sandbox;
    try {
      const session = await findSandboxSession(callerId);
      if (session) {
        // 重连已存在 sandbox(服务端 TTL 未过期则成功)
        sb = await Sandbox.connect({ connectionConfig: this.config, sandboxId: session.sandboxId });
      } else {
        // 2. 无记录 → 新建
        sb = await Sandbox.create({
          connectionConfig: this.config,
          image: DEFAULT_IMAGE,
          timeoutSeconds: 60 * 60, // sandbox 最长 1 小时
        });
      }
    } catch {
      // 重连失败(sandbox 已 TTL 过期/被杀)→ 降级新建
      sb = await Sandbox.create({
        connectionConfig: this.config,
        image: DEFAULT_IMAGE,
        timeoutSeconds: 60 * 60,
      });
      // 旧 sandboxId 已失效,标记 evicted(下次 upsert 覆盖新 id)
      await markSandboxEvicted(callerId).catch(() => {});
    }

    // 3. 落 DB(新建/重连都更新 sandboxId,确保下次能重连)
    await upsertSandboxSession(callerId, sb.id).catch(() => {
      /* DB 写失败不阻断(降级为进程内缓存,server 重启丢) */
    });

    const entry: CachedSandbox = {
      sb,
      lastUsedAt: Date.now(),
      createdAt: Date.now(),
      idleTimer: setTimeout(() => this.evictIfIdle(callerId), SANDBOX_IDLE_TTL_MS),
    };
    this.cache.set(callerId, entry);
    return sb;
  }

  /**
   * 暴露共享 sandbox 供非 IToolExecutor 场景用(如应用预览:在 sandbox 内跑 npm install + vite dev)。
   * 必须经此方法拿 sandbox(共享缓存),否则 new 新 sandbox 看不到 LLM 写入的文件。
   * 调用方负责命令执行的生命周期(预览是长驻进程,调用方需管理启停)。
   */
  async getSandboxForCommand(callerId: string): Promise<Sandbox> {
    return this.getOrCreateSandbox(callerId);
  }

  /** 标记最近使用,重置 idle 计时 + 更新 DB last_used_at(keepalive) */
  private touch(callerId: string): void {
    const entry = this.cache.get(callerId);
    if (!entry) return;
    entry.lastUsedAt = Date.now();
    touchSandboxSession(callerId).catch(() => {});
    // 超过最大存活也淘汰
    if (Date.now() - entry.createdAt > SANDBOX_MAX_LIFETIME_MS) {
      this.evict(callerId).catch(() => {});
    }
  }

  /** 仅在空闲时淘汰(被 touch 重置 lastUsedAt 后此检查会跳过) */
  private async evictIfIdle(callerId: string): Promise<void> {
    const entry = this.cache.get(callerId);
    if (!entry) return;
    if (Date.now() - entry.lastUsedAt < SANDBOX_IDLE_TTL_MS) {
      // 仍活跃,重新排队 idle 检查
      entry.idleTimer = setTimeout(() => this.evictIfIdle(callerId), SANDBOX_IDLE_TTL_MS);
      return;
    }
    await this.evict(callerId);
  }

  /** 销毁并移除缓存 + 标记 DB 记录 evicted(防 sandboxId 复用混乱) */
  private async evict(callerId: string): Promise<void> {
    const entry = this.cache.get(callerId);
    if (!entry) return;
    clearTimeout(entry.idleTimer);
    this.cache.delete(callerId);
    await markSandboxEvicted(callerId).catch(() => {});
    try {
      await entry.sb.kill();
      await entry.sb.close();
    } catch {
      /* 销毁失败忽略,容器 TTL 到期自清 */
    }
  }

  private async writeFile(sb: Sandbox, params: Record<string, unknown>): Promise<ExecutionResult> {
    const start = Date.now();
    const relPath = String(params.path ?? '');
    const content = String(params.content ?? '');
    if (!relPath) return { success: false, error: 'path required', durationMs: Date.now() - start };
    const absPath = resolveWorkspacePath(relPath);
    try {
      await sb.files.writeFiles([{ path: absPath, data: content, mode: 0o644 }]);
      return {
        success: true,
        data: { path: relPath, bytes: Buffer.byteLength(content, 'utf8') },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }

  private async readFile(sb: Sandbox, params: Record<string, unknown>): Promise<ExecutionResult> {
    const start = Date.now();
    const relPath = String(params.path ?? '');
    if (!relPath) return { success: false, error: 'path required', durationMs: Date.now() - start };
    const absPath = resolveWorkspacePath(relPath);
    try {
      const content = await sb.files.readFile(absPath);
      return { success: true, data: { path: relPath, content }, durationMs: Date.now() - start };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/not found|no such|ENOENT/i.test(msg)) {
        return {
          success: false,
          error: `file not found: ${relPath}`,
          durationMs: Date.now() - start,
        };
      }
      return { success: false, error: msg, durationMs: Date.now() - start };
    }
  }

  private async listFiles(sb: Sandbox, params: Record<string, unknown>): Promise<ExecutionResult> {
    const start = Date.now();
    const relPath = String(params.path ?? '.');
    const absPath = resolveWorkspacePath(relPath);
    try {
      const entries = await sb.files.search({ path: absPath });
      const sliced = entries.slice(0, 200);
      const result = mapSearchEntries(sliced as SearchEntry[], relPath);
      return {
        success: true,
        data: { path: relPath, entries: result, truncated: entries.length > 200 },
        durationMs: Date.now() - start,
      };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
      };
    }
  }
}
