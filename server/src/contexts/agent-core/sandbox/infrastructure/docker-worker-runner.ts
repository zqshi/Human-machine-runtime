import { spawn, type ChildProcess, type SpawnOptions } from 'child_process';
import { createInterface } from 'readline';
import { mkdirSync, writeFileSync, unlinkSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { toDockerResourceArgs } from './resource-converter.js';

/**
 * Worker 进程单次执行的入参。所有字段都会被序列化为 env 传入容器。
 */
export interface WorkerRunOptions {
  taskId: string;
  prompt: string;
  /** 已有 sessionId 则 resume,无则首次任务 */
  sessionId?: string;
  /** 数字员工实例 ID,用于关联 session 持久化 */
  instanceId?: string;
  tenantId: string;
  /** 宿主工作目录,会被挂载为容器内 /workspace */
  cwd: string;
  /**
   * Agent SDK allowedTools,默认全工具(保持兼容;T18b 止血开关 restrictToReadonlyTools
   * 在 adapter 层过滤副作用工具,见 docs/architecture/t18-tool-executor-mainline-gap.md)。
   */
  allowedTools: string[];
  /** Claude 模型 ID,如 claude-sonnet-4-6 / claude-opus-4-6 */
  model: string;
  maxTurns: number;
  maxBudgetUsd: number;
  timeoutMs: number;
  apiKey: string;
  /** 私有化:Anthropic API 基址;有值则注入容器 ANTHROPIC_BASE_URL,让 SDK 经企业代理转发(空则 SDK 直连) */
  anthropicBaseUrl?: string;
  /** D2:RAG 上下文块(知识库/记忆召回结果),worker 拼 prompt 时前置为 <context> 块 */
  ragContext?: string;
  /** v1.4:skill 内容块(组装层 boundSkills 召回),worker 拼 prompt 时前置为 <skills> 块 */
  skillsContext?: string;
  /** v1.6:trace id(协议预留,worker 后续可上报 child span;本期不埋点) */
  traceId?: string;
  /** v1.3:资源限制(CPU '1000m'/memory '512Mi' K8s 风格),转换为 docker --cpus/--memory;缺省用 1.0/2g */
  resources?: { cpu: string; memory: string };
  workerImage: string;
}

export interface WorkerProgress {
  progress: number;
  message?: string;
}

export interface WorkerResult {
  result: string;
  stopReason: string;
  usage?: { inputTokens: number; outputTokens: number; model?: string };
}

export interface WorkerCallbacks {
  onProgress?(p: WorkerProgress): void;
  onSessionId?(sessionId: string): void;
  onResult?(r: WorkerResult): void;
  onError?(err: Error): void;
}

/**
 * 可注入的 spawner,测试时替换为 fake。
 */
export interface Spawner {
  spawn(command: string, args: readonly string[], options: SpawnOptions): ChildProcess;
}

/** 实现者:运行 worker 进程 + 检查镜像可用性 */
export interface IWorkerRunner {
  run(opts: WorkerRunOptions, cbs: WorkerCallbacks, abortCtl: AbortController): Promise<void>;
  checkImageAvailable(image: string): Promise<boolean>;
}

// 默认全工具(adapter 总传非空 allowedTools,此 fallback 实为死分支;保持全工具兼容)。
// ⚠️ 工具经 SDK 内置执行器执行不经 ToolRegistryService(审批/日志/凭证/计费失效),见 t18 文档。
const DEFAULT_TOOLS = ['Bash', 'Write', 'Edit', 'Read', 'Glob', 'Grep', 'WebSearch', 'WebFetch'];

/**
 * 用 `docker run` 启动 claude-worker 容器执行单次 Agent 任务。
 *
 * - 进程协议:worker 在 stdout 按行输出 NDJSON 事件(`session_id`/`progress`/`result`/`error`)
 * - 隔离:`--network bridge` + `--cap-drop ALL` + `--security-opt no-new-privileges`
 * - 取消:AbortController.abort() → SIGTERM 容器 → `--rm` 自动清理
 */
export class DockerWorkerRunner implements IWorkerRunner {
  constructor(private readonly spawner: Spawner = nativeSpawner) {}

  async run(
    opts: WorkerRunOptions,
    cbs: WorkerCallbacks,
    abortCtl: AbortController
  ): Promise<void> {
    // 确保宿主 cwd 存在(否则 docker 会自动以 root 创建,权限错乱)
    try {
      mkdirSync(opts.cwd, { recursive: true });
    } catch {
      // 测试环境 cwd 可能是假路径;忽略失败,实际 docker run 会暴露错误
    }

    // 写 env file 到宿主 tmpdir(cwd 之外,避免被 -v 挂载进容器 /workspace)
    // 文件权限 0600;apiKey 不再走命令行 -e(避免 ps/proc 暴露)
    const envFile = join(tmpdir(), `hmr-task-${opts.taskId}.env`);
    const payload = this.buildPayload(opts);
    // env 行顺序无关;anthropicBaseUrl 有值时追加 ANTHROPIC_BASE_URL,让容器内 SDK 经企业代理转发(空则 SDK 默认直连)
    const envLines = [`ANTHROPIC_API_KEY=${opts.apiKey}`];
    if (opts.anthropicBaseUrl) {
      envLines.push(`ANTHROPIC_BASE_URL=${opts.anthropicBaseUrl}`);
    }
    envLines.push(`CLAUDE_TASK_JSON=${JSON.stringify(payload)}`);
    try {
      writeFileSync(envFile, `${envLines.join('\n')}\n`, { mode: 0o600 });
    } catch {
      // tmpdir 不可写时让 docker run 暴露真实错误
    }

    const args = this.buildArgs(opts, envFile);
    const child = this.spawner.spawn('docker', args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    // 监听 abort
    const onAbort = () => {
      if (!child.killed) child.kill('SIGTERM');
    };
    abortCtl.signal.addEventListener('abort', onAbort, { once: true });

    // 超时定时器
    let timeoutHandle: NodeJS.Timeout | null = null;
    if (opts.timeoutMs > 0) {
      timeoutHandle = setTimeout(() => {
        if (!child.killed) {
          child.kill('SIGTERM');
          cbs.onError?.(new Error(`Worker timeout after ${opts.timeoutMs}ms`));
        }
      }, opts.timeoutMs);
    }

    // stdout NDJSON 流
    const stdout = createInterface({ input: child.stdout!, crlfDelay: Infinity });
    stdout.on('line', (line) => {
      if (!line.trim()) return;
      let event: Record<string, unknown>;
      try {
        event = JSON.parse(line);
      } catch {
        // 非 JSON 行忽略(可能是 npm warning 等)
        return;
      }
      this.dispatchEvent(event, cbs);
    });

    // stderr 累积(诊断用,不直接触发 onError,等 exit code 判定)
    let stderrTail = '';
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail += chunk.toString('utf8');
      if (stderrTail.length > 4096) stderrTail = stderrTail.slice(-4096);
    });

    return new Promise<void>((resolve) => {
      const finalize = () => {
        if (timeoutHandle) clearTimeout(timeoutHandle);
        abortCtl.signal.removeEventListener('abort', onAbort);
        try {
          unlinkSync(envFile);
        } catch {
          // 文件不存在/已清理:忽略
        }
        resolve();
      };

      child.on('close', (code) => {
        // 被 abort 或 timeout kill 的情况已通过 cbs.onError 反馈,这里不再重复
        if (abortCtl.signal.aborted) {
          finalize();
          return;
        }
        if (code !== null && code !== 0) {
          const detail = stderrTail.trim() || `exit code ${code}`;
          cbs.onError?.(new Error(`Worker failed: ${detail}`));
        }
        finalize();
      });
      child.on('error', (err) => {
        cbs.onError?.(err);
        finalize();
      });
    });
  }

  async checkImageAvailable(image: string): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const child = this.spawner.spawn(
        'docker',
        ['images', '--filter', `reference=${image}`, '--format', '{{.Repository}}:{{.Tag}}'],
        { stdio: ['ignore', 'pipe', 'ignore'] }
      );
      let output = '';
      child.stdout?.on('data', (chunk: Buffer) => {
        output += chunk.toString('utf8');
      });
      child.on('close', (code) => {
        if (code !== 0) {
          resolve(false);
          return;
        }
        resolve(output.trim().length > 0);
      });
      child.on('error', () => resolve(false));
    });
  }

  private buildPayload(opts: WorkerRunOptions): Record<string, unknown> {
    const allowedTools = opts.allowedTools.length > 0 ? opts.allowedTools : DEFAULT_TOOLS;
    const payload: Record<string, unknown> = {
      prompt: opts.prompt,
      allowedTools,
      model: opts.model,
      maxTurns: opts.maxTurns,
      maxBudgetUsd: opts.maxBudgetUsd,
    };
    if (opts.ragContext) {
      payload.ragContext = opts.ragContext;
    }
    if (opts.skillsContext) {
      payload.skillsContext = opts.skillsContext;
    }
    if (opts.traceId) {
      payload.traceId = opts.traceId;
    }
    if (opts.sessionId) {
      payload.sessionId = opts.sessionId;
    }
    return payload;
  }

  private buildArgs(opts: WorkerRunOptions, envFile: string): string[] {
    // v1.3:资源从 opts.resources 读(K8s 风格→docker 参数),缺省 fallback 1.0/2g 兼容旧行为
    const res = opts.resources
      ? toDockerResourceArgs(opts.resources)
      : { cpus: '1.0', memory: '2g' };
    return [
      'run',
      '--rm',
      '-i',
      '--name',
      `claude-worker-${opts.taskId}`,
      '--memory',
      res.memory,
      '--cpus',
      res.cpus,
      '--network',
      'bridge',
      '--cap-drop',
      'ALL',
      '--security-opt',
      'no-new-privileges',
      '--stop-timeout',
      '5',
      '-v',
      `${opts.cwd}:/workspace`,
      '--env-file',
      envFile,
      opts.workerImage,
    ];
  }

  private dispatchEvent(event: Record<string, unknown>, cbs: WorkerCallbacks): void {
    const type = event.type;
    if (type === 'session_id' && typeof event.sessionId === 'string') {
      cbs.onSessionId?.(event.sessionId);
    } else if (type === 'progress' && typeof event.progress === 'number') {
      cbs.onProgress?.({
        progress: event.progress,
        message: typeof event.message === 'string' ? event.message : undefined,
      });
    } else if (type === 'result' && typeof event.result === 'string') {
      const rawUsage = event.usage as Record<string, unknown> | undefined;
      const usage =
        rawUsage && typeof rawUsage === 'object'
          ? {
              inputTokens:
                typeof rawUsage.inputTokens === 'number'
                  ? rawUsage.inputTokens
                  : typeof rawUsage.input_tokens === 'number'
                    ? rawUsage.input_tokens
                    : 0,
              outputTokens:
                typeof rawUsage.outputTokens === 'number'
                  ? rawUsage.outputTokens
                  : typeof rawUsage.output_tokens === 'number'
                    ? rawUsage.output_tokens
                    : 0,
              ...(typeof rawUsage.model === 'string' ? { model: rawUsage.model } : {}),
            }
          : undefined;
      cbs.onResult?.({
        result: event.result,
        stopReason: typeof event.stopReason === 'string' ? event.stopReason : 'unknown',
        usage,
      });
    } else if (type === 'error' && typeof event.message === 'string') {
      cbs.onError?.(new Error(String(event.message)));
    }
  }
}

/** 默认 spawner:child_process.spawn 的薄封装 */
export const nativeSpawner: Spawner = {
  spawn(command, args, options) {
    return spawn(command, args as string[], options);
  },
};
